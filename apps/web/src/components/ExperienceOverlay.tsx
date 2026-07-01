"use client";

/**
 * The immersive Experience — web parity with the mobile ExperienceScreen.
 *
 * Full-screen album-colour flood + in-app playback + karaoke-style synced
 * lyrics with the author's moment-notes interleaved. Playback engine:
 *  - SoundCloud HTML5 Widget (full track, real ms position) when resolvable
 *  - a 30s iTunes preview (<audio>) as the fallback
 * Lyrics come from LRCLIB via /api/lyrics; SoundCloud ids from /api/soundcloud-link.
 *
 * The sync engine is player-agnostic — it only consumes `positionMs` — so the
 * audio source is swappable without touching the highlight logic.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ReviewVM } from "@/lib/view-adapter";

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

type LyricsResult = {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental: boolean;
};

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

type Source = "soundcloud" | "preview" | "none";

export function ExperienceOverlay({ review, onClose }: { review: ReviewVM; onClose: () => void }) {
  const { album, rating } = review;
  const p = album.palette;
  const gold = "var(--ln-accent)";
  const isSingleTrack = album.kind !== "album" && album.kind !== "playlist";

  const [previewUrl, setPreviewUrl] = useState<string | null>(album.previewUrl ?? null);
  const [scTrackId, setScTrackId] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(isSingleTrack);

  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const source: Source = scTrackId ? "soundcloud" : previewUrl ? "preview" : "none";

  const syncedLines = useMemo(
    () => (lyrics?.syncedLyrics ? parseLrc(lyrics.syncedLyrics) : []),
    [lyrics?.syncedLyrics],
  );
  const activeIdx = useMemo(
    () => (syncedLines.length ? activeLineIndex(syncedLines, positionMs) : -1),
    [syncedLines, positionMs],
  );
  const activeMoment = useMemo(
    () =>
      (review.notes || []).find(
        (n) => positionMs >= n.sec * 1000 && positionMs < (n.sec + 5) * 1000,
      ) || null,
    [review.notes, positionMs],
  );

  // ---- Resolve media (preview + duration), lyrics, SoundCloud id ----
  useEffect(() => {
    if (!isSingleTrack) return;
    let cancelled = false;
    (async () => {
      const track = album.title || "";
      const artist = album.artist || "";
      let durationSec: number | undefined;
      // 1. iTunes search (server route, avoids CORS) → preview + duration.
      try {
        const q = encodeURIComponent(`${track} ${artist}`.trim());
        const r = await fetch(`/api/music/search/tracks?q=${q}&limit=8`, { cache: "force-cache" });
        if (r.ok) {
          const d = await r.json();
          const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
          const hit =
            (d.results || []).find((x: any) => norm(x.name) === norm(track)) || (d.results || [])[0];
          if (hit) {
            if (!album.previewUrl && hit.previewUrl) setPreviewUrl(hit.previewUrl);
            if (hit.duration) durationSec = Math.round(hit.duration / 1000);
          }
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      // 2. Lyrics.
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

      // 3. SoundCloud full track (best-effort) — prefer over the preview.
      try {
        if (album.extId) {
          const q = new URLSearchParams({ id: album.extId, platform: "itunes" });
          const r = await fetch(`/api/soundcloud-link?${q}`);
          const d = r.ok ? await r.json() : null;
          if (!cancelled && d?.soundcloud?.trackId) setScTrackId(d.soundcloud.trackId);
        }
      } catch {
        /* preview fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSingleTrack, album.title, album.artist, album.extId, album.previewUrl]);

  // ---- SoundCloud widget ----
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<any>(null);
  useEffect(() => {
    if (source !== "soundcloud" || !scTrackId) return;
    let disposed = false;
    loadScApi().then(() => {
      if (disposed || !iframeRef.current || !window.SC) return;
      const w = window.SC.Widget(iframeRef.current);
      widgetRef.current = w;
      const E = window.SC.Widget.Events;
      w.bind(E.READY, () => w.getDuration((d: number) => setDurationMs(d || 0)));
      w.bind(E.PLAY_PROGRESS, (e: any) => setPositionMs(e.currentPosition || 0));
      w.bind(E.PLAY, () => setPlaying(true));
      w.bind(E.PAUSE, () => setPlaying(false));
      w.bind(E.FINISH, () => setPlaying(false));
      w.bind(E.ERROR, () => setScTrackId(null)); // fall back to preview
    });
    return () => {
      disposed = true;
      widgetRef.current = null;
    };
  }, [source, scTrackId]);

  // ---- Preview audio (fallback) ----
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

  // Auto-scroll the active lyric into the upper third.
  const activeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  // Which moment-note (if any) attaches to each lyric line.
  const notesByLine = useMemo(() => {
    const map: Record<number, typeof review.notes> = {};
    if (!syncedLines.length || !review.notes?.length) return map;
    for (const n of review.notes) {
      const nMs = n.sec * 1000;
      let idx = 0;
      for (let i = 0; i < syncedLines.length; i++) {
        if (syncedLines[i].timeMs <= nMs) idx = i;
        else break;
      }
      (map[idx] ||= []).push(n);
    }
    return map;
  }, [syncedLines, review.notes]);

  const openSpotify = () => {
    const url = `https://open.spotify.com/search/${encodeURIComponent(`${album.title} ${album.artist}`.trim())}`;
    window.open(url, "_blank");
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
    <div style={S.overlay}>
      <style>{BREATHE_KEYFRAMES}</style>

      {/* Breathing album-colour flood */}
      <div style={{ ...S.flood, background: `linear-gradient(155deg, ${p.mid} 0%, ${p.deep} 60%, ${p.lo} 100%)` }} />
      <div style={{ ...S.floodGlow, background: `radial-gradient(circle at 78% 78%, ${p.glow}cc, transparent 60%)` }} />
      <div style={{ ...S.floodGlow, background: `radial-gradient(circle at 14% 88%, ${p.accent}55, transparent 55%)` }} />
      <div style={S.darken} />

      {/* Hidden SoundCloud widget */}
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

      {/* Top bar */}
      <div style={S.topBar}>
        <button onClick={onClose} style={S.closeBtn} aria-label="Close">
          ✕
        </button>
        <span style={S.expLabel}>the experience</span>
        <span style={{ width: 34 }} />
      </div>

      <div style={S.scroll}>
        <div style={S.content}>
          {/* Cover */}
          <div onClick={openSpotify} style={S.cover}>
            {album.artworkUrl ? (
              <img src={album.artworkUrl} alt={album.title} style={S.coverImg} />
            ) : (
              <div style={{ ...S.coverImg, ...S.coverPlaceholder }}>{album.title?.toLowerCase()}</div>
            )}
          </div>

          <h1 style={S.title}>{album.title}</h1>
          <div style={S.artist}>
            {album.artist}
            {album.year ? ` · ${album.year}` : ""}
          </div>

          {rating > 0 && <div style={S.rating}>{"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}</div>}

          {/* Playback bar */}
          {isSingleTrack && (previewUrl || scTrackId) ? (
            <div style={S.playbackBar}>
              <div style={S.playbackRow}>
                <button onClick={toggle} style={S.playBtn} aria-label={playing ? "Pause" : "Play"}>
                  {playing ? "❚❚" : "►"}
                </button>
                <div style={{ flex: 1 }}>
                  <div ref={scrubRef} onClick={onScrub} style={S.scrubTrack}>
                    <div style={{ ...S.scrubFill, width: `${pct * 100}%` }} />
                    {durationMs > 0 &&
                      (review.notes || []).map((n, i) => {
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
                <span style={S.sourceBadge}>{source === "soundcloud" ? "soundcloud" : "preview · 0:30"}</span>
                <button onClick={openSpotify} style={S.openSpotify}>
                  open in spotify ↗
                </button>
              </div>
            </div>
          ) : (
            <button onClick={openSpotify} style={S.spotifyBtn}>
              Open in Spotify
            </button>
          )}

          {/* Live moment callout */}
          {isSingleTrack && (
            <div style={S.calloutSlot}>
              {activeMoment && (
                <div style={S.callout}>
                  <span style={S.calloutTime}>{fmt(activeMoment.sec * 1000)}</span>
                  <span style={S.calloutDivider} />
                  <span style={S.calloutText}>
                    {activeMoment.label ? `${activeMoment.label} — ` : ""}
                    {activeMoment.note}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Take */}
          {review.take && <div style={S.quote}>&ldquo;{review.take.split("\n")[0]}&rdquo;</div>}
          {review.body && <div style={S.body}>{review.body}</div>}

          {/* Karaoke lyrics */}
          {isSingleTrack && (
            <LyricsBlock
              loading={lyricsLoading}
              lyrics={lyrics}
              lines={syncedLines}
              activeIdx={activeIdx}
              activeRef={activeRef}
              notesByLine={notesByLine}
              onSeek={seekTo}
              hasAudio={!!(previewUrl || scTrackId)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LyricsBlock({
  loading,
  lyrics,
  lines,
  activeIdx,
  activeRef,
  notesByLine,
  onSeek,
  hasAudio,
}: {
  loading: boolean;
  lyrics: LyricsResult | null;
  lines: LyricLine[];
  activeIdx: number;
  activeRef: React.RefObject<HTMLDivElement | null>;
  notesByLine: Record<number, ReviewVM["notes"]>;
  onSeek: (ms: number) => void;
  hasAudio: boolean;
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
        <div style={S.sectionLabel}>lyrics</div>
        <div style={S.lyricsHint}>
          {hasAudio ? "it follows the song — click any line to jump there." : "click a line to jump when playing."}
        </div>
        <div style={S.lyricsPane}>
          {lines.map((ln, idx) => {
            const isActive = idx === activeIdx;
            const distance = Math.abs(idx - activeIdx);
            const opacity = activeIdx < 0 ? 0.8 : isActive ? 1 : Math.max(0.3, 1 - distance * 0.12);
            const lineNotes = notesByLine[idx];
            return (
              <div key={idx} ref={isActive ? activeRef : undefined} style={{ opacity }}>
                <div
                  onClick={() => onSeek(ln.timeMs)}
                  style={{
                    ...S.lyricLine,
                    fontSize: isActive ? 22 : 18,
                    color: isActive ? "var(--ln-fg, #f1ebe0)" : "rgba(241,235,224,0.6)",
                    fontFamily: isActive ? "var(--ln-display, var(--ln-body))" : "var(--ln-body)",
                    cursor: "pointer",
                  }}
                >
                  {ln.text || "♪"}
                  {lineNotes && !isActive && <span style={S.lyricBadge}>❝ note</span>}
                </div>
                {lineNotes?.map((n, j) => (
                  <div key={j} onClick={() => onSeek(n.sec * 1000)} style={S.inlineNote}>
                    <span style={S.inlineNoteTime}>{fmt(n.sec * 1000)}</span>
                    <span style={S.inlineNoteText}>{n.note}</span>
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

const BREATHE_KEYFRAMES = `@keyframes ln-breathe { 0%,100% { transform: scale(1.06); } 50% { transform: scale(1.15); } }`;

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "var(--ln-bg, #0a0908)",
    overflow: "hidden",
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
    fontSize: 15,
  },
  expLabel: {
    fontFamily: "var(--ln-mono)",
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "rgba(241,235,224,0.65)",
  },
  scroll: { position: "absolute", inset: 0, overflowY: "auto", padding: "84px 0 80px" },
  content: { maxWidth: 560, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center" },
  cover: {
    width: 200,
    height: 200,
    borderRadius: 14,
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "0 32px 70px -28px rgba(0,0,0,0.9)",
  },
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
  rating: { marginTop: 10, color: "var(--ln-accent)", fontSize: 16, letterSpacing: 2 },
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
  scrubKnob: {
    position: "absolute",
    top: "50%",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    marginTop: -6,
    background: "var(--ln-accent)",
  },
  scrubMarker: {
    position: "absolute",
    top: "50%",
    marginTop: -5,
    marginLeft: -5,
    borderRadius: "50%",
    border: "2px solid #0a0908",
    cursor: "pointer",
  },
  scrubTimes: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 6,
    fontFamily: "var(--ln-mono)",
    fontSize: 10,
    color: "rgba(241,235,224,0.55)",
  },
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
  openSpotify: {
    background: "none",
    border: "none",
    fontFamily: "var(--ln-mono)",
    fontSize: 10,
    color: "rgba(241,235,224,0.6)",
    cursor: "pointer",
  },
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
  callout: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "var(--ln-accent)",
    animation: "ln-breathe 0s",
  },
  calloutTime: { fontFamily: "var(--ln-mono)", fontWeight: 700, fontSize: 12, color: "#0a0908" },
  calloutDivider: { width: 1, height: 16, background: "rgba(10,9,8,0.25)" },
  calloutText: { flex: 1, fontFamily: "var(--ln-body)", fontWeight: 600, fontSize: 13, color: "#0a0908" },
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
  body: { marginTop: 16, fontFamily: "var(--ln-body)", fontSize: 15.5, lineHeight: 1.6, color: "rgba(241,235,224,0.78)", maxWidth: 420 },
  section: { width: "100%", marginTop: 28 },
  sectionLabel: {
    fontFamily: "var(--ln-mono)",
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ln-accent)",
  },
  lyricsHint: { fontFamily: "var(--ln-body)", fontSize: 12, color: "rgba(241,235,224,0.5)", marginTop: 8, marginBottom: 10 },
  lyricsStatus: { fontFamily: "var(--ln-body)", fontStyle: "italic", fontSize: 13, color: "rgba(241,235,224,0.5)", marginTop: 10 },
  lyricsPane: { maxHeight: "52vh", overflowY: "auto", marginTop: 4 },
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
  },
  inlineNoteTime: {
    fontFamily: "var(--ln-mono)",
    fontWeight: 700,
    fontSize: 11,
    color: "#0a0908",
    background: "var(--ln-accent)",
    borderRadius: 6,
    padding: "2px 6px",
  },
  inlineNoteText: { flex: 1, fontFamily: "var(--ln-body)", fontSize: 13.5, color: "#f1ebe0" },
};
