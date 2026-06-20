"use client";

/**
 * Prompt Shelf - "Worth a note" prompts from Last.fm listening history
 * Web version matching mobile PromptCard design
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

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
}

export function PromptShelf({ prompts, accent }: PromptShelfProps) {
  const router = useRouter();
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const gold = accent || "var(--ln-accent)";

  const visiblePrompts = prompts.filter((p) => !dismissedPrompts.has(p.id));

  if (visiblePrompts.length === 0) return null;

  const handleDismiss = (promptId: string) => {
    setDismissedPrompts((prev) => new Set([...prev, promptId]));
  };

  const handleOpenComposer = (prompt: Prompt, rating?: number) => {
    // Navigate to compose with pre-filled track data via URL params
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
              {prompt.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={prompt.artworkUrl}
                  alt={prompt.album}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: p.accent, fontSize: 20 }}>★</div>
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
          {prompt.track} · {prompt.artist}
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
