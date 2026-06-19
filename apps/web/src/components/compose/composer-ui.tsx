"use client";

// Shared composer primitives ported from the design bundle's web-composer.jsx:
// tap-to-rate stars (half-star aware), the mm:ss moments editor, depth meter,
// toggle chips, and the editorial input style.

import { useState, type CSSProperties } from "react";
import { LNIcon, lnFmt } from "@/components/ln/atoms";

export const cmpInput: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(var(--ln-fg-rgb),0.06)",
  color: "var(--ln-fg)",
  border: "1px solid rgba(var(--ln-fg-rgb),0.14)",
  borderRadius: 12,
  padding: "12px 14px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
  resize: "none",
};

const GOLD = "var(--ln-accent)";

// ── Tap-to-rate stars (click left half = .5) ─────────────────
export function StarsInput({
  rating,
  onChange,
  size = 36,
}: {
  rating: number;
  onChange: (r: number) => void;
  size?: number;
}) {
  const set = (i: number, e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const half = e.clientX - r.left < r.width / 2;
    onChange(i + (half ? 0.5 : 1));
  };
  return (
    <div style={{ display: "inline-flex", gap: 7 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = rating >= i + 1 ? 1 : rating >= i + 0.5 ? 0.5 : 0;
        const gid = `cmp-star-${i}-${Math.round(rating * 10)}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" onClick={(e) => set(i, e)} style={{ cursor: "pointer", display: "block" }}>
            {fill === 0.5 && (
              <defs>
                <linearGradient id={gid}>
                  <stop offset="50%" stopColor={GOLD} />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <path
              d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12l-2.8-2.03c-.79-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z"
              fill={fill === 1 ? GOLD : fill === 0.5 ? `url(#${gid})` : "none"}
              stroke={GOLD}
              strokeWidth={fill === 0 ? 1.3 : 0}
              strokeOpacity={fill === 0 ? 0.4 : 1}
            />
          </svg>
        );
      })}
    </div>
  );
}

export type DraftMoment = { seconds: number; label: string; note: string };

// ── mm:ss moments editor (with optional label; defaults to "moment") ──
export function MomentsEditor({
  moments,
  onAdd,
  onRemove,
}: {
  moments: DraftMoment[];
  onAdd: (m: DraftMoment) => void;
  onRemove: (idx: number) => void;
}) {
  const [m, setM] = useState({ mm: "", ss: "", label: "", note: "" });
  const add = () => {
    if (!m.note.trim() && !m.label.trim()) return;
    const seconds = (parseInt(m.mm || "0", 10) || 0) * 60 + (parseInt(m.ss || "0", 10) || 0);
    onAdd({ seconds, label: m.label.trim() || "moment", note: m.note.trim() });
    setM({ mm: "", ss: "", label: "", note: "" });
  };
  const ready = !!(m.note.trim() || m.label.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {moments.map((mm, idx) => {
        const hasLabel = !!mm.label && mm.label !== "moment";
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, background: "rgba(var(--ln-fg-rgb),0.05)", border: "1px solid rgba(var(--ln-fg-rgb),0.08)" }}>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 12, color: "#1a0a04", background: GOLD, borderRadius: 6, padding: "2px 7px", flexShrink: 0, fontWeight: 600 }}>{lnFmt(mm.seconds)}</span>
            <span style={{ flex: 1, fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.85)", minWidth: 0 }}>
              {hasLabel && <span style={{ color: GOLD, fontWeight: 600 }}>{mm.label}</span>}
              {hasLabel && mm.note ? " · " : ""}
              {mm.note || (!hasLabel ? mm.label : "")}
            </span>
            <button type="button" onClick={() => onRemove(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <LNIcon name="close" size={14} color="rgba(var(--ln-fg-rgb),0.45)" />
            </button>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <input value={m.mm} onChange={(e) => setM((s) => ({ ...s, mm: e.target.value.replace(/\D/g, "").slice(0, 2) }))} placeholder="m" inputMode="numeric" style={{ ...cmpInput, width: 42, padding: "10px 0", textAlign: "center", fontFamily: "var(--ln-mono)" }} />
        <span style={{ fontFamily: "var(--ln-mono)", fontSize: 16, color: GOLD }}>:</span>
        <input value={m.ss} onChange={(e) => setM((s) => ({ ...s, ss: e.target.value.replace(/\D/g, "").slice(0, 2) }))} placeholder="ss" inputMode="numeric" style={{ ...cmpInput, width: 42, padding: "10px 0", textAlign: "center", fontFamily: "var(--ln-mono)" }} />
        <input value={m.label} onChange={(e) => setM((s) => ({ ...s, label: e.target.value.slice(0, 30) }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="label" style={{ ...cmpInput, width: 96, padding: "10px 11px", fontSize: 13 }} />
        <input value={m.note} onChange={(e) => setM((s) => ({ ...s, note: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="What happens here?" style={{ ...cmpInput, flex: 1, minWidth: 120, padding: "10px 12px", fontSize: 13.5 }} />
        <button type="button" onClick={add} className="ln-press" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, border: "none", cursor: ready ? "pointer" : "default", background: ready ? GOLD : "rgba(var(--ln-fg-rgb),0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="17" height="17" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke={ready ? "#1a0a04" : "rgba(var(--ln-fg-rgb),0.4)"} strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.04em", color: "rgba(var(--ln-fg-rgb),0.4)" }}>
        Label is optional — left blank, it&apos;s saved as “moment”.
      </div>
    </div>
  );
}

// ── Caption picker — choose which line of your note leads the card ──
export function CaptionPicker({
  lines,
  selected,
  onSelect,
}: {
  lines: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  if (lines.length < 2) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.06em", color: "rgba(var(--ln-fg-rgb),0.5)", textTransform: "uppercase", marginBottom: 8 }}>lead your card with</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {lines.map((ln, i) => {
          const sel = i === selected;
          return (
            <button key={i} type="button" onClick={() => onSelect(i)} style={{ display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${sel ? GOLD + "99" : "rgba(var(--ln-fg-rgb),0.12)"}`, background: sel ? `${GOLD}14` : "transparent" }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: `1.5px solid ${sel ? GOLD : "rgba(var(--ln-fg-rgb),0.3)"}`, background: sel ? GOLD : "transparent" }} />
              <span style={{ fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 15, lineHeight: 1.35, color: sel ? "var(--ln-fg)" : "rgba(var(--ln-fg-rgb),0.68)" }}>{ln}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Toggle chip (+/−) ────────────────────────────────────────
export function Chip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 500, border: `1px solid ${on ? GOLD + "88" : "rgba(var(--ln-fg-rgb),0.16)"}`, background: on ? `${GOLD}14` : "transparent", color: on ? GOLD : "rgba(var(--ln-fg-rgb),0.75)" }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{on ? "−" : "+"}</span>
      {label}
    </button>
  );
}

// ── Depth meter ──────────────────────────────────────────────
export type Depth = "floor" | "caption" | "full" | null;

export function DepthMeter({ depth, badge }: { depth: Depth; badge?: string }) {
  const idx = { floor: 0, caption: 1, full: 2 } as const;
  const label = depth === "floor" ? "A quick rating" : depth === "caption" ? "A caption" : depth === "full" ? "A full note" : "·";
  return (
    <div style={{ padding: "13px 15px", borderRadius: 14, background: "rgba(var(--ln-fg-rgb),0.04)", border: "1px solid rgba(var(--ln-fg-rgb),0.09)" }}>
      <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
        {(["floor", "caption", "full"] as const).map((dd, i) => (
          <div key={dd} style={{ flex: 1, height: 4, borderRadius: 3, background: depth && idx[depth] >= i ? GOLD : "rgba(var(--ln-fg-rgb),0.12)", transition: "background 0.2s" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "rgba(var(--ln-fg-rgb),0.7)" }}>
          Posts as <span style={{ color: GOLD, fontWeight: 600 }}>{label}</span>
        </span>
        {badge && <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: GOLD, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: `${GOLD}18` }}>{badge}</span>}
      </div>
    </div>
  );
}

// ── Mode tabs (Track | Album) — link between the two routes ──
export function ModeTabs({ active }: { active: "track" | "album" }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "rgba(var(--ln-fg-rgb),0.05)", border: "1px solid rgba(var(--ln-fg-rgb),0.09)" }}>
      {([["track", "Track", "/log"], ["album", "Album", "/log/album"]] as const).map(([m, label, href]) => (
        <a key={m} href={href} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, textDecoration: "none", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, background: active === m ? GOLD : "transparent", color: active === m ? "#1a0a04" : "rgba(var(--ln-fg-rgb),0.65)" }}>{label}</a>
      ))}
    </div>
  );
}

// ── Live-preview shell (label + dashed empty state) ──────────
export function PreviewShell({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return (
    <div className="lnw-cmp-prev" style={{ position: "relative", padding: "0 0 0 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>live preview</span>
        <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.12)" }} />
      </div>
      {ready ? (
        <div style={{ pointerEvents: "none" }}>{children}</div>
      ) : (
        <div style={{ borderRadius: 18, border: "1.5px dashed rgba(var(--ln-fg-rgb),0.16)", padding: "50px 24px", textAlign: "center", fontFamily: "var(--ln-body)", fontSize: 14, color: "rgba(var(--ln-fg-rgb),0.45)", lineHeight: 1.5 }}>
          Your card builds here as you rate and write.
        </div>
      )}
    </div>
  );
}
