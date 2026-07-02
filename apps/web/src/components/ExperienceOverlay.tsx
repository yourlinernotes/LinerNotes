"use client";

/**
 * The immersive Experience — web parity with the mobile ExperienceScreen.
 *
 * Full-screen album-colour flood + in-app playback + karaoke-style synced
 * lyrics with the author's moment-notes interleaved. Playback engine:
 *  - SoundCloud HTML5 Widget (full track, real ms position) when resolvable
 *  - a 30s browser-playable preview (Deezer MP3) as the fallback
 * Lyrics come from LRCLIB via /api/lyrics; SoundCloud ids from /api/soundcloud-link.
 *
 * For a single-track review it opens straight into the track experience. For an
 * album/playlist it shows the tracklist; tapping a track opens that track's
 * experience (its preview + synced lyrics + its moment notes).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ReviewVM, MomentVM } from "@/lib/view-adapter";

// --- Inlined sync engine (web doesn't wire in @linernotes/core). Keep in step
// with packages/core/src/sync-engine.ts. -----------------------------------
type LyricLine = { timeMs: number; text: string };
const TAG_RE = /\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g;
function parseLrc(lrc: string): LyricLine[] {
  if (!lrc) return [];
  return lrc
    .split("\n")
    .flatMap((raw) => {
      const tags = [...raw.matchAll(TAG_RE)];
      if (!tags.length) return [];
      const text = raw.replace(TAG_RE, "").trim();
      return tags.map((m) => {
        const [, mm, ss, frac = "0"] = m;
        const ms = (+mm * 60 + +ss) * 1000 + Math.round(+`0.${frac}` * 1000);
        return { timeMs: ms, text };
      });
    })
    .sort((a, b) => a.timeMs - b.timeMs);
}
function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0,
    hi = lines.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

type LyricsResult = { syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean };

declare global {
  interface Window {
    SC?: any;
  }
}

const SC_API = "https://w.soundcloud.com/player/api.js";
let scApiLoading: Promise<void> | null = null;
function loadScApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.SC) return Promise.resolve();
  if (scApiLoading) return scApiLoading;
  scApiLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SC_API;
    s.async = true;
    s.onload = () => resolve();
    document.body.appendChild(s);
  });
  return scApiLoading;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const normName = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

type Source = "soundcloud" | "preview" | "none";
type Palette = ReviewVM["album"]["palette"];

/** What a single track experience needs, independent of album vs single-track. */
interface Subject {
  track: string;
  artist: string;
  artworkUrl?: string | null;
  notes: MomentVM[];
  /** Optional lead line rendered as an italic pull-quote (the review's take). */
  quote?: string;
  /** Optional body copy (a per-track note or the rest of the take). */
  body?: string;
  /** A pre-resolved browser-playable preview (from the album finder). */
  presetPreviewUrl?: string | null;
  /** A pre-resolved source URL (Deezer/iTunes) → Odesli → the full SoundCloud song. */
  presetSourceUrl?: string | null;
  /** A directly-resolved SoundCloud track id (from the auto-found album set). */
  presetScId?: string | null;
  /** A source URL / id Odesli can turn into a SoundCloud link. */
  extId?: string | null;
}

const stripTrackNo = (s: string) => (s || "").replace(/^\s*\d+\s*[-.)]\s*/, "");

export function ExperienceOverlay({ review, onClose }: { review: ReviewVM; onClose: () => void }) {
  const { album } = review;
  const p = album.palette;
  const isCollection = album.kind === "album" || album.kind === "playlist";

  // Album/playlist: resolve the real tracklist's previews once (album-scoped).
  type PMEntry = { previewUrl: string; sourceUrl: string | null; durationSec: number | null };
  const [previewMap, setPreviewMap] = useState<Record<string, PMEntry>>({});
  type ScTrack = { id: string; title: string | null; durationSec?: number | null };
  const [scAlbumTracks, setScAlbumTracks] = useState<ScTrack[]>([]);

  // Auto-find the album's SoundCloud set (keyless, no user input needed).
  useEffect(() => {
    if (!isCollection) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ album: album.title, artist: album.artist });
        const r = await fetch(`/api/soundcloud-album?${q}`);
        const d = r.ok ? await r.json() : null;
        if (!cancelled && d?.album?.tracks?.length) setScAlbumTracks(d.album.tracks);
      } catch { /* no-op — per-track Odesli fallback still applies */ }
    })();
    return () => { cancelled = true; };
  }, [isCollection, album.title, album.artist]);

  useEffect(() => {
    if (!isCollection) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ album: album.title, artist: album.artist });
        const r = await fetch(`/api/album-previews?${q}`);
        const d = r.ok ? await r.json() : null;
        const tracks: Array<{ name: string; previewUrl: string; sourceUrl?: string | null; durationSec?: number | null }> =
          d?.album?.tracks || [];
        if (cancelled || !tracks.length) return;
        const map: Record<string, PMEntry> = {};
        for (const t of tracks) map[normName(t.name)] = { previewUrl: t.previewUrl, sourceUrl: t.sourceUrl ?? null, durationSec: t.durationSec ?? null };
        setPreviewMap(map);
      } catch {
        /* per-track /api/preview fallback still applies */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCollection, album.title, album.artist]);

  // Which track (index into album.tracks) is being experienced; null = the list.
  const [selected, setSelected] = useState<number | null>(null);

  const subject: Subject | null = useMemo(() => {
    if (!isCollection) {
      // Single-track review: the release title IS the track.
      const take = review.take || "";
      const firstLine = take.split("\n")[0];
      const rest = take.split("\n").slice(1).join("\n").trim();
      return {
        track: album.title,
        artist: album.artist,
        artworkUrl: album.artworkUrl,
        notes: review.notes || [],
        quote: firstLine || undefined,
        body: [rest, review.body].filter(Boolean).join("\n\n") || undefined,
        presetPreviewUrl: null,
        extId: album.extId,
      };
    }
    if (selected == null) return null;
    const t = album.tracks[selected];
    if (!t) return null;
    const pm = previewMap[normName(t.name)];
    // Match this track to its SoundCloud id from the auto-found set.
    // Strip leading track numbers ("01.", "1 -", "8- " etc.) before comparing.
    const wantNorm = normName(stripTrackNo(t.name));
    const wantDur = pm?.durationSec ?? null;
    const scNorm = (s: ScTrack) => normName(stripTrackNo(s.title || ""));
    const scHit: ScTrack | undefined =
      // 1. Exact title match.
      scAlbumTracks.find((s) => scNorm(s) === wantNorm) ||
      // 2. Substring match — but guard against empty/short strings, else a stub
      //    with a blank title matches everything ("mattress".includes("") is true).
      scAlbumTracks.find((s) => {
        const sn = scNorm(s);
        return sn.length >= 3 && wantNorm.length >= 3 && (sn.includes(wantNorm) || wantNorm.includes(sn));
      }) ||
      // 3. Duration match (from the Deezer preview) — disambiguates when titles differ.
      scAlbumTracks.find(
        (s) => wantDur != null && s.durationSec != null && Math.abs(s.durationSec - wantDur) <= 4,
      ) ||
      // 4. Index fallback — ONLY when the two tracklists are the same length, so a
      //    1:1 positional map is safe. Otherwise no full song (→ preview) beats a
      //    wrong song.
      (scAlbumTracks.length === album.tracks.length ? scAlbumTracks[selected] : undefined);
    return {
      track: t.name,
      artist: album.artist,
      artworkUrl: album.artworkUrl,
      notes: t.moments || [],
      body: t.review || undefined,
      presetPreviewUrl: pm?.previewUrl || null,
      presetSourceUrl: pm?.sourceUrl || null,
      presetScId: scHit?.id ?? null,
      extId: null,
    };
  }, [isCollection, selected, album, review.take, review.body, review.notes, previewMap, scAlbumTracks]);

  const backToList = isCollection && selected != null ? () => setSelected(null) : null;
  // Next/prev track navigation within an album/playlist.
  const trackCount = album.tracks.length;
  const goPrev =
    isCollection && selected != null && selected > 0 ? () => setSelected(selected - 1) : null;
  const goNext =
    isCollection && selected != null && selected < trackCount - 1 ? () => setSelected(selected + 1) : null;

  return (
    <div style={S.overlay}>
      <style>{KEYFRAMES}</style>
      <div style={{ ...S.flood, background: `linear-gradient(155deg, ${p.mid} 0%, ${p.deep} 60%, ${p.lo} 100%)` }} />
      <div style={{ ...S.floodGlow, background: `radial-gradient(circle at 78% 78%, ${p.glow}cc, transparent 60%)` }} />
      <div style={{ ...S.floodGlow, background: `radial-gradient(circle at 14% 88%, ${p.accent}55, transparent 55%)` }} />
      <div style={S.darken} />

      <div style={S.topBar}>
        <button onClick={backToList || onClose} style={S.closeBtn} aria-label={backToList ? "Back" : "Close"}>
          {backToList ? "‹" : "✕"}
        </button>
        <span style={S.expLabel}>the experience</span>
        {isCollection && selected != null ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={goPrev || undefined} disabled={!goPrev} style={{ ...S.navBtn, opacity: goPrev ? 1 : 0.3 }} aria-label="Previous track">
              ‹
            </button>
            <button onClick={goNext || undefined} disabled={!goNext} style={{ ...S.navBtn, opacity: goNext ? 1 : 0.3 }} aria-label="Next track">
              ›
            </button>
          </div>
        ) : (
          <span style={{ width: 34 }} />
        )}
      </div>

      {subject ? (
        <TrackExperience key={selected ?? "single"} subject={subject} palette={p} />
      ) : (
        <AlbumList album={album} previewMap={previewMap} onPick={setSelected} />
      )}
    </div>
  );
}

// ===========================================================================
// Album / playlist tracklist — pick a track to experience it
// ===========================================================================

function AlbumList({
  album,
  previewMap,
  onPick,
}: {
  album: ReviewVM["album"];
  previewMap: Record<string, { previewUrl: string; sourceUrl: string | null }>;
  onPick: (i: number) => void;
}) {
  return (
    <div style={S.scroll}>
      <div style={S.content}>
        <div style={S.cover}>
          {album.artworkUrl ? (
            <img src={album.artworkUrl} alt={album.title} style={S.coverImg} />
          ) : (
            <div style={{ ...S.coverImg, ...S.coverPlaceholder }}>{album.title?.toLowerCase()}</div>
          )}
        </div>
        <h1 style={S.title}>{album.title}</h1>
        <div style={S.artist}>{album.artist}</div>
        <div style={{ ...S.sectionLabel, marginTop: 24, alignSelf: "flex-start" }}>
          {album.kind === "playlist" ? "playlist" : "tracks"} · tap to play
        </div>
        <div style={{ width: "100%", marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {album.tracks.map((t, i) => {
            const has = !!previewMap[normName(t.name)];
            const mc = t.moments?.length || 0;
            return (
              <button key={t.n} onClick={() => onPick(i)} style={S.trackRow}>
                <span style={S.trackNum}>{String(t.n).padStart(2, "0")}</span>
                <span style={S.trackName}>{t.name}</span>
                {t.reaction && <span style={S.trackTag}>{t.reaction}</span>}
                {mc > 0 && <span style={S.trackMoments}>{mc} ✎</span>}
                <span style={{ ...S.trackPlay, opacity: has ? 1 : 0.4 }}>►</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TrackExperience — playback + synced lyrics for one track
// ===========================================================================

function TrackExperience({ subject, palette }: { subject: Subject; palette: Palette }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(subject.presetPreviewUrl ?? null);
  const [previewSourceUrl, setPreviewSourceUrl] = useState<string | null>(subject.presetSourceUrl ?? null);
  const [scTrackId, setScTrackId] = useState<string | null>(subject.presetScId ?? null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const source: Source = scTrackId ? "soundcloud" : previewUrl ? "preview" : "none";
  // Lyrics/moment timestamps are FULL-SONG times, so real sync only works on the
  // full song. A 30s preview is a random clip — never fake-sync against it.
  const synced = source === "soundcloud";

  // Lyric translation (keyless, on-demand) — a second text track at the same times.
  const [translations, setTranslations] = useState<string[] | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  const syncedLines = useMemo(
    () => (lyrics?.syncedLyrics ? parseLrc(lyrics.syncedLyrics) : []),
    [lyrics?.syncedLyrics],
  );
  const activeIdx = useMemo(
    () => (syncedLines.length ? activeLineIndex(syncedLines, positionMs) : -1),
    [syncedLines, positionMs],
  );
  // A moment stays on screen for the duration of the lyric line(s) it sits on
  // (plus a slight tail so it doesn't vanish the instant the line ends), when
  // lyrics are synced. It's capped at the next moment so they never overlap, and
  // has a small floor so a very short line doesn't just flash.
  const MOMENT_TAIL_MS = 1400; // "or slightly longer"
  const MOMENT_MIN_MS = 2500;
  const activeMoment = useMemo(() => {
    if (!synced || !subject.notes.length) return null;
    const sorted = [...subject.notes].sort((a, b) => a.sec - b.sec);
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i].sec * 1000;
      const nextMoment = i + 1 < sorted.length ? sorted[i + 1].sec * 1000 : Infinity;

      // End = when the anchored lyric line ends (the next line begins). If we
      // have no synced lines or this is the last line, fall back to the floor.
      let end: number;
      if (syncedLines.length) {
        const li = Math.max(0, activeLineIndex(syncedLines, start));
        const lineEnd = syncedLines[li + 1]?.timeMs ?? (durationMs || start + MOMENT_MIN_MS);
        end = lineEnd + MOMENT_TAIL_MS;
      } else {
        end = start + MOMENT_MIN_MS;
      }
      end = Math.max(end, start + MOMENT_MIN_MS); // floor
      end = Math.min(end, nextMoment); // never overlap the next moment

      if (positionMs >= start && positionMs < end) return sorted[i];
    }
    return null;
  }, [subject.notes, positionMs, synced, syncedLines, durationMs]);

  // Resolve preview (unless preset), lyrics, and a SoundCloud id.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { track, artist } = subject;
      let durationSec: number | undefined;
      // Prefer a preset source URL (album finder) so album tracks resolve the
      // full SoundCloud song even when we already have their preview.
      let odesliSourceUrl: string | null = subject.presetSourceUrl ?? null;

      if (!subject.presetPreviewUrl) {
        try {
          const q = new URLSearchParams({ track, artist });
          const r = await fetch(`/api/preview?${q}`);
          if (r.ok) {
            const { preview } = await r.json();
            if (preview && !cancelled) {
              setPreviewUrl(preview.previewUrl);
              if (preview.durationSec) durationSec = preview.durationSec;
              if (!odesliSourceUrl) odesliSourceUrl = preview.sourceUrl || null;
              if (preview.sourceUrl && !cancelled) setPreviewSourceUrl(preview.sourceUrl);
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      setLyricsLoading(true);
      try {
        const q = new URLSearchParams({ track, artist });
        if (durationSec) q.set("duration", String(durationSec));
        const r = await fetch(`/api/lyrics?${q}`);
        const d = r.ok ? await r.json() : null;
        if (!cancelled) setLyrics(d?.lyrics ?? null);
      } catch {
        if (!cancelled) setLyrics(null);
      }
      if (!cancelled) setLyricsLoading(false);

      // Skip Odesli resolution when we already have a direct SC track id.
      if (!subject.presetScId) {
        try {
          const q = new URLSearchParams({ track, artist });
          if (durationSec) q.set("duration", String(durationSec));
          if (odesliSourceUrl) q.set("url", odesliSourceUrl);
          else if (subject.extId) {
            q.set("id", subject.extId);
            q.set("platform", "itunes");
          }
          const r = await fetch(`/api/soundcloud-link?${q}`);
          const d = r.ok ? await r.json() : null;
          if (!cancelled && d?.soundcloud?.trackId) setScTrackId(d.soundcloud.trackId);
        } catch {
          /* preview fallback */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.track, subject.artist, subject.presetPreviewUrl, subject.presetSourceUrl, subject.presetScId, subject.extId]);

  // SoundCloud widget
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<any>(null);
  // True once the track itself is actually advancing. Until then, an ad-supported
  // track may be playing SoundCloud's ad first — we show a heads-up, not silence.
  const [scStarted, setScStarted] = useState(false);
  useEffect(() => {
    if (source !== "soundcloud" || !scTrackId) return;
    let disposed = false;
    setScStarted(false);
    // Long safety net: an ad-supported track plays SoundCloud's ad first (~15-30s)
    // then the song, so we wait it out. Only if nothing has advanced after a
    // generous grace (Go+/encrypted or geo-locked tracks that never stream) do we
    // drop to the preview. Ads finishing set `progressed`, so this won't fire.
    let progressed = false;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    loadScApi().then(() => {
      if (disposed || !iframeRef.current || !window.SC) return;
      const w = window.SC.Widget(iframeRef.current);
      widgetRef.current = w;
      const E = window.SC.Widget.Events;
      w.bind(E.READY, () => w.getDuration((d: number) => setDurationMs(d || 0)));
      w.bind(E.PLAY_PROGRESS, (e: any) => {
        if ((e.currentPosition || 0) > 0) {
          progressed = true;
          setScStarted(true);
        }
        setPositionMs(e.currentPosition || 0);
      });
      w.bind(E.PLAY, () => {
        setPlaying(true);
        if (stuckTimer) clearTimeout(stuckTimer);
        stuckTimer = setTimeout(() => {
          if (!disposed && !progressed) setScTrackId(null); // never streamed → preview
        }, 45000);
      });
      w.bind(E.PAUSE, () => setPlaying(false));
      w.bind(E.FINISH, () => setPlaying(false));
      w.bind(E.ERROR, () => setScTrackId(null));
    });
    return () => {
      disposed = true;
      if (stuckTimer) clearTimeout(stuckTimer);
      widgetRef.current = null;
    };
  }, [source, scTrackId]);

  // Preview audio (fallback)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (source !== "preview" || !previewUrl) return;
    const a = new Audio(previewUrl);
    audioRef.current = a;
    const onTime = () => setPositionMs(a.currentTime * 1000);
    const onMeta = () => setDurationMs((a.duration || 0) * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
      audioRef.current = null;
    };
  }, [source, previewUrl]);

  const toggle = useCallback(() => {
    if (source === "soundcloud") widgetRef.current?.toggle();
    else if (source === "preview" && audioRef.current) {
      if (audioRef.current.paused) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
  }, [source]);

  const seekTo = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, ms);
      if (source === "soundcloud") widgetRef.current?.seekTo(clamped);
      else if (audioRef.current) audioRef.current.currentTime = clamped / 1000;
    },
    [source],
  );

  // Auto-scroll the active line — but ONLY within the lyrics pane, never the
  // whole overlay (scrollIntoView(block:center) yanks the page). Only when synced.
  const activeRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!synced || activeIdx < 0) return;
    const pane = paneRef.current;
    const line = activeRef.current;
    if (!pane || !line) return;
    // Measure against the pane via getBoundingClientRect — offsetTop is relative
    // to the nearest positioned ancestor (not necessarily the pane), which made
    // the scroll target wrong and the pane jump around.
    const paneRect = pane.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const delta = lineRect.top - paneRect.top - pane.clientHeight * 0.4 + lineRect.height / 2;
    if (Math.abs(delta) < 6) return; // ignore sub-pixel churn to keep it calm
    pane.scrollTo({ top: pane.scrollTop + delta, behavior: "smooth" });
  }, [activeIdx, synced]);

  const notesByLine = useMemo(() => {
    const map: Record<number, MomentVM[]> = {};
    if (!syncedLines.length || !subject.notes.length) return map;
    for (const n of subject.notes) {
      const nMs = n.sec * 1000;
      let idx = 0;
      for (let i = 0; i < syncedLines.length; i++) {
        if (syncedLines[i].timeMs <= nMs) idx = i;
        else break;
      }
      (map[idx] ||= []).push(n);
    }
    return map;
  }, [syncedLines, subject.notes]);

  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  useEffect(() => {
    const { track, artist, extId = "" } = subject;
    if (/^[A-Za-z0-9]{22}$/.test(extId || "")) {
      setSpotifyUrl(`https://open.spotify.com/track/${extId}`);
      return;
    }
    // Resolve after the preview loads so we have a sourceUrl for Odesli.
    if (!previewSourceUrl) return;
    let cancelled = false;
    const params = new URLSearchParams({ id: extId || "", kind: "track", title: track, artist, sourceUrl: previewSourceUrl });
    fetch(`/api/spotify-link?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d?.url) setSpotifyUrl(d.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [subject.track, subject.artist, subject.extId, previewSourceUrl]);

  const openSpotify = () => {
    const { track, artist } = subject;
    const dest = spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${track} ${artist}`.trim())}`;
    window.open(dest, "_blank", "noopener");
  };

  // Share a specific annotated moment (its note + the lyric line it sits on).
  const [shared, setShared] = useState(false);
  const shareMoment = async (note: MomentVM) => {
    const text = `"${note.note}" — ${subject.track} by ${subject.artist} @ ${fmt(note.sec * 1000)}`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "LinerNotes", text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShared(true);
        setTimeout(() => setShared(false), 1600);
      }
    } catch {
      /* user cancelled */
    }
  };

  const toggleTranslation = async () => {
    if (translations) {
      setShowTranslation((v) => !v);
      return;
    }
    if (!syncedLines.length) return;
    setTranslating(true);
    setShowTranslation(true);
    try {
      const r = await fetch("/api/lyric-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: syncedLines.map((l) => l.text), target: "en" }),
      });
      const d = r.ok ? await r.json() : null;
      setTranslations(d?.translations?.length ? d.translations : null);
    } catch {
      setTranslations(null);
    } finally {
      setTranslating(false);
    }
  };

  const pct = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const onScrub = (e: React.MouseEvent) => {
    const el = scrubRef.current;
    if (!el || durationMs <= 0) return;
    const rect = el.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * durationMs);
  };

  return (
    <>
      {source === "soundcloud" && scTrackId && (
        <iframe
          ref={iframeRef}
          title="sc"
          allow="autoplay"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
            "https://api.soundcloud.com/tracks/" + scTrackId,
          )}&auto_play=false&visual=false&show_artwork=false&buying=false&sharing=false&download=false&show_comments=false`}
        />
      )}

      <div style={S.scroll}>
        <div style={S.content}>
          <div onClick={openSpotify} style={S.cover}>
            {subject.artworkUrl ? (
              <img src={subject.artworkUrl} alt={subject.track} style={S.coverImg} />
            ) : (
              <div style={{ ...S.coverImg, ...S.coverPlaceholder }}>{subject.track?.toLowerCase()}</div>
            )}
          </div>

          <h1 style={S.title}>{subject.track}</h1>
          <div style={S.artist}>{subject.artist}</div>

          {previewUrl || scTrackId ? (
            <div style={S.playbackBar}>
              <div style={S.playbackRow}>
                <button onClick={toggle} style={S.playBtn} aria-label={playing ? "Pause" : "Play"}>
                  {playing ? "❚❚" : "►"}
                </button>
                <div style={{ flex: 1 }}>
                  <div ref={scrubRef} onClick={onScrub} style={S.scrubTrack}>
                    <div style={{ ...S.scrubFill, width: `${pct * 100}%` }} />
                    {synced &&
                      durationMs > 0 &&
                      subject.notes.map((n, i) => {
                        const on = activeMoment === n;
                        return (
                          <span
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              seekTo(n.sec * 1000);
                            }}
                            title={n.note}
                            style={{
                              ...S.scrubMarker,
                              left: `${Math.min(1, (n.sec * 1000) / durationMs) * 100}%`,
                              width: on ? 13 : 9,
                              height: on ? 13 : 9,
                              background: on ? "var(--ln-accent)" : "rgba(240,226,204,0.6)",
                              boxShadow: on ? "0 0 8px var(--ln-accent)" : "none",
                            }}
                          />
                        );
                      })}
                    <span style={{ ...S.scrubKnob, left: `${pct * 100}%` }} />
                  </div>
                  <div style={S.scrubTimes}>
                    <span>{fmt(positionMs)}</span>
                    <span>{durationMs ? fmt(durationMs) : "--:--"}</span>
                  </div>
                </div>
              </div>
              <div style={S.playbackMeta}>
                <span style={S.sourceBadge}>{synced ? "full song · soundcloud" : "preview · 0:30"}</span>
                <button onClick={openSpotify} style={S.openSpotify}>
                  open in spotify ↗
                </button>
              </div>
              {source === "soundcloud" && playing && !scStarted && (
                <div style={S.adNote}>
                  ♪ soundcloud is playing a short ad — your track starts right after.
                </div>
              )}
              {!synced && (syncedLines.length > 0 || subject.notes.length > 0) && (
                <div style={S.previewNote}>
                  playing a 30s preview — the full song wasn’t found on SoundCloud, so lyrics &amp; moments
                  aren’t synced to this clip.
                </div>
              )}
            </div>
          ) : (
            <button onClick={openSpotify} style={S.spotifyBtn}>
              Open in Spotify
            </button>
          )}

          <div style={S.calloutSlot}>
            {activeMoment && (
              <div key={activeMoment.sec} style={S.callout}>
                <span style={S.calloutTime}>{fmt(activeMoment.sec * 1000)}</span>
                <span style={S.calloutDivider} />
                <span style={S.calloutText}>
                  {activeMoment.label ? `${activeMoment.label} — ` : ""}
                  {activeMoment.note}
                </span>
                <button onClick={() => shareMoment(activeMoment)} style={S.calloutShare} aria-label="Share moment">
                  {shared ? "copied" : "share ⤴"}
                </button>
              </div>
            )}
          </div>

          {subject.quote && <div style={S.quote}>&ldquo;{subject.quote}&rdquo;</div>}
          {subject.body && <div style={S.body}>{subject.body}</div>}

          {/* When not synced, the moments can't ride the clock — show them as a
              static list (still the author's notes, just not seekable). */}
          {!synced && subject.notes.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionLabel}>the moment{subject.notes.length > 1 ? "s" : ""}</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {subject.notes.map((n, i) => (
                  <div key={i} style={S.staticNote}>
                    <span style={S.inlineNoteTime}>{fmt(n.sec * 1000)}</span>
                    <span style={S.inlineNoteText}>{n.note}</span>
                    <button onClick={() => shareMoment(n)} style={S.inlineShare} aria-label="Share moment">
                      ⤴
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <LyricsBlock
            loading={lyricsLoading}
            lyrics={lyrics}
            lines={syncedLines}
            activeIdx={activeIdx}
            activeRef={activeRef}
            paneRef={paneRef}
            synced={synced}
            notesByLine={notesByLine}
            onSeek={seekTo}
            hasAudio={!!(previewUrl || scTrackId)}
            translations={showTranslation ? translations : null}
            translating={translating}
            onToggleTranslation={toggleTranslation}
            showTranslation={showTranslation}
            onShare={shareMoment}
          />
        </div>
      </div>
    </>
  );
}

function LyricsBlock({
  loading,
  lyrics,
  lines,
  activeIdx,
  activeRef,
  paneRef,
  synced,
  notesByLine,
  onSeek,
  hasAudio,
  translations,
  translating,
  onToggleTranslation,
  showTranslation,
  onShare,
}: {
  loading: boolean;
  lyrics: LyricsResult | null;
  lines: LyricLine[];
  activeIdx: number;
  activeRef: React.RefObject<HTMLDivElement | null>;
  paneRef: React.RefObject<HTMLDivElement | null>;
  synced: boolean;
  notesByLine: Record<number, MomentVM[]>;
  onSeek: (ms: number) => void;
  hasAudio: boolean;
  translations: string[] | null;
  translating: boolean;
  onToggleTranslation: () => void;
  showTranslation: boolean;
  onShare: (note: MomentVM) => void;
}) {
  if (loading)
    return (
      <div style={S.section}>
        <div style={S.sectionLabel}>lyrics</div>
        <div style={S.lyricsStatus}>finding the words…</div>
      </div>
    );
  if (!lyrics || (lyrics.instrumental && !lyrics.plainLyrics)) {
    if (lyrics?.instrumental)
      return (
        <div style={S.section}>
          <div style={S.sectionLabel}>lyrics</div>
          <div style={S.lyricsStatus}>instrumental — no words to follow.</div>
        </div>
      );
    return null;
  }

  if (lines.length) {
    return (
      <div style={S.section}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={S.sectionLabel}>lyrics</div>
          <button onClick={onToggleTranslation} style={S.translateBtn}>
            {translating ? "translating…" : showTranslation ? "show original" : "translate ⇄"}
          </button>
        </div>
        <div style={S.lyricsHint}>
          {synced
            ? "it follows the song — click any line to jump there."
            : "connect the full song for synced, tappable lyrics."}
        </div>
        <div ref={paneRef} style={S.lyricsPane}>
          {lines.map((ln, idx) => {
            const isActive = synced && idx === activeIdx;
            const distance = Math.abs(idx - activeIdx);
            const opacity = !synced ? 0.85 : activeIdx < 0 ? 0.8 : isActive ? 1 : Math.max(0.3, 1 - distance * 0.12);
            // On a preview, note timestamps don't match the clip — don't interleave.
            const lineNotes = synced ? notesByLine[idx] : undefined;
            const translated = translations?.[idx];
            return (
              <div key={idx} ref={isActive ? activeRef : undefined} style={{ opacity }}>
                <div
                  onClick={synced ? () => onSeek(ln.timeMs) : undefined}
                  style={{
                    ...S.lyricLine,
                    fontSize: isActive ? 22 : 18,
                    color: isActive ? "var(--ln-fg, #f1ebe0)" : "rgba(241,235,224,0.6)",
                    fontFamily: isActive ? "var(--ln-display, var(--ln-body))" : "var(--ln-body)",
                    cursor: synced ? "pointer" : "default",
                  }}
                >
                  {ln.text || "♪"}
                  {lineNotes && !isActive && <span style={S.lyricBadge}>❝ note</span>}
                </div>
                {translated && ln.text ? (
                  <div style={S.translationLine}>
                    <span style={{ opacity: 0.5 }}>↳</span> {translated}
                  </div>
                ) : null}
                {lineNotes?.map((n, j) => (
                  <div key={j} style={S.inlineNote}>
                    <span style={S.inlineNoteTime} onClick={() => onSeek(n.sec * 1000)}>
                      {fmt(n.sec * 1000)}
                    </span>
                    <span style={S.inlineNoteText} onClick={() => onSeek(n.sec * 1000)}>
                      {n.note}
                    </span>
                    <button onClick={() => onShare(n)} style={S.inlineShare} aria-label="Share moment">
                      ⤴
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (lyrics.plainLyrics)
    return (
      <div style={S.section}>
        <div style={S.sectionLabel}>lyrics</div>
        <div style={{ ...S.lyricsPane, whiteSpace: "pre-wrap" }}>
          <div style={{ ...S.lyricLine, color: "rgba(241,235,224,0.8)", fontSize: 16 }}>{lyrics.plainLyrics}</div>
        </div>
      </div>
    );
  return null;
}

const KEYFRAMES = `
  @keyframes ln-breathe { 0%,100% { transform: scale(1.06); } 50% { transform: scale(1.15); } }
  @keyframes ln-exp-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes ln-pop-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
  @keyframes ln-note-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
`;

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "var(--ln-bg, #0a0908)",
    overflow: "hidden",
    animation: "ln-exp-in 0.34s cubic-bezier(.2,.8,.2,1)",
  },
  flood: { position: "absolute", inset: -80, animation: "ln-breathe 10.4s ease-in-out infinite" },
  floodGlow: { position: "absolute", inset: -80, opacity: 0.55 },
  darken: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(8,7,6,0.35) 0%, rgba(8,7,6,0.15) 32%, rgba(8,7,6,0.82) 100%)",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    background: "rgba(241,235,224,0.08)",
    border: "1px solid rgba(241,235,224,0.14)",
    color: "#f1ebe0",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
  },
  expLabel: { fontFamily: "var(--ln-mono)", fontSize: 11, letterSpacing: "0.08em", color: "rgba(241,235,224,0.65)" },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    background: "rgba(241,235,224,0.08)",
    border: "1px solid rgba(241,235,224,0.14)",
    color: "#f1ebe0",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  },
  previewNote: {
    fontFamily: "var(--ln-body)",
    fontSize: 11.5,
    fontStyle: "italic",
    color: "rgba(241,235,224,0.5)",
    marginTop: 10,
    lineHeight: 1.4,
  },
  adNote: {
    fontFamily: "var(--ln-mono)",
    fontSize: 11,
    color: "var(--ln-accent)",
    marginTop: 10,
    lineHeight: 1.4,
    animation: "ln-note-in 0.3s ease",
  },
  staticNote: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(241,235,224,0.1)",
    background: "rgba(241,235,224,0.03)",
  },
  scroll: { position: "absolute", inset: 0, overflowY: "auto", padding: "84px 0 80px" },
  content: { maxWidth: 560, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center" },
  cover: { width: 200, height: 200, borderRadius: 14, overflow: "hidden", cursor: "pointer", boxShadow: "0 32px 70px -28px rgba(0,0,0,0.9)" },
  coverImg: { width: "100%", height: "100%", objectFit: "cover" },
  coverPlaceholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(241,235,224,0.08)",
    fontFamily: "var(--ln-mono)",
    fontSize: 12,
    color: "rgba(241,235,224,0.4)",
    textAlign: "center",
  },
  title: {
    margin: "20px 0 0",
    fontFamily: "var(--ln-display, var(--ln-body))",
    fontWeight: 600,
    fontSize: 28,
    color: "#f1ebe0",
    textAlign: "center",
    letterSpacing: "-0.01em",
  },
  artist: { marginTop: 5, fontFamily: "var(--ln-body)", fontSize: 16, color: "rgba(241,235,224,0.72)" },
  // Tracklist
  trackRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(241,235,224,0.08)",
    background: "rgba(241,235,224,0.03)",
    color: "#f1ebe0",
    cursor: "pointer",
    textAlign: "left",
  },
  trackNum: { fontFamily: "var(--ln-mono)", fontSize: 11, color: "rgba(241,235,224,0.4)", width: 20 },
  trackName: {
    flex: 1,
    fontFamily: "var(--ln-album, var(--ln-body))",
    fontSize: 15,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  trackTag: { fontFamily: "var(--ln-mono)", fontSize: 9, color: "var(--ln-accent)", textTransform: "uppercase" },
  trackMoments: { fontFamily: "var(--ln-mono)", fontSize: 10, color: "var(--ln-accent)" },
  trackPlay: { color: "var(--ln-accent)", fontSize: 12 },
  // Playback
  playbackBar: { width: "100%", marginTop: 20 },
  playbackRow: { display: "flex", alignItems: "center", gap: 14 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: "var(--ln-accent)",
    border: "none",
    color: "var(--ln-bg, #0a0908)",
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
  },
  scrubTrack: { position: "relative", height: 5, borderRadius: 3, background: "rgba(241,235,224,0.18)", cursor: "pointer" },
  scrubFill: { position: "absolute", left: 0, top: 0, height: 5, borderRadius: 3, background: "var(--ln-accent)" },
  scrubKnob: { position: "absolute", top: "50%", width: 12, height: 12, borderRadius: 6, marginLeft: -6, marginTop: -6, background: "var(--ln-accent)" },
  scrubMarker: { position: "absolute", top: "50%", marginTop: -5, marginLeft: -5, borderRadius: "50%", border: "2px solid #0a0908", cursor: "pointer" },
  scrubTimes: { display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(241,235,224,0.55)" },
  playbackMeta: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  sourceBadge: {
    fontFamily: "var(--ln-mono)",
    fontSize: 9,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ln-accent)",
    border: "1px solid var(--ln-accent)",
    borderRadius: 999,
    padding: "3px 8px",
  },
  openSpotify: { background: "none", border: "none", fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(241,235,224,0.6)", cursor: "pointer" },
  spotifyBtn: {
    marginTop: 16,
    padding: "10px 18px",
    borderRadius: 999,
    border: "1px solid rgba(241,235,224,0.18)",
    background: "rgba(241,235,224,0.06)",
    color: "#f1ebe0",
    fontFamily: "var(--ln-body)",
    fontWeight: 600,
    cursor: "pointer",
  },
  calloutSlot: { width: "100%", minHeight: 46, marginTop: 12, display: "flex", alignItems: "center" },
  callout: { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--ln-accent)", animation: "ln-pop-in 0.32s cubic-bezier(.2,.8,.2,1)" },
  calloutTime: { fontFamily: "var(--ln-mono)", fontWeight: 700, fontSize: 12, color: "#0a0908" },
  calloutDivider: { width: 1, height: 16, background: "rgba(10,9,8,0.25)" },
  calloutText: { flex: 1, fontFamily: "var(--ln-body)", fontWeight: 600, fontSize: 13, color: "#0a0908" },
  calloutShare: {
    flexShrink: 0,
    background: "rgba(10,9,8,0.14)",
    border: "none",
    borderRadius: 999,
    color: "#0a0908",
    fontFamily: "var(--ln-mono)",
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 9px",
    cursor: "pointer",
  },
  inlineShare: {
    flexShrink: 0,
    background: "none",
    border: "none",
    color: "var(--ln-accent)",
    fontSize: 14,
    cursor: "pointer",
    padding: "0 4px",
  },
  quote: {
    marginTop: 24,
    fontFamily: "var(--ln-display, var(--ln-body))",
    fontStyle: "italic",
    fontSize: 20,
    lineHeight: 1.35,
    color: "#f1ebe0",
    textAlign: "center",
    maxWidth: 380,
  },
  body: { marginTop: 16, fontFamily: "var(--ln-body)", fontSize: 15.5, lineHeight: 1.6, color: "rgba(241,235,224,0.78)", maxWidth: 420, whiteSpace: "pre-wrap" },
  section: { width: "100%", marginTop: 28 },
  sectionLabel: { fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ln-accent)" },
  translateBtn: {
    background: "none",
    border: "1px solid var(--ln-accent)",
    borderRadius: 999,
    color: "var(--ln-accent)",
    fontFamily: "var(--ln-mono)",
    fontSize: 9.5,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "3px 9px",
    cursor: "pointer",
  },
  translationLine: {
    fontFamily: "var(--ln-body)",
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 1.4,
    color: "rgba(241,235,224,0.6)",
    padding: "0 0 6px 4px",
  },
  lyricsHint: { fontFamily: "var(--ln-body)", fontSize: 12, color: "rgba(241,235,224,0.5)", marginTop: 8, marginBottom: 10 },
  lyricsStatus: { fontFamily: "var(--ln-body)", fontStyle: "italic", fontSize: 13, color: "rgba(241,235,224,0.5)", marginTop: 10 },
  lyricsPane: { position: "relative", maxHeight: "52vh", overflowY: "auto", marginTop: 4 },
  lyricLine: { padding: "4px 0", lineHeight: 1.55, transition: "font-size 0.2s, color 0.2s" },
  lyricBadge: {
    marginLeft: 8,
    fontFamily: "var(--ln-mono)",
    fontSize: 9,
    color: "var(--ln-accent)",
    border: "1px solid var(--ln-accent)",
    borderRadius: 6,
    padding: "1px 5px",
    verticalAlign: "middle",
  },
  inlineNote: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 11px",
    margin: "8px 0",
    borderRadius: 12,
    border: "1px solid var(--ln-accent)",
    background: "rgba(217,178,90,0.1)",
    cursor: "pointer",
    animation: "ln-note-in 0.3s ease",
  },
  inlineNoteTime: { fontFamily: "var(--ln-mono)", fontWeight: 700, fontSize: 11, color: "#0a0908", background: "var(--ln-accent)", borderRadius: 6, padding: "2px 6px" },
  inlineNoteText: { flex: 1, fontFamily: "var(--ln-body)", fontSize: 13.5, color: "#f1ebe0" },
};
