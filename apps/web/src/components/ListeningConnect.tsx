"use client";

/**
 * The "how do you listen?" chooser — shared by onboarding and Settings.
 *
 * Connects any of the three listening providers, all optional:
 *  - Last.fm    (OAuth redirect)
 *  - Spotify    (keyless sp_dc cookie paste — the no-Last.fm path for everyone)
 *  - ListenBrainz (keyless username)
 *
 * Reflects current connection state (via /api/connect/status), lets you connect
 * or disconnect each, and after a keyless connect echoes back "we see you
 * playing X" so it's obvious it worked.
 */

import { useEffect, useState } from "react";

type Provider = "lastfm" | "spotify" | "listenbrainz";
type Status = {
  lastfm: { connected: boolean; username: string | null };
  spotify: { connected: boolean };
  listenbrainz: { connected: boolean; username: string | null };
};

export function ListeningConnect({
  lastfmCallbackUrl = "/onboarding",
  onChange,
}: {
  /** Where Last.fm OAuth returns to. */
  lastfmCallbackUrl?: string;
  /** Fired after any connect/disconnect so the host can refresh counts, etc. */
  onChange?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState<Provider | null>(null);
  const [lb, setLb] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = () =>
    fetch("/api/connect/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});

  useEffect(() => { loadStatus(); }, []);

  const confirm = async () => {
    try {
      const d = await fetch("/api/listening/now").then((r) => (r.ok ? r.json() : null));
      const np = d?.nowPlaying;
      setMsg(np?.track ? `We see you ${np.isPlaying ? "playing" : "last played"}: ${np.track} — ${np.artist}` : "Connected. We'll pick up your plays as you listen.");
    } catch { setMsg("Connected."); }
  };

  const after = async () => { await loadStatus(); onChange?.(); };

  const connectLB = async () => {
    if (!lb.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/connect/listenbrainz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: lb.trim() }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Couldn't find that ListenBrainz user."); }
      setLb(""); setOpen(null); await confirm(); await after();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const disconnect = async (path: string) => {
    setBusy(true); setError(null);
    try { await fetch(path, { method: "DELETE" }); setMsg(null); await after(); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  const connectLastFm = () => { window.location.href = `/api/connect/lastfm?callbackUrl=${encodeURIComponent(lastfmCallbackUrl)}`; };

  const st = status;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {msg && (
        <div style={{ padding: "12px 14px", background: "rgba(127,207,155,0.1)", border: "1px solid rgba(127,207,155,0.3)", borderRadius: 12, fontFamily: "var(--ln-body)", fontSize: 13.5, color: "#7fcf9b" }}>✓ {msg}</div>
      )}

      {/* Last.fm */}
      <Card name="Last.fm" blurb="Best if you already scrobble. One-tap connect." connected={!!st?.lastfm.connected} sub={st?.lastfm.username || undefined}>
        {st?.lastfm.connected ? (
          <button type="button" onClick={() => disconnect("/api/connect/lastfm")} disabled={busy} style={ghost}>Disconnect</button>
        ) : (
          <button type="button" onClick={connectLastFm} style={cta}>Connect Last.fm</button>
        )}
      </Card>

      {/* Spotify — captured effortlessly in the app (WebView); web rides that.
          A web page can't read Spotify's HttpOnly cookie, so there's no paste. */}
      <Card name="Spotify" blurb="Full listening history, uncapped." connected={!!st?.spotify.connected}>
        {st?.spotify.connected ? (
          <button type="button" onClick={() => disconnect("/api/connect/spotify-spdc")} disabled={busy} style={ghost}>Disconnect</button>
        ) : (
          <p style={hint}>Connect Spotify in the LinerNotes app — one tap, no password. It syncs here automatically once you do.</p>
        )}
      </Card>

      {/* ListenBrainz */}
      <Card name="ListenBrainz" blurb="Open-source scrobbling. Just your username." connected={!!st?.listenbrainz.connected} sub={st?.listenbrainz.username || undefined} onToggle={() => setOpen(open === "listenbrainz" ? null : "listenbrainz")} expanded={open === "listenbrainz"}>
        {st?.listenbrainz.connected ? (
          <button type="button" onClick={() => disconnect("/api/connect/listenbrainz")} disabled={busy} style={ghost}>Disconnect</button>
        ) : open === "listenbrainz" ? (
          <div style={col}>
            <input value={lb} onChange={(e) => setLb(e.target.value)} placeholder="ListenBrainz username" style={input} />
            <button type="button" onClick={connectLB} disabled={busy || !lb.trim()} style={{ ...cta, opacity: busy || !lb.trim() ? 0.5 : 1 }}>{busy ? "Connecting…" : "Connect ListenBrainz"}</button>
          </div>
        ) : null}
      </Card>

      {error && (
        <div style={{ padding: "10px 12px", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 10, fontFamily: "var(--ln-body)", fontSize: 13, color: "#ff6b6b" }}>{error}</div>
      )}
    </div>
  );
}

function Card({ name, blurb, connected, sub, expanded, onToggle, children }: { name: string; blurb: string; connected?: boolean; sub?: string; expanded?: boolean; onToggle?: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${connected ? "rgba(127,207,155,0.4)" : "rgba(var(--ln-line-rgb),0.14)"}`, borderRadius: 16, padding: "14px 16px", background: connected ? "rgba(127,207,155,0.06)" : "rgba(var(--ln-fg-rgb),0.03)" }}>
      <button type="button" onClick={onToggle} style={{ all: "unset", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", cursor: onToggle && !connected ? "pointer" : "default", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--ln-album, var(--ln-display))", fontSize: 17, fontWeight: 600, color: "var(--ln-fg)" }}>
            {name}{connected && <span style={{ color: "#7fcf9b", fontSize: 13, marginLeft: 8 }}>✓ connected{sub ? ` · ${sub}` : ""}</span>}
          </div>
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "rgba(var(--ln-fg-rgb),0.55)", marginTop: 3 }}>{blurb}</div>
        </div>
        {onToggle && !connected && <span style={{ color: "rgba(var(--ln-fg-rgb),0.5)", fontSize: 18, transform: expanded ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>}
      </button>
      {children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

const cta: React.CSSProperties = { width: "100%", background: "var(--ln-accent)", color: "var(--ln-bg, #0a0908)", border: "none", borderRadius: 12, padding: "12px 16px", fontFamily: "var(--ln-body)", fontSize: 14.5, fontWeight: 600, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "none", border: "1px solid rgba(var(--ln-fg-rgb),0.18)", borderRadius: 999, padding: "8px 16px", fontFamily: "var(--ln-mono)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.7)", cursor: "pointer" };
const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const hint: React.CSSProperties = { margin: 0, fontFamily: "var(--ln-body)", fontSize: 12.5, color: "rgba(var(--ln-fg-rgb),0.55)", lineHeight: 1.5 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-line-rgb),0.14)", borderRadius: 12, padding: "12px 13px", fontFamily: "var(--ln-body)", fontSize: 14, outline: "none" };
