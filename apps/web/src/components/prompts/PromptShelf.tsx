"use client";

/**
 * Prompt Shelf - "Worth a note" prompts from Last.fm listening history
 * Web version of mobile PromptShelf component
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

  const handleOpenComposer = (prompt: Prompt) => {
    // Navigate to compose with pre-filled track data via URL params
    const params = new URLSearchParams({
      track: prompt.track,
      artist: prompt.artist,
      album: prompt.album,
      artwork: prompt.artworkUrl || "",
      prompt: prompt.prompt,
      tag: prompt.tag,
    });
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
              onOpen={() => handleOpenComposer(prompt)}
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
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [hover, setHover] = useState(false);
  const p = prompt.palette;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ln-card-hover"
      style={{
        position: "relative",
        width: 220,
        flexShrink: 0,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--ln-surface)",
        border: `1px solid rgba(var(--ln-line-rgb),${hover ? 0.16 : 0.08})`,
        boxShadow: hover
          ? "0 1px 2px rgba(var(--ln-line-rgb),0.05), 0 20px 40px -20px var(--ln-shadow)"
          : "0 1px 2px rgba(var(--ln-line-rgb),0.05), 0 12px 28px -16px var(--ln-shadow)",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "all 0.2s",
      }}
    >
      {/* Album art with gradient overlay */}
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: `radial-gradient(120% 120% at 22% 18%, ${p.mid} 0%, ${p.deep} 55%, ${p.lo} 100%)` }}>
        {prompt.artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prompt.artworkUrl}
            alt={prompt.album}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            crossOrigin="anonymous"
          />
        )}

        {/* Gradient overlay */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "60%", background: `linear-gradient(${p.accent}18, transparent 75%)`, pointerEvents: "none" }} />

        {/* Tag badge */}
        <div style={{ position: "absolute", top: 11, left: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(8,7,6,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(var(--ln-line-rgb),0.1)" }}>
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
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
            position: "absolute",
            top: 11,
            right: 11,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "rgba(8,7,6,0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(var(--ln-line-rgb),0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: hover ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3l6 6" stroke="rgba(var(--ln-fg-rgb),0.7)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "12px 13px 14px" }}>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, fontWeight: 600, color: "var(--ln-fg)", marginBottom: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {prompt.track}
        </div>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 11.5, color: "rgba(var(--ln-fg-rgb),0.55)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {prompt.artist}
        </div>
        <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: "rgba(var(--ln-fg-rgb),0.45)", lineHeight: 1.4 }}>
          {prompt.prompt}
        </div>
      </div>
    </div>
  );
}
