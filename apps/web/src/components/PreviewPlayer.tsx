"use client";

import { useEffect, useRef, useState } from "react";

// Only one preview plays at a time across the page — when one starts, it pauses
// whatever was playing before.
let stopActive: (() => void) | null = null;

// Loose title compare so "Chun-Li" matches "Chun-Li (feat. …)" etc.
const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
    .replace(/[^a-z0-9]+/g, "");

type Status = "idle" | "loading" | "playing" | "unavailable";

/**
 * A small round play/pause button for a 30s iTunes preview snippet.
 *
 * Pass `previewUrl` if you already have it (stored on the review). If it's
 * missing or dead, the player lazily resolves one from /api/music/search/tracks
 * by `track` + `artist` on first play — so migrated/older reviews still get audio.
 */
export function PreviewPlayer({
  previewUrl,
  track,
  artist,
  accent = "var(--ln-accent)",
  size = 38,
  title = "Preview",
}: {
  previewUrl?: string | null;
  track?: string;
  artist?: string;
  accent?: string;
  size?: number;
  title?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedRef = useRef<string | null>(previewUrl ?? null);

  // Tear down on unmount so a snippet doesn't keep playing after navigation.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (stopActive && audioRef.current) stopActive = null;
    };
  }, []);

  async function resolveUrl(): Promise<string | null> {
    if (resolvedRef.current) return resolvedRef.current;
    if (!track) return null;
    try {
      const q = encodeURIComponent(`${track} ${artist || ""}`.trim());
      // Pull a few candidates and pick the best name match that actually has a
      // preview — iTunes' top hit for "<track> <artist>" can be the wrong song.
      const r = await fetch(`/api/music/search/tracks?q=${q}&limit=8`, { cache: "force-cache" });
      if (!r.ok) return null;
      const d = await r.json();
      const results: Array<{ name?: string; artist?: string; artistName?: string; previewUrl?: string | null }> =
        d.results || [];
      const withPreview = results.filter((x) => x.previewUrl);

      // Only accept a preview whose TRACK NAME actually matches — never fall back
      // to an arbitrary result (that's how obscure tracks got a totally wrong
      // song, e.g. "turmeric – the twins"). Among name matches, prefer one whose
      // artist also matches; if nothing matches, report unavailable, not a lie.
      const nT = norm(track);
      const nA = norm(artist || "");
      const nameMatches = withPreview.filter((x) => norm(x.name || "") === nT);
      const best =
        (nA ? nameMatches.find((x) => norm(x.artist || x.artistName || "") === nA) : undefined) ||
        nameMatches[0] ||
        null;
      const url = best?.previewUrl || null;
      resolvedRef.current = url;
      return url;
    } catch {
      return null;
    }
  }

  async function toggle() {
    // Pause if we're the one playing.
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("idle");
      return;
    }
    if (status === "loading") return;

    setStatus("loading");
    const url = await resolveUrl();
    if (!url) {
      setStatus("unavailable");
      return;
    }

    if (!audioRef.current) {
      const a = new Audio(url);
      a.addEventListener("ended", () => setStatus("idle"));
      a.addEventListener("error", () => setStatus("unavailable"));
      audioRef.current = a;
    }

    // Stop whatever else was playing, then claim the slot.
    stopActive?.();
    stopActive = () => {
      audioRef.current?.pause();
      setStatus("idle");
    };

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setStatus("playing");
    } catch {
      setStatus("unavailable");
    }
  }

  const dim = status === "unavailable";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={dim}
      title={dim ? "No preview available" : title}
      aria-label={status === "playing" ? "Pause preview" : "Play preview"}
      className="ln-press"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px solid ${accent}55`,
        background: status === "playing" ? accent : `${accent}1a`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: dim ? "default" : "pointer",
        opacity: dim ? 0.4 : 1,
        flexShrink: 0,
        padding: 0,
      }}
    >
      {status === "loading" ? (
        <Spinner color={accent} />
      ) : status === "playing" ? (
        // pause bars (dark on accent fill)
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 12 12" fill="var(--ln-bg, #0A0A0A)">
          <rect x="2" y="1.5" width="3" height="9" rx="1" />
          <rect x="7" y="1.5" width="3" height="9" rx="1" />
        </svg>
      ) : (
        // play triangle
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 12 12" fill={accent} style={{ marginLeft: 1 }}>
          <path d="M2.5 1.6v8.8a.6.6 0 0 0 .92.5l7-4.4a.6.6 0 0 0 0-1l-7-4.4a.6.6 0 0 0-.92.5z" />
        </svg>
      )}
    </button>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" style={{ animation: "ln-spin 0.7s linear infinite" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={`${color}33`} strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes ln-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
