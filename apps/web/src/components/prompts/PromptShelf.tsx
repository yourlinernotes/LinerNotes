"use client";

/**
 * Prompt Shelf - "Worth a note" prompts from Last.fm listening history
 * Web version matching mobile PromptCard design
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PreviewPlayer } from "@/components/PreviewPlayer";

interface Prompt {
  id: string;
  type: string;
  track: string;
  artist: string;
  album: string;
  playCount?: number;
  prompt: string;
  tag: string;
  artworkUrl?: string;
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
}

interface PromptShelfProps {
  prompts: Prompt[];
  accent?: string;
  onRefresh?: () => void;
}

export function PromptShelf({ prompts, accent, onRefresh }: PromptShelfProps) {
  const router = useRouter();
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gold = accent || "var(--ln-accent)";

  const visiblePrompts = prompts.filter((p) => !dismissedPrompts.has(p.id));

  if (visiblePrompts.length === 0) return null;

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    await onRefresh();
    // Clear dismissed prompts on refresh so user sees new set
    setDismissedPrompts(new Set());
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleDismiss = (promptId: string) => {
    setDismissedPrompts((prev) => new Set([...prev, promptId]));
  };

  const handleOpenComposer = (prompt: Prompt, rating?: number) => {
    // Album prompts open the album composer pre-filled with the album (the user
    // still picks which tracks to react to). Track prompts open the note composer.
    if (prompt.type === "album") {
      const params = new URLSearchParams({
        album: prompt.album,
        artist: prompt.artist,
        artwork: prompt.artworkUrl || "",
      });
      router.push(`/log/album?${params.toString()}`);
      return;
    }
    const params = new URLSearchParams({
      track: prompt.track,
      artist: prompt.artist,
      album: prompt.album,
      artwork: prompt.artworkUrl || "",
    });
    if (rating) {
      params.set("rating", rating.toString());
    }
    router.push(`/log?${params.toString()}`);
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingLeft: 2 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: gold }}>
            WORTH A NOTE
          </span>
          <span style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "rgba(var(--ln-fg-rgb),0.5)" }}>
            From what you've been playing
          </span>
        </div>

        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ln-press"
            style={{
              background: "none",
              border: "none",
              cursor: isRefreshing ? "default" : "pointer",
              padding: "6px 12px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--ln-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: gold,
              opacity: isRefreshing ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                transform: isRefreshing ? "rotate(360deg)" : "rotate(0deg)",
                transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <path
                d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            REFRESH
          </button>
        )}
      </div>

      {/* Horizontal scroll of prompts */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div style={{ display: "flex", gap: 12, paddingBottom: 8 }}>
          {visiblePrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              accent={gold}
              onOpen={(rating) => handleOpenComposer(prompt, rating)}
              onDismiss={() => handleDismiss(prompt.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  accent,
  onOpen,
  onDismiss,
}: {
  prompt: Prompt;
  accent: string;
  onOpen: (rating?: number) => void;
  onDismiss: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Last.fm art is often the wrong cover — resolve the correct one from
  // iTunes/Deezer and prefer it. (Track prompts only; albums use their own art.)
  const [resolvedArt, setResolvedArt] = useState<string | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  useEffect(() => {
    if (prompt.type === "album" || !prompt.track) return;
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ track: prompt.track!, artist: prompt.artist });
        const r = await fetch(`/api/artwork?${q}`);
        const d = r.ok ? await r.json() : null;
        if (!cancelled && d?.artworkUrl) {
          setResolvedArt(d.artworkUrl);
          setImgError(false);
        }
      } catch { /* keep Last.fm art */ }
    })();
    // Pre-resolve Spotify link via preview sourceUrl → Odesli so the button
    // opens instantly without a blank-tab detour.
    (async () => {
      try {
        const title = prompt.track!;
        const { artist } = prompt;
        const isAlbum = prompt.type === "album";
        const kind = isAlbum ? "album" : "track";
        const pvQ = new URLSearchParams({ track: title, artist });
        const pvR = await fetch(`/api/preview?${pvQ}`);
        const pvD = pvR.ok ? await pvR.json() : null;
        const sourceUrl = pvD?.preview?.sourceUrl || "";
        const spQ = new URLSearchParams({ kind, title, artist, sourceUrl });
        const spR = await fetch(`/api/spotify-link?${spQ}`);
        const spD = spR.ok ? await spR.json() : null;
        if (!cancelled && spD?.url) setSpotifyUrl(spD.url);
      } catch { /* leave null — click will fall back to search */ }
    })();
    return () => { cancelled = true; };
  }, [prompt.type, prompt.track, prompt.artist]);
  const artUrl = resolvedArt || prompt.artworkUrl;
  const p = prompt.palette;

  const handleRatingClick = (newRating: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRating(newRating);
  };

  return (
    <div
      onClick={() => onOpen()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ln-card-hover"
      style={{
        position: "relative",
        width: 246,
        flexShrink: 0,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--ln-surface)",
        border: `1px solid rgba(var(--ln-line-rgb),0.08)`,
        boxShadow: "0 1px 2px rgba(var(--ln-line-rgb),0.05)",
        transition: "all 0.2s",
      }}
    >
      {/* Gradient tint */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 90, background: `linear-gradient(${p.accent}22, transparent)`, pointerEvents: "none" }} />

      {/* Content */}
      <div style={{ position: "relative", padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        {/* Art + tag + dismiss */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            {/* Album art thumbnail */}
            <div style={{ width: 42, height: 42, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: `radial-gradient(120% 120% at 22% 18%, ${p.mid} 0%, ${p.deep} 55%, ${p.lo} 100%)` }}>
              {/* Last.fm serves a literal grey-star placeholder image (this hash) that
                  loads fine (so onError won't catch it) — treat it as no artwork. */}
              {artUrl && !artUrl.includes("2a96cbd8b46e442fc41c2b86b821562f") && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artUrl}
                  alt={prompt.album}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => setImgError(true)}
                />
              ) : (
                // No artwork (or it failed to load) — show the album-colour tile.
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#f4ecdd", fontSize: 18, fontFamily: "var(--ln-album)", fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                  {(prompt.album || prompt.track || prompt.artist || "♪").trim()[0]?.toUpperCase() || "♪"}
                </div>
              )}
            </div>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.4px", lineHeight: "12px", color: accent }}>
              {prompt.tag}
            </span>
          </div>

          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              background: "rgba(var(--ln-fg-rgb),0.06)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              opacity: hover ? 1 : 0,
              transition: "opacity 0.2s",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3l6 6" stroke="rgba(var(--ln-fg-rgb),0.5)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* The prompt (the hero) */}
        <div style={{ fontFamily: "var(--ln-body)", fontWeight: 500, fontSize: 15, lineHeight: "19.8px", color: "var(--ln-fg)", flex: 1 }}>
          {prompt.prompt}
        </div>

        {/* Track/album info */}
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {prompt.type === "album" ? (
            <>
              {prompt.album} · {prompt.artist}
            </>
          ) : (
            <>
              {prompt.track} · {prompt.artist}
              {prompt.album && <> · {prompt.album}</>}
            </>
          )}
        </div>

        {/* Memory-refresher: hear a snippet / jump to the song while you decide */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={(e) => e.stopPropagation()}>
          {prompt.type !== "album" && (
            <PreviewPlayer track={prompt.track} artist={prompt.artist} accent={accent} size={28} title="Hear a snippet" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const isAlbum = prompt.type === "album";
              const title = isAlbum ? prompt.album : prompt.track;
              const dest = spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${title} ${prompt.artist}`.trim())}`;
              window.open(dest, "_blank", "noopener");
            }}
            style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.55)", background: "none", border: "none", padding: 0, cursor: "pointer", letterSpacing: "0.3px" }}
          >
            listen ↗
          </button>
        </div>

        {/* Quick-rate + Note button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isActive = star <= (hoverRating || rating);
              return (
                <button
                  key={star}
                  onClick={(e) => handleRatingClick(star, e)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: isActive ? accent : "rgba(var(--ln-fg-rgb),0.2)",
                    fontSize: 19,
                    lineHeight: "19px",
                    transition: "color 0.15s",
                  }}
                >
                  ★
                </button>
              );
            })}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(rating || undefined);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "var(--ln-body)",
              fontSize: 12,
              fontWeight: 600,
              color: accent,
            }}
          >
            Note
            <span style={{ fontSize: 14, lineHeight: "14px" }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
