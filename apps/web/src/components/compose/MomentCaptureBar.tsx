"use client";

/**
 * MomentCaptureBar — capture a moment's timestamp by *listening*, not typing.
 *
 * Plays the track via the SoundCloud HTML5 Widget (full song, real ms position)
 * when resolvable, falling back to a 30s Deezer preview. Lyric sync and the
 * scrubber "mark here" button only produce meaningful timestamps when the full
 * song is playing — so synced-lyric tap is gated to the SC source.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseLrc, activeLineIndex, type LyricLine } from "@/lib/lrc";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

declare global { interface Window { SC?: any } }

const SC_API = "https://w.soundcloud.com/player/api.js";
let scApiLoading: Promise<void> | null = null;
function loadScApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.SC) return Promise.resolve();
  if (scApiLoading) return scApiLoading;
  scApiLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SC_API; s.async = true; s.onload = () => resolve();
    document.body.appendChild(s);
  });
  return scApiLoading;
}

export function MomentCaptureBar({
  track,
  artist,
  onMark,
}: {
  track: string;
  artist: string;
  onMark: (seconds: number, lyric?: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scTrackId, setScTrackId] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  const source = scTrackId ? "soundcloud" : previewUrl ? "preview" : "none";
  // Lyric timestamps are full-song times — only sync to the full song.
  const synced = source === "soundcloud";

  // Resolve preview, lyrics, and a SoundCloud id in parallel.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setScTrackId(null);
    setPreviewUrl(null);
    setLyrics([]);
    (async () => {
      let sourceUrl: string | null = null;
      let durationSec: number | undefined;

      try {
        const q = new URLSearchParams({ track, artist });
        const r = await fetch(`/api/preview?${q}`);
        if (r.ok) {
          const { preview } = await r.json();
          if (preview && !cancelled) {
            setPreviewUrl(preview.previewUrl);
            sourceUrl = preview.sourceUrl || null;
            durationSec = preview.durationSec || undefined;
          }
        }
      } catch { /* ignore */ }

      try {
        const q = new URLSearchParams({ track, artist });
        if (durationSec) q.set("duration", String(durationSec));
        const r = await fetch(`/api/lyrics?${q}`);
        const d = r.ok ? await r.json() : null;
        if (!cancelled && d?.lyrics?.syncedLyrics)
          setLyrics(parseLrc(d.lyrics.syncedLyrics));
      } catch { /* no lyrics */ }

      // Try to resolve the full SoundCloud track (Odesli first, then api-v2 search).
      try {
        const q = new URLSearchParams({ track, artist });
        if (sourceUrl) q.set("url", sourceUrl);
        const r = await fetch(`/api/soundcloud-link?${q}`);
        const d = r.ok ? await r.json() : null;
        if (!cancelled && d?.soundcloud?.trackId) setScTrackId(d.soundcloud.trackId);
      } catch { /* preview fallback */ }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [track, artist]);

  // SoundCloud widget.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<any>(null);
  useEffect(() => {
    if (!scTrackId) return;
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
    return () => { disposed = true; widgetRef.current = null; };
  }, [scTrackId]);

  // Preview audio (fallback when no SC).
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
    return () => { a.pause(); audioRef.current = null; };
  }, [source, previewUrl]);

  const toggle = useCallback(() => {
    if (source === "soundcloud") widgetRef.current?.toggle();
    else if (audioRef.current) {
      if (audioRef.current.paused) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
  }, [source]);

  const seek = useCallback((ms: number) => {
    const clamped = Math.max(0, ms);
    if (source === "soundcloud") widgetRef.current?.seekTo(clamped);
    else if (audioRef.current) audioRef.current.currentTime = clamped / 1000;
  }, [source]);

  const activeIdx = useMemo(
    () => (synced && lyrics.length ? activeLineIndex(lyrics, positionMs) : -1),
    [synced, lyrics, positionMs],
  );
  const activeRef = useRef<HTMLDivElement | null>(null);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const pane = lyricsRef.current;
    const line = activeRef.current;
    if (!pane || !line) return;
    const target = line.offsetTop - pane.clientHeight * 0.4 + line.clientHeight / 2;
    pane.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIdx]);

  const pct = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const onScrub = (e: React.MouseEvent) => {
    const el = scrubRef.current;
    if (!el || durationMs <= 0) return;
    seek(((e.clientX - el.getBoundingClientRect().left) / el.offsetWidth) * durationMs);
  };

  const gold = "var(--ln-accent)";

  if (loading)
    return <div style={S.status}>finding the song…</div>;
  if (source === "none")
    return <div style={S.status}>couldn't load audio — enter the timestamp manually below.</div>;

  return (
    <div style={S.wrap}>
      {/* Hidden SC iframe — must stay mounted while scTrackId is set */}
      {scTrackId && (
        <iframe
          ref={iframeRef}
          title="sc-composer"
          allow="autoplay"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
            "https://api.soundcloud.com/tracks/" + scTrackId,
          )}&auto_play=false&visual=false&show_artwork=false&buying=false&sharing=false&download=false&show_comments=false`}
        />
      )}

      <div style={S.row}>
        <button type="button" onClick={toggle} style={S.playBtn} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "►"}
        </button>
        <div style={{ flex: 1 }}>
          <div ref={scrubRef} onClick={onScrub} style={S.track}>
            <div style={{ ...S.fill, width: `${pct * 100}%` }} />
            <span style={{ ...S.knob, left: `${pct * 100}%` }} />
          </div>
          <div style={S.times}>
            <span>{fmt(positionMs)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {durationMs ? fmt(durationMs) : "—"}
              <span style={S.sourceBadge}>{synced ? "full song" : "30s preview"}</span>
            </span>
          </div>
        </div>
        <button type="button" onClick={() => onMark(Math.round(positionMs / 1000))} style={S.markBtn}>
          ＋ mark @ {fmt(positionMs)}
        </button>
      </div>

      {!synced && lyrics.length > 0 && (
        <div style={S.previewNote}>
          playing a 30s preview — lyric tap will use the lyric's full-song timestamp, but scrubber position won't match the clip.
        </div>
      )}

      {lyrics.length > 0 && (
        <div ref={lyricsRef} style={S.lyrics}>
          <div style={S.lyricsHint}>tap a lyric to mark that moment</div>
          {lyrics.map((ln, i) => {
            const isActive = synced && i === activeIdx;
            return (
              <div
                key={i}
                ref={isActive ? activeRef : undefined}
                onClick={() => {
                  if (synced) seek(ln.timeMs);
                  onMark(Math.round(ln.timeMs / 1000), ln.text || undefined);
                }}
                style={{
                  ...S.lyricLine,
                  color: isActive ? "var(--ln-fg, #f1ebe0)" : "rgba(241,235,224,0.5)",
                  background: isActive ? `${gold}14` : "transparent",
                }}
                title="Mark this moment"
              >
                <span style={S.lyricTime}>{fmt(ln.timeMs)}</span>
                <span>{ln.text || "♪"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { position: "relative", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 },
  status: { fontFamily: "var(--ln-body)", fontSize: 12.5, fontStyle: "italic", color: "rgba(var(--ln-fg-rgb),0.5)", marginBottom: 10 },
  row: { display: "flex", alignItems: "center", gap: 12 },
  playBtn: {
    width: 38, height: 38, borderRadius: 19,
    background: "var(--ln-accent)", border: "none",
    color: "var(--ln-bg, #0a0908)", cursor: "pointer", fontSize: 13, flexShrink: 0,
  },
  track: { position: "relative", height: 5, borderRadius: 3, background: "rgba(var(--ln-fg-rgb),0.16)", cursor: "pointer" },
  fill: { position: "absolute", left: 0, top: 0, height: 5, borderRadius: 3, background: "var(--ln-accent)" },
  knob: { position: "absolute", top: "50%", width: 11, height: 11, borderRadius: 6, marginLeft: -5.5, marginTop: -5.5, background: "var(--ln-accent)" },
  times: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5, fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.5)" },
  sourceBadge: {
    fontFamily: "var(--ln-mono)", fontSize: 8.5, letterSpacing: "0.05em", textTransform: "uppercase",
    color: "var(--ln-accent)", border: "1px solid var(--ln-accent)", borderRadius: 999, padding: "2px 6px",
  },
  markBtn: {
    flexShrink: 0, fontFamily: "var(--ln-mono)", fontSize: 11,
    color: "#1a0a04", background: "var(--ln-accent)", border: "none",
    borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 600,
  },
  previewNote: {
    fontFamily: "var(--ln-body)", fontSize: 11.5, fontStyle: "italic",
    color: "rgba(241,235,224,0.45)", lineHeight: 1.4,
  },
  lyrics: { maxHeight: 200, overflowY: "auto", borderRadius: 10, border: "1px solid rgba(var(--ln-line-rgb),0.08)", padding: 8 },
  lyricsHint: { fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.45)", padding: "2px 6px 6px" },
  lyricLine: {
    display: "flex", alignItems: "baseline", gap: 8,
    padding: "5px 6px", borderRadius: 7, cursor: "pointer",
    fontFamily: "var(--ln-body)", fontSize: 13.5, lineHeight: 1.4,
    transition: "background 0.15s, color 0.15s",
  },
  lyricTime: { fontFamily: "var(--ln-mono)", fontSize: 9.5, color: "var(--ln-accent)", flexShrink: 0, width: 30 },
};
