"use client";

/**
 * MomentCaptureBar — capture a moment's timestamp by *listening*, not typing.
 *
 * Plays the track's preview (Deezer MP3 via /api/preview) with a scrubber and,
 * when available, LRCLIB synced lyrics. Two ways to mark a moment:
 *   - "mark here" adds a moment at the current playhead.
 *   - tapping a lyric line adds a moment at that line, prefilled with the lyric.
 *
 * This is the composer half of the Experience — the felt moment is captured by
 * pointing at the song, which is the whole soul of the product.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { parseLrc, activeLineIndex, type LyricLine } from "@/lib/lrc";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function MomentCaptureBar({
  track,
  artist,
  onMark,
}: {
  track: string;
  artist: string;
  /** Add a moment at `seconds` (rounded), optionally prefilled with a lyric. */
  onMark: (seconds: number, lyric?: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Resolve preview + synced lyrics for the composed track.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let durationSec: number | undefined;
      try {
        const q = new URLSearchParams({ track, artist });
        const r = await fetch(`/api/preview?${q}`);
        if (r.ok) {
          const { preview } = await r.json();
          if (preview && !cancelled) {
            setPreviewUrl(preview.previewUrl);
            durationSec = preview.durationSec || undefined;
          }
        }
      } catch {
        /* ignore */
      }
      try {
        const q = new URLSearchParams({ track, artist });
        if (durationSec) q.set("duration", String(durationSec));
        const r = await fetch(`/api/lyrics?${q}`);
        const d = r.ok ? await r.json() : null;
        if (!cancelled) setLyrics(d?.lyrics?.syncedLyrics ? parseLrc(d.lyrics.syncedLyrics) : []);
      } catch {
        /* no lyrics */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [track, artist]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!previewUrl) return;
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
      audioRef.current = null;
    };
  }, [previewUrl]);

  const activeIdx = useMemo(
    () => (lyrics.length ? activeLineIndex(lyrics, positionMs) : -1),
    [lyrics, positionMs],
  );
  const activeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seek = (ms: number) => {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, ms) / 1000;
  };

  const pct = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const onScrub = (e: React.MouseEvent) => {
    const el = scrubRef.current;
    if (!el || durationMs <= 0) return;
    const rect = el.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * durationMs);
  };

  const gold = "var(--ln-accent)";

  if (loading)
    return <div style={S.status}>loading the song…</div>;
  if (!previewUrl)
    return <div style={S.status}>no preview to scrub — enter the time manually below.</div>;

  return (
    <div style={S.wrap}>
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
            <span>{durationMs ? fmt(durationMs) : "0:30"}</span>
          </div>
        </div>
        <button type="button" onClick={() => onMark(Math.round(positionMs / 1000))} style={S.markBtn}>
          ＋ mark @ {fmt(positionMs)}
        </button>
      </div>

      {lyrics.length > 0 && (
        <div style={S.lyrics}>
          <div style={S.lyricsHint}>tap a lyric to mark that moment</div>
          {lyrics.map((ln, i) => {
            const isActive = i === activeIdx;
            return (
              <div
                key={i}
                ref={isActive ? activeRef : undefined}
                onClick={() => onMark(Math.round(ln.timeMs / 1000), ln.text || undefined)}
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
  wrap: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 },
  status: { fontFamily: "var(--ln-body)", fontSize: 12.5, fontStyle: "italic", color: "rgba(var(--ln-fg-rgb),0.5)", marginBottom: 10 },
  row: { display: "flex", alignItems: "center", gap: 12 },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    background: "var(--ln-accent)",
    border: "none",
    color: "var(--ln-bg, #0a0908)",
    cursor: "pointer",
    fontSize: 13,
    flexShrink: 0,
  },
  track: { position: "relative", height: 5, borderRadius: 3, background: "rgba(var(--ln-fg-rgb),0.16)", cursor: "pointer" },
  fill: { position: "absolute", left: 0, top: 0, height: 5, borderRadius: 3, background: "var(--ln-accent)" },
  knob: { position: "absolute", top: "50%", width: 11, height: 11, borderRadius: 6, marginLeft: -5.5, marginTop: -5.5, background: "var(--ln-accent)" },
  times: { display: "flex", justifyContent: "space-between", marginTop: 5, fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.5)" },
  markBtn: {
    flexShrink: 0,
    fontFamily: "var(--ln-mono)",
    fontSize: 11,
    color: "#1a0a04",
    background: "var(--ln-accent)",
    border: "none",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 600,
  },
  lyrics: { maxHeight: 200, overflowY: "auto", borderRadius: 10, border: "1px solid rgba(var(--ln-line-rgb),0.08)", padding: 8 },
  lyricsHint: { fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.45)", padding: "2px 6px 6px" },
  lyricLine: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "5px 6px",
    borderRadius: 7,
    cursor: "pointer",
    fontFamily: "var(--ln-body)",
    fontSize: 13.5,
    lineHeight: 1.4,
    transition: "background 0.15s, color 0.15s",
  },
  lyricTime: { fontFamily: "var(--ln-mono)", fontSize: 9.5, color: "var(--ln-accent)", flexShrink: 0, width: 30 },
};
