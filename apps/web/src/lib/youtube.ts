/**
 * YouTube resolution + audio extraction — keyless / open (no API key, no user
 * setup). This is tier 2 of the playback ladder: full-song audio for tracks
 * SoundCloud can't stream (encrypted Go+/DRM majors like aespa "Lemonade").
 *
 * We do NOT use the official YouTube Data API. Like yt-dlp / spotdl we use the
 * public InnerTube endpoints via `youtubei.js`. YouTube's *standard* audio is
 * NOT DRM-encrypted — this is keyless extraction (same category as the SoundCloud
 * `client_id` scrape), not DRM circumvention.
 *
 * Reality note (2025+): YouTube no longer hands out per-format googlevideo URLs
 * to anonymous clients — every client returns a SABR ("server ABR") streaming
 * response with no direct format URLs. So there is nothing to Range-GET. We use
 * LuanRT's `googlevideo` SABR client to pull the audio track over SABR's POST
 * protocol, gated by a BotGuard "Proof of Origin" token (`bgutils-js`). The audio
 * comes back as a sequential `ReadableStream`; the stream route turns Range
 * requests into "skip N bytes then stream the rest" (see app/api/youtube-stream).
 *
 * Every failure returns null and the caller falls back to a 30s preview.
 */

import vm from "node:vm";
import { Innertube, Platform, UniversalCache } from "youtubei.js";
import type { SabrFormat } from "googlevideo/shared-types";

// Failures here fail soft to null (→ preview), which makes prod issues invisible.
// Log every failure point so the Vercel function logs reveal WHY the tier is dead
// (it works locally — prod breakage is environmental: BotGuard, timeouts, bundling).
const ylog = (...a: unknown[]) => console.error("[youtube]", ...a);

// ---------------------------------------------------------------------------
// JavaScript evaluator for signature/n-param deciphering.
//
// youtubei.js v17 ships a *stub* evaluator that throws — you must provide your
// own (they no longer bundle one). The deciphering of googlevideo URLs (the `n`
// and `sig` params) runs a small slice of YouTube's player JS. We run it in a
// locked-down `node:vm` context. `data.output` is a *function body* (it has
// top-level `return`s), so we wrap it and call the appended `process(n, sp, s)`.
// ---------------------------------------------------------------------------
let evalInstalled = false;
function installEvaluator() {
  if (evalInstalled) return;
  Platform.load({
    ...Platform.shim,
    eval: (data: { output: string }, env: { n?: string; sp?: string; sig?: string }) => {
      const ctx = vm.createContext(Object.create(null));
      (ctx as { __env?: typeof env }).__env = env;
      const script =
        "(function(){" +
        data.output +
        '\n; return process(__env.n||"", __env.sp||"", __env.sig||""); })()';
      return vm.runInContext(script, ctx, { timeout: 5000 });
    },
  });
  evalInstalled = true;
}

// ---------------------------------------------------------------------------
// InnerTube session with a Proof-of-Origin (po) token, cached + auto-refreshed.
// Generating a po token costs a couple of round-trips to Google's BotGuard, so
// we reuse one session for both search and streaming and refresh it every few
// hours (tokens are session-bound to the visitor data).
// ---------------------------------------------------------------------------
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo"; // public web-client BotGuard request key
const SESSION_TTL = 5 * 60 * 60 * 1000; // 5h

interface YtSession {
  yt: InstanceType<typeof Innertube>;
  poToken: string;
  visitorData: string;
  at: number;
}
let cachedSession: YtSession | null = null;
let sessionInflight: Promise<YtSession | null> | null = null;

async function generatePoToken(visitorData: string): Promise<string | null> {
  try {
    const { BG } = await import("bgutils-js");
    const { JSDOM } = await import("jsdom");
    // BotGuard needs a DOM. jsdom provides one; wire it onto globalThis for the
    // duration of generation (BotGuard reads window/document).
    const dom = new JSDOM();
    const g = globalThis as unknown as { window?: unknown; document?: unknown };
    g.window ??= dom.window;
    g.document ??= dom.window.document;

    const bgConfig = {
      fetch: (u: RequestInfo | URL, o?: RequestInit) => fetch(u, o),
      globalObj: globalThis,
      identifier: visitorData,
      requestKey: REQUEST_KEY,
    };
    const challenge = await BG.Challenge.create(bgConfig);
    if (!challenge) return null;
    const interpreterJs =
      challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (interpreterJs) new Function(interpreterJs)();
    const result = await BG.PoToken.generate({
      program: challenge.program,
      globalName: challenge.globalName,
      bgConfig,
    });
    if (!result?.poToken) ylog("poToken generation returned empty");
    return result?.poToken ?? null;
  } catch (e) {
    ylog("poToken generation threw:", (e as Error)?.message || e);
    return null;
  }
}

async function buildSession(): Promise<YtSession | null> {
  installEvaluator();
  try {
    // First a throwaway session just to read the visitor data the po token binds to.
    const seed = await Innertube.create({ retrieve_player: false });
    const visitorData = seed.session.context.client.visitorData;
    if (!visitorData) { ylog("no visitorData from seed session"); return null; }
    const poToken = await generatePoToken(visitorData);
    if (!poToken) { ylog("buildSession: no poToken → session unavailable"); return null; }
    const yt = await Innertube.create({
      po_token: poToken,
      visitor_data: visitorData,
      retrieve_player: true,
      cache: new UniversalCache(false),
    });
    return { yt, poToken, visitorData, at: Date.now() };
  } catch (e) {
    ylog("buildSession threw:", (e as Error)?.message || e);
    return null;
  }
}

async function getSession(force = false): Promise<YtSession | null> {
  if (!force && cachedSession && Date.now() - cachedSession.at < SESSION_TTL) {
    return cachedSession;
  }
  if (sessionInflight) return sessionInflight;
  sessionInflight = (async () => {
    const s = await buildSession();
    if (s) cachedSession = s;
    sessionInflight = null;
    return s;
  })();
  return sessionInflight;
}

// ---------------------------------------------------------------------------
// Search + match — same discipline as src/lib/soundcloud.ts searchSoundCloudTrack:
// exact title/artist, duration match ±4s as the disambiguator, confidence gate,
// reject VARIANT (remix/live/sped/…) results unless the query wants them.
// ---------------------------------------------------------------------------
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const normTrack = (s: string) =>
  norm((s || "").replace(/\s*[\[(]?(feat\.?|ft\.?|with|x)\s[\s\S]*?([\])]|$)/i, "").trim());

// Non-clean uploads we never want when the user didn't ask for them. Note "audio"
// is deliberately absent — "Official Audio" is the *preferred* clean full track.
const VARIANT =
  /\b(remix|live|edit|instrumental|acoustic|demo|cover|karaoke|remaster(ed)?|reprise|extended|sped\s*up|slowed|nightcore|mashup|reverb|8d|loop|teaser|trailer|reaction|dance\s*practice|performance|mv\s*reaction)\b/i;

// Auto-generated artist channels ("… - Topic") are clean, full-length audio.
const isTopic = (author: string) => /\s-\s*topic$/i.test(author || "");
const isVevo = (author: string) => /vevo$/i.test(author || "");

export interface YouTubeAudioMatch {
  videoId: string;
  durationSec: number;
}

/**
 * Search InnerTube for `${artist} ${track}` and pick the best clean full-track
 * match. Prefers auto-generated "… - Topic" channels and "Official Audio", uses
 * duration (±4s) as the disambiguator, and gates on a confident title+artist (or
 * title+duration) pairing so we never play the wrong song. Fails soft to null.
 */
export async function resolveYouTubeAudio(
  track: string,
  artist: string,
  durationSec?: number,
): Promise<YouTubeAudioMatch | null> {
  if (!track) return null;
  const session = await getSession();
  if (!session) { ylog("resolve: no session (BotGuard/PoToken failed) for", track); return null; }

  let results: unknown[];
  try {
    const res = await session.yt.search(`${artist} ${track}`.trim(), { type: "video" });
    results = (res?.results as unknown[]) || [];
  } catch (e) {
    ylog("resolve: search threw:", (e as Error)?.message || e);
    return null;
  }
  if (!results.length) { ylog("resolve: search returned 0 results for", `${artist} ${track}`); return null; }

  const wantTitle = normTrack(track);
  const wantArtist = norm(artist);
  const wantVariant = VARIANT.test(track);

  const FUZZY_MIN = 4;
  const contains = (a: string, b: string) =>
    !!a && !!b && Math.min(a.length, b.length) >= FUZZY_MIN && (a.includes(b) || b.includes(a));

  let best: { id: string; dur: number } | null = null;
  let bestScore = -1;

  for (const r of results) {
    const v = r as {
      type?: string;
      id?: string;
      title?: { text?: string };
      author?: { name?: string };
      duration?: { seconds?: number };
    };
    if (v.type !== "Video" || !v.id) continue;
    const rawTitle = v.title?.text || "";
    const author = v.author?.name || "";
    const vidDur = v.duration?.seconds || 0;
    if (!vidDur) continue; // live / no-duration entries

    // A "… - Topic" author's channel name is the artist; the title is just the
    // track. Otherwise the artist is usually embedded in the title.
    const titleNorm = normTrack(rawTitle);
    const titleRaw = norm(rawTitle);

    const isVariant = VARIANT.test(rawTitle);
    if (isVariant && !wantVariant) continue;

    const titleExact = titleNorm === wantTitle;
    const titleOk = titleExact || contains(titleNorm, wantTitle) || titleRaw.includes(wantTitle);
    if (!titleOk) continue;

    const authorNorm = norm(author);
    const artistExact = !wantArtist || authorNorm === wantArtist || isTopic(author) && contains(authorNorm, wantArtist);
    const artistLoose = !!wantArtist && contains(authorNorm, wantArtist);
    const artistInTitle = wantArtist.length >= 3 && titleRaw.includes(wantArtist);
    const artistMatch = artistExact || artistLoose || artistInTitle;

    const durOk = !!durationSec && Math.abs(vidDur - durationSec) <= 4;

    // Confidence gate — a title match plus any artist signal, or an exact
    // title/artist paired with the right duration. Never play a wrong song.
    const confident =
      (titleOk && artistMatch) || (titleExact && durOk) || (artistMatch && durOk);
    if (!confident) continue;

    let score = 0;
    if (titleExact) score += 3;
    else if (titleOk) score += 1;
    if (artistExact) score += 3;
    else if (artistLoose) score += 2;
    else if (artistInTitle) score += 1;
    if (durOk) score += 3;
    // Prefer clean, full-length sources.
    if (isTopic(author)) score += 3;
    else if (/official\s*audio/i.test(rawTitle)) score += 2;
    else if (isVevo(author) || /official/i.test(rawTitle)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = { id: v.id, dur: vidDur };
    }
  }

  if (!best) { ylog("resolve: no confident match among", results.length, "results for", `${artist} ${track}`); return null; }
  return { videoId: best.id, durationSec: best.dur };
}

// ---------------------------------------------------------------------------
// Audio extraction over SABR.
// ---------------------------------------------------------------------------
export interface YouTubeAudioStream {
  /** A sequential audio-only byte stream (starts at byte 0). */
  stream: ReadableStream<Uint8Array>;
  /** e.g. "audio/mp4" or "audio/webm". */
  mime: string;
  /** Total content length in bytes (for Content-Length / seek-by-skip). */
  contentLength: number;
  /** Full-song duration in seconds. */
  durationSec: number;
}

/**
 * Extract the best audio-only stream for a video via SABR. Prefers itag 140
 * (AAC/mp4 — plays in every browser incl. Safari) and falls back to the best
 * available audio (usually Opus/webm) if the mp4 track won't initialise.
 *
 * NOTE: There is no static "stream URL" to return — YouTube serves SABR only —
 * so unlike the SoundCloud path this returns a live `ReadableStream`. The route
 * (app/api/youtube-stream) runs this fresh per request and proxies the bytes,
 * which also keeps the googlevideo POSTs and the deciphering on one server
 * invocation (avoids IP-binding 403s). Fails soft to null.
 */
export async function getYouTubeAudioStream(
  videoId: string,
): Promise<YouTubeAudioStream | null> {
  if (!videoId) return null;

  const attempt = async (session: YtSession): Promise<YouTubeAudioStream | null> => {
    const { SabrStream } = await import("googlevideo/sabr-stream");
    const { buildSabrFormat } = await import("googlevideo/utils");

    const info = await session.yt.getInfo(videoId);
    const sd = info.streaming_data;
    if (!sd?.server_abr_streaming_url || !sd.adaptive_formats?.length) return null;

    // The ustreamer config authorises the SABR session; it lives in the raw
    // player response (defensively dug out of the parsed page).
    const page = (info as unknown as { page?: unknown[] }).page;
    const cfg = (page?.[0] as {
      player_config?: {
        media_common_config?: {
          media_ustreamer_request_config?: { video_playback_ustreamer_config?: string };
        };
      };
    })?.player_config?.media_common_config?.media_ustreamer_request_config
      ?.video_playback_ustreamer_config;
    if (!cfg) return null;

    // The ABR streaming URL still needs its n-param descrambled.
    const abrUrl = await session.yt.session.player!.decipher(sd.server_abr_streaming_url);
    const formats = sd.adaptive_formats.map((f: unknown) => buildSabrFormat(f as never));
    const durationSec = info.basic_info?.duration || 0;

    const run = async (
      pick: "mp4" | "best",
    ): Promise<YouTubeAudioStream | null> => {
      const sabr = new SabrStream({
        fetch: (u: RequestInfo | URL, o?: RequestInit) => fetch(u, o),
        serverAbrStreamingUrl: abrUrl,
        videoPlaybackUstreamerConfig: cfg,
        poToken: session.poToken,
        clientInfo: {
          clientName: 1,
          clientVersion: session.yt.session.context.client.clientVersion,
        },
        formats,
        durationMs: durationSec * 1000,
      });
      const started = await sabr.start(
        pick === "mp4"
          ? {
              audioFormat: (fs: SabrFormat[]) => fs.find((f) => f.itag === 140),
              enabledTrackTypes: 1 /* AUDIO_ONLY */,
            }
          : { audioQuality: "AUDIO_QUALITY_MEDIUM", enabledTrackTypes: 1 },
      );
      const fmt = started.selectedFormats.audioFormat;
      return {
        stream: started.audioStream,
        mime: (fmt.mimeType || "audio/mp4").split(";")[0].trim(),
        contentLength: Number(fmt.contentLength) || 0,
        durationSec,
      };
    };

    try {
      return await run("mp4");
    } catch {
      return await run("best");
    }
  };

  try {
    const session = await getSession();
    if (!session) { ylog("stream: no session for", videoId); return null; }
    return await attempt(session);
  } catch (e) {
    ylog("stream: first attempt threw, rebuilding session:", (e as Error)?.message || e);
    // A stale po token / expired session throws — rebuild once and retry.
    try {
      const session = await getSession(true);
      if (!session) return null;
      return await attempt(session);
    } catch (e2) {
      ylog("stream: retry threw:", (e2 as Error)?.message || e2);
      return null;
    }
  }
}
