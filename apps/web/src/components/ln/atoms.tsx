"use client";

// LinerNotes atoms — icons, stars, reactions, placeholder/real album art, the
// signature "moment" notch. Ported from the design bundle's atoms.jsx to TSX.

import { useRef, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "@/lib/palette";
import { extractPaletteFromImage } from "@/lib/extractPalette";

export const lnFmt = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const lnRel = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const now = Date.now();
  const h = Math.floor((now - then) / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
};

// ── Star rating ──────────────────────────────────────────────
export function LNStars({
  rating,
  size = 13,
  color = "var(--ln-accent)",
  showNum = true,
}: {
  rating: number;
  size?: number;
  color?: string;
  showNum?: boolean;
}) {
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const fill = rating >= i + 1 ? 1 : rating >= i + 0.5 ? 0.5 : 0;
    const gid = `ln-star-${size}-${i}-${Math.round(rating * 10)}`;
    stars.push(
      <svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ display: "block" }}>
        {fill === 0.5 && (
          <defs>
            <linearGradient id={gid}>
              <stop offset="50%" stopColor={color} />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
        )}
        <path
          d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.79-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
          fill={fill === 1 ? color : fill === 0.5 ? `url(#${gid})` : "none"}
          stroke={color}
          strokeWidth={fill === 0 ? 1.3 : 0}
          strokeOpacity={fill === 0 ? 0.45 : 1}
        />
      </svg>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2.5 }}>
      <span style={{ display: "inline-flex", gap: 2 }}>{stars}</span>
      {showNum && (
        <span style={{ fontFamily: "var(--ln-mono)", fontSize: size - 1, color, marginLeft: 4, letterSpacing: "-0.02em" }}>
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}

// ── Reaction glyphs (flame / love / skip) ────────────────────
export type Reaction = "flame" | "love" | "skip";

export const LN_REACT: Record<Reaction, { color: string; label: string }> = {
  flame: { color: "#e0762f", label: "standout" },
  love: { color: "#d98aa0", label: "loved" },
  skip: { color: "#7a7468", label: "skipped" },
};

export function LNReact({ kind, size = 16 }: { kind: Reaction; size?: number }) {
  const c = LN_REACT[kind]?.color || "#7a7468";
  if (kind === "flame")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
        <path d="M12 3c.5 3-1.8 4.2-2.8 5.8C8 10.6 8 12.5 8 13a4 4 0 008 0c0-1.6-.8-3.2-1.6-4 .3 1.2-.4 2-1 2 .6-1.7-.4-3.4-1.4-4.5C11 5.4 12 4.2 12 3z" fill={c} />
      </svg>
    );
  if (kind === "love")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
        <path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0112 7.6 3.8 3.8 0 0119 10.8C19 15.7 12 20 12 20z" fill={c} />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
      <path d="M5 6l7 6-7 6V6zM14 6l5 6-5 6V6z" fill={c} fillOpacity="0.85" />
    </svg>
  );
}

// ── Action-row / utility icons ───────────────────────────────
export type IconName =
  | "repost"
  | "save"
  | "like"
  | "close"
  | "chevdown"
  | "play"
  | "edit"
  | "share"
  | "back";

export function LNIcon({
  name,
  size = 22,
  filled = false,
  color = "currentColor",
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  color?: string;
}) {
  const sw = 1.7;
  const common = { width: size, height: size, viewBox: "0 0 24 24", style: { display: "block" } as CSSProperties };
  if (name === "repost")
    return (
      <svg {...common} fill="none">
        <path d="M4 9V8a3 3 0 013-3h9m1 10v1a3 3 0 01-3 3H8" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2l3 3-3 3M10 22l-3-3 3-3" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "save")
    return (
      <svg {...common} fill={filled ? color : "none"}>
        <path d="M6 4h12v17l-6-4-6 4V4z" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "like")
    return (
      <svg {...common} fill={filled ? color : "none"}>
        <path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0112 7.6 3.8 3.8 0 0119 10.8C19 15.7 12 20 12 20z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    );
  if (name === "close")
    return (
      <svg {...common} fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  if (name === "chevdown")
    return (
      <svg {...common} fill="none">
        <path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "back")
    return (
      <svg {...common} fill="none">
        <path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "edit")
    return (
      <svg {...common} fill="none">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M14 6l4 4" stroke={color} strokeWidth={sw} />
      </svg>
    );
  if (name === "share")
    return (
      <svg {...common} fill="none">
        <path d="M12 3v13M12 3L8 7M12 3l4 4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "play")
    return (
      <svg {...common} fill={color}>
        <path d="M7 5l12 7-12 7V5z" />
      </svg>
    );
  return null;
}

// ── Monogram / photo avatar ──────────────────────────────────
export function LNAvatar({
  user,
  size = 30,
}: {
  user: { name: string; tint: string; avatarUrl?: string | null };
  size?: number;
}) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, display: "block" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${user.tint}1f`,
        border: `1px solid ${user.tint}55`,
        color: user.tint,
        fontFamily: "var(--ln-body)",
        fontWeight: 600,
        fontSize: size * 0.42,
        letterSpacing: "0.01em",
      }}
    >
      {(user.name || "?")[0].toUpperCase()}
    </div>
  );
}

// ── Album art — real cover when available, else a palette gradient ──
export function LNArt({
  palette,
  src,
  label = "cover",
  radius = 0,
  dim = false,
  noTag = false,
  children,
  style = {},
  onPaletteExtracted,
}: {
  palette: Palette;
  src?: string | null;
  label?: string;
  radius?: number;
  dim?: boolean;
  noTag?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  onPaletteExtracted?: (palette: Palette) => void;
}) {
  const p = palette;
  const imgRef = useRef<HTMLImageElement>(null);
  // Route covers through our same-origin image proxy. Cover hosts (mzstatic,
  // coverartarchive, lastfm, i.scdn) are CORS-less and some are flaky; proxying
  // makes them load reliably on every device (no CORS, no mixed-content) AND
  // lets palette extraction read the pixels (same-origin canvas isn't tainted),
  // so we no longer need crossOrigin at all.
  const httpsSrc = src ? `/api/img?url=${encodeURIComponent(src)}` : src;

  useEffect(() => {
    if (!src || !imgRef.current || !onPaletteExtracted) return;

    const extractColors = async () => {
      if (!imgRef.current) return;

      try {
        const extracted = await extractPaletteFromImage(imgRef.current);
        if (extracted) {
          onPaletteExtracted(extracted);
        }
      } catch (error) {
        // Silent fail - fallback to deterministic palette
        console.debug("Color extraction skipped:", error);
      }
    };

    const img = imgRef.current;
    if (img.complete) {
      extractColors();
    } else {
      img.addEventListener("load", extractColors);
      return () => img.removeEventListener("load", extractColors);
    }
  }, [src, onPaletteExtracted]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: radius,
        overflow: "hidden",
        background: `radial-gradient(120% 120% at 22% 18%, ${p.mid} 0%, ${p.deep} 55%, ${p.lo} 100%)`,
        ...style,
      }}
    >
      {httpsSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={httpsSrc}
          alt={label || "cover"}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {/* faint diagonal liner-stripe texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(var(--ln-line-rgb),0.05) 0 1px, transparent 1px 11px)",
          mixBlendMode: "overlay",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: dim ? "rgba(8,7,6,0.32)" : "transparent" }} />
      {!noTag && !src && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 11,
            fontFamily: "var(--ln-mono)",
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "rgba(241,235,224,0.6)",
          }}
        >
          {label ? `${label} · cover` : "cover"}
        </div>
      )}
      {children}
    </div>
  );
}

// ── The moment (signature element) — quiet editorial margin note ──
export function LNMoment({
  note,
  accent,
}: {
  note: { sec: number; label?: string; note: string };
  accent?: string;
}) {
  const gold = accent || "var(--ln-accent)";
  const ts = lnFmt(note.sec);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div
        style={{
          width: 2,
          borderRadius: 2,
          background: `linear-gradient(${gold}, ${gold}33)`,
          flexShrink: 0,
          boxShadow: `0 0 10px ${gold}55`,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 1 }}>
        <span style={{ fontFamily: "var(--ln-mono)", fontSize: 12.5, color: gold, letterSpacing: "0.02em" }}>
          {ts}
          {note.label ? <span style={{ opacity: 0.6 }}> · {note.label}</span> : null}
        </span>
        {note.note && (
          <span style={{ fontFamily: "var(--ln-body)", fontSize: 13.5, lineHeight: 1.4, color: "rgba(var(--ln-fg-rgb),0.82)" }}>
            {note.note}
          </span>
        )}
      </div>
    </div>
  );
}
