#!/usr/bin/env node
/**
 * load-composer.mjs — concurrency load test for the LinerNotes composer's
 * "open the full song / mark the moments" backend fan-out.
 *
 * When a user opens a song in the composer, the client fires, per user:
 *   1. GET /api/preview?track&artist            (Deezer — returns duration + sourceUrl)
 *   2. GET /api/lyrics?track&artist&duration     (LRCLIB)          ─┐ fired in
 *   3. GET /api/soundcloud-link?track&artist&…   (Odesli + SC api) ─┘ parallel
 *   4. GET /api/youtube-audio?track&artist&…     (SABR/PoToken)  ── FALLBACK ONLY
 *
 * This simulates N virtual users doing that SAME sequence, all at once, and
 * reports per-endpoint latency distribution (p50/p95/p99), error rate, and
 * status-code spread — so you can see whether the resolve pipeline lags under
 * simultaneous load. Full-song AUDIO streams client-side from SC/YT CDNs and is
 * NOT exercised here (it never touches your server).
 *
 * Usage:
 *   node scripts/load-composer.mjs                 # 100 VUs vs beta, no YT fallback
 *   node scripts/load-composer.mjs --n 10          # smoke test, 10 VUs
 *   node scripts/load-composer.mjs --n 100 --youtube   # include the expensive YT resolve
 *   node scripts/load-composer.mjs --n 25 --stream     # + hit the youtube-stream byte-proxy (256KB Range)
 *   node scripts/load-composer.mjs --base http://localhost:3000
 *   node scripts/load-composer.mjs --ramp 5,25,50,100  # staged ramp, safe → hot
 *
 * NOTE: youtube-stream only fires for tracks that fall to the YT tier; tracks that
 * stream on SoundCloud report status -1 "no-yt-match" (expected, not a failure).
 *
 * No dependencies. Requires Node 18+ (global fetch, AbortSignal.timeout).
 */

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

const BASE = (arg("base", "https://beta-linernotes.vercel.app")).replace(/\/$/, "");
const N = Number(arg("n", "100"));
const RAMP = arg("ramp", "") ? arg("ramp", "").split(",").map(Number) : null;
const INCLUDE_YT = has("youtube");
const INCLUDE_STREAM = has("stream"); // exercise /api/youtube-stream byte-proxy
const TIMEOUT_MS = Number(arg("timeout", "30000"));
const STREAM_BYTES = Number(arg("stream-bytes", String(256 * 1024))); // 256KB window

// ── realistic track catalogue ────────────────────────────────────────────────
// Deliberately mixed so the swarm exercises every tier of the resolve ladder:
//  - mainstream / SC-streamable          → happy path
//  - encrypted-Go+ (aespa/NCT)           → SC widget can't play → YT fallback
//  - short/ambiguous names ("3","avatar")→ duration-disambiguation stress
//  - artist-in-title uploads ("DEAN - …")→ matcher edge case
//  - obscure / non-latin                 → LRCLIB + SC misses
const TRACKS = [
  { track: "3", artist: "2hollis" },
  { track: "avatar", artist: "XO" },
  { track: "Lemonade", artist: "aespa" },          // encrypted → YT
  { track: "Breakfast", artist: "NCT 127" },        // encrypted → YT
  { track: "dayfly", artist: "DEAN" },
  { track: "Redbone", artist: "Childish Gambino" },
  { track: "Nights", artist: "Frank Ocean" },
  { track: "Motion Sickness", artist: "Phoebe Bridgers" },
  { track: "Time", artist: "Pink Floyd" },
  { track: "Weird Fishes", artist: "Radiohead" },
  { track: "Гоп-стоп", artist: "Александр Розенбаум" }, // non-latin
  { track: "Marea (we've lost dancing)", artist: "Fred again.." },
  { track: "New Person, Same Old Mistakes", artist: "Tame Impala" },
  { track: "Cranes in the Sky", artist: "Solange" },
  { track: "Godspeed", artist: "Frank Ocean" },
  { track: "Passionfruit", artist: "Drake" },
];

// ── one instrumented request ─────────────────────────────────────────────────
async function hit(label, path, extraHeaders) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      cache: "no-store",
      headers: { "user-agent": "linernotes-loadtest/1.0", ...extraHeaders },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text(); // drain so timing includes full response
    return { label, ms: Date.now() - t0, status: res.status, ok: res.ok, bytes: body.length, body };
  } catch (e) {
    return { label, ms: Date.now() - t0, status: 0, ok: false, error: e.name || String(e) };
  }
}

// ── one virtual user's real composer sequence ────────────────────────────────
async function virtualUser(track, artist) {
  const q = new URLSearchParams({ track, artist });
  const samples = [];

  // 1. preview first — its response feeds duration into the next two calls
  const prev = await hit("preview", `/api/preview?${q}`);
  samples.push(prev);
  let duration;
  try {
    if (prev.ok && prev.body) duration = JSON.parse(prev.body)?.preview?.durationSec;
  } catch { /* best-effort — duration is optional to the downstream routes */ }

  const q2 = new URLSearchParams({ track, artist });
  if (duration) q2.set("duration", String(duration));

  // 2 + 3. lyrics and soundcloud-link fire in parallel, exactly like the app
  const parallel = [
    hit("lyrics", `/api/lyrics?${q2}`),
    hit("soundcloud-link", `/api/soundcloud-link?${q2}`),
  ];
  // --stream implies a youtube-audio resolve (we need its streamUrl / videoId)
  if (INCLUDE_YT || INCLUDE_STREAM) parallel.push(hit("youtube-audio", `/api/youtube-audio?${q2}`));
  const resolved = await Promise.all(parallel);
  samples.push(...resolved);

  // 4. optional: exercise the byte-proxy path (/api/youtube-stream). Only pull a
  //    small Range window so we measure proxy TTFB, not full-file bandwidth.
  if (INCLUDE_STREAM) {
    const yt = resolved.find((s) => s.label === "youtube-audio");
    let streamUrl;
    try { streamUrl = yt?.body && JSON.parse(yt.body)?.youtube?.streamUrl; } catch { /* no match */ }
    if (streamUrl) {
      samples.push(await hit("youtube-stream", streamUrl, { Range: `bytes=0-${STREAM_BYTES - 1}` }));
    } else {
      samples.push({ label: "youtube-stream", ms: 0, status: -1, ok: false, error: "no-yt-match" });
    }
  }

  return samples;
}

// ── stats ────────────────────────────────────────────────────────────────────
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p / 100 * sorted.length) - 1)] : 0;

function summarize(all) {
  const byLabel = {};
  for (const s of all) (byLabel[s.label] ??= []).push(s);

  console.log(`\n${"─".repeat(78)}`);
  console.log(`endpoint          n    ok   err   p50    p95    p99    max    statuses`);
  console.log(`${"─".repeat(78)}`);
  for (const [label, arr] of Object.entries(byLabel)) {
    const lat = arr.map((s) => s.ms).sort((a, b) => a - b);
    const ok = arr.filter((s) => s.ok).length;
    const err = arr.length - ok;
    const codes = {};
    for (const s of arr) codes[s.status] = (codes[s.status] || 0) + 1;
    const codeStr = Object.entries(codes).map(([c, n]) => `${c}:${n}`).join(" ");
    console.log(
      `${label.padEnd(16)} ${String(arr.length).padStart(3)} ${String(ok).padStart(5)} ${String(err).padStart(5)}` +
      ` ${String(pct(lat, 50)).padStart(6)} ${String(pct(lat, 95)).padStart(6)} ${String(pct(lat, 99)).padStart(6)} ${String(lat[lat.length - 1]).padStart(6)}   ${codeStr}`
    );
  }
  console.log(`${"─".repeat(78)}  (latency in ms)\n`);
}

// ── run one wave of `n` concurrent virtual users ─────────────────────────────
async function wave(n) {
  console.log(`\n▶ firing ${n} concurrent virtual users at ${BASE}${INCLUDE_YT ? "  [+youtube]" : ""}`);
  const t0 = Date.now();
  const vus = Array.from({ length: n }, (_, i) => {
    const { track, artist } = TRACKS[i % TRACKS.length];
    return virtualUser(track, artist).catch((e) => [{ label: "FATAL", ms: 0, status: 0, ok: false, error: String(e) }]);
  });
  const results = (await Promise.all(vus)).flat();
  const wallSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  wall time: ${wallSec}s for ${n} users × ${results.length / n | 0} calls each`);
  summarize(results);
  return results;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`LinerNotes composer load test`);
  console.log(`target: ${BASE}`);
  if (RAMP) {
    console.log(`ramp:   ${RAMP.join(" → ")} concurrent users`);
    for (const step of RAMP) {
      await wave(step);
      await new Promise((r) => setTimeout(r, 2000)); // breathe between waves
    }
  } else {
    await wave(N);
  }
})();
