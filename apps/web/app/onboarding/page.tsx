"use client";

/**
 * Web Onboarding Flow
 * Two-step process after signup: (1) Create profile, (2) "How do you listen?" —
 * one chooser that connects Last.fm (OAuth), Spotify (sp_dc cookie, keyless), or
 * ListenBrainz (username, keyless). All optional/skippable; connecting powers the
 * asking-prompts, now-playing badge, and This-Week four. Mirrors mobile.
 */

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const INK = "#f8ecdb";
const PAPER = "#1a0a0c";
const GOLD = "#D4AF37";
const LINE = "rgba(255,205,165,0.16)";
const muted = (a: number) => `rgba(248,236,219,${a})`;

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(248,236,219,0.06)",
  color: INK,
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  padding: "14px 15px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
};

const ctaStyle: React.CSSProperties = {
  width: "100%",
  background: GOLD,
  color: PAPER,
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontFamily: "var(--ln-body)",
  fontSize: 14.5,
  fontWeight: 600,
  cursor: "pointer",
};

/** A tappable listening-provider row in the "how do you listen?" chooser. */
function ProviderCard({
  name,
  blurb,
  active,
  expanded,
  onToggle,
  children,
}: {
  name: string;
  blurb: string;
  active?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${active ? "rgba(127,207,155,0.4)" : LINE}`,
        borderRadius: 16,
        padding: "14px 16px",
        background: active ? "rgba(127,207,155,0.06)" : "rgba(248,236,219,0.03)",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          cursor: onToggle ? "pointer" : "default",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--ln-album)", fontSize: 17, fontWeight: 600, color: INK }}>
            {name}
            {active && <span style={{ color: "#7fcf9b", fontSize: 13, marginLeft: 8 }}>✓ connected</span>}
          </div>
          <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: muted(0.55), marginTop: 3 }}>{blurb}</div>
        </div>
        {onToggle && (
          <span style={{ color: muted(0.5), fontSize: 18, transform: expanded ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
        )}
      </button>
      {children}
    </div>
  );
}

type OnboardingStep = 1 | 2;

function OnboardingContent() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Listening-connect chooser state.
  type Provider = "lastfm" | "spotify" | "listenbrainz";
  const [openProvider, setOpenProvider] = useState<Provider | null>(null);
  const [connected, setConnected] = useState<Provider | null>(null);
  const [spDc, setSpDc] = useState("");
  const [lbUsername, setLbUsername] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  // Check if redirected from Last.fm OAuth
  useEffect(() => {
    const c = searchParams.get("lastfm_connected");
    if (c === "true") {
      setConnected("lastfm");
      setStep(2);
    }
  }, [searchParams]);

  // After connecting a keyless provider, confirm we can actually read a play.
  const confirmNowPlaying = async () => {
    try {
      const r = await fetch("/api/listening/now");
      const d = r.ok ? await r.json() : null;
      const np = d?.nowPlaying;
      if (np?.track) {
        setConnectMsg(`We see you ${np.isPlaying ? "playing" : "last played"}: ${np.track} — ${np.artist}`);
      } else {
        setConnectMsg("Connected. We'll pick up your plays as you listen.");
      }
    } catch {
      setConnectMsg("Connected.");
    }
  };

  const connectSpotify = async () => {
    if (!spDc.trim()) return;
    setConnecting(true);
    setError("");
    try {
      const r = await fetch("/api/connect/spotify-spdc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spDc: spDc.trim() }),
      });
      if (!r.ok) throw new Error("Couldn't connect Spotify — check the sp_dc value.");
      setConnected("spotify");
      setOpenProvider(null);
      await confirmNowPlaying();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const connectListenBrainz = async () => {
    if (!lbUsername.trim()) return;
    setConnecting(true);
    setError("");
    try {
      const r = await fetch("/api/connect/listenbrainz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: lbUsername.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't find that ListenBrainz user.");
      }
      setConnected("listenbrainz");
      setOpenProvider(null);
      await confirmNowPlaying();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  // Redirect to home if user already has a handle (already onboarded)
  useEffect(() => {
    if (session?.user?.handle) {
      router.push("/");
    }
  }, [session, router]);

  const saveProfile = async () => {
    if (!displayName.trim() || !handle.trim()) {
      setError("Display name and handle are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          handle: handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
          bio: bio.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save profile");
      }

      // Update session
      await updateSession();

      // Move to step 2 (Last.fm connection)
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectLastFm = () => {
    // Redirect to Last.fm OAuth flow (returns to /onboarding?lastfm_connected=true)
    window.location.href = "/api/connect/lastfm?callbackUrl=/onboarding";
  };

  const finishOnboarding = () => router.push("/");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(60% 45% at 26% 14%, #2a1f18 0%, ${PAPER} 58%, #1a1512 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(248,236,219,0.03)",
          border: `1px solid ${LINE}`,
          borderRadius: 22,
          padding: "32px 28px",
        }}
      >
        {/* Step 1: Profile Creation */}
        {step === 1 && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--ln-album)",
                  fontSize: 32,
                  fontWeight: 600,
                  color: INK,
                  marginBottom: 8,
                }}
              >
                Create your profile
              </h1>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--ln-body)",
                  fontSize: 15,
                  color: muted(0.7),
                  lineHeight: 1.5,
                }}
              >
                Tell us a bit about yourself. You can always edit this later.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--ln-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: muted(0.6),
                    marginBottom: 8,
                  }}
                >
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                  maxLength={50}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--ln-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: muted(0.6),
                    marginBottom: 8,
                  }}
                >
                  Handle
                </label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 15,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontFamily: "var(--ln-body)",
                      fontSize: 15,
                      color: muted(0.5),
                    }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) =>
                      setHandle(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "")
                      )
                    }
                    placeholder="yourhandle"
                    style={{ ...inputStyle, paddingLeft: 30 }}
                    maxLength={30}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--ln-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: muted(0.6),
                    marginBottom: 8,
                  }}
                >
                  Bio (Optional)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about your music taste..."
                  style={{
                    ...inputStyle,
                    minHeight: 80,
                    resize: "vertical",
                    fontFamily: "var(--ln-body)",
                  }}
                  maxLength={200}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255,100,100,0.1)",
                    border: "1px solid rgba(255,100,100,0.3)",
                    borderRadius: 12,
                    fontFamily: "var(--ln-body)",
                    fontSize: 14,
                    color: "#ff6b6b",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={saveProfile}
                disabled={loading || !displayName.trim() || !handle.trim()}
                style={{
                  width: "100%",
                  background: GOLD,
                  color: PAPER,
                  border: "none",
                  borderRadius: 14,
                  padding: "15px 20px",
                  fontFamily: "var(--ln-body)",
                  fontSize: 15.5,
                  fontWeight: 600,
                  cursor:
                    loading || !displayName.trim() || !handle.trim()
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    loading || !displayName.trim() || !handle.trim() ? 0.5 : 1,
                }}
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </div>
          </>
        )}

        {/* Step 2: How do you listen? — one chooser */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--ln-album)", fontSize: 32, fontWeight: 600, color: INK, marginBottom: 8 }}>
                How do you listen?
              </h1>
              <p style={{ margin: 0, fontFamily: "var(--ln-body)", fontSize: 15, color: muted(0.7), lineHeight: 1.5 }}>
                Connect your listening and LinerNotes suggests what to write about — from what you actually played. Optional, and you can change it later.
              </p>
            </div>

            {connectMsg && (
              <div style={{ padding: "14px 16px", background: "rgba(127,207,155,0.1)", border: "1px solid rgba(127,207,155,0.3)", borderRadius: 14, marginBottom: 18, fontFamily: "var(--ln-body)", fontSize: 14, color: "#7fcf9b" }}>
                ✓ {connectMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Last.fm */}
              <ProviderCard
                name="Last.fm"
                blurb="Best if you already scrobble. One-tap connect."
                active={connected === "lastfm"}
              >
                <button onClick={connectLastFm} style={ctaStyle}>
                  {connected === "lastfm" ? "Reconnect Last.fm" : "Connect Last.fm"}
                </button>
              </ProviderCard>

              {/* Spotify (sp_dc, keyless) */}
              <ProviderCard
                name="Spotify"
                blurb="No Last.fm? Connect Spotify directly — works for everyone."
                active={connected === "spotify"}
                onToggle={() => setOpenProvider(openProvider === "spotify" ? null : "spotify")}
                expanded={openProvider === "spotify"}
              >
                {openProvider === "spotify" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <p style={{ margin: 0, fontFamily: "var(--ln-body)", fontSize: 12.5, color: muted(0.55), lineHeight: 1.5 }}>
                      Paste your <code>sp_dc</code> cookie from a logged-in open.spotify.com session
                      (DevTools → Application → Cookies → sp_dc). It stays private to your account.
                    </p>
                    <input value={spDc} onChange={(e) => setSpDc(e.target.value)} placeholder="sp_dc value" style={inputStyle} />
                    <button onClick={connectSpotify} disabled={connecting || !spDc.trim()} style={{ ...ctaStyle, opacity: connecting || !spDc.trim() ? 0.5 : 1 }}>
                      {connecting ? "Connecting…" : "Connect Spotify"}
                    </button>
                  </div>
                )}
              </ProviderCard>

              {/* ListenBrainz (keyless) */}
              <ProviderCard
                name="ListenBrainz"
                blurb="Open-source scrobbling. Just your username."
                active={connected === "listenbrainz"}
                onToggle={() => setOpenProvider(openProvider === "listenbrainz" ? null : "listenbrainz")}
                expanded={openProvider === "listenbrainz"}
              >
                {openProvider === "listenbrainz" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <input value={lbUsername} onChange={(e) => setLbUsername(e.target.value)} placeholder="ListenBrainz username" style={inputStyle} />
                    <button onClick={connectListenBrainz} disabled={connecting || !lbUsername.trim()} style={{ ...ctaStyle, opacity: connecting || !lbUsername.trim() ? 0.5 : 1 }}>
                      {connecting ? "Connecting…" : "Connect ListenBrainz"}
                    </button>
                  </div>
                )}
              </ProviderCard>

              {error && (
                <div style={{ padding: "12px 14px", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 12, fontFamily: "var(--ln-body)", fontSize: 14, color: "#ff6b6b" }}>
                  {error}
                </div>
              )}

              <button onClick={finishOnboarding} style={{ width: "100%", background: connected ? GOLD : "transparent", color: connected ? PAPER : muted(0.7), border: connected ? "none" : `1px solid ${LINE}`, borderRadius: 14, padding: "15px 20px", fontFamily: "var(--ln-body)", fontSize: 15.5, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                {connected ? "Continue to LinerNotes" : "Skip for now"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "radial-gradient(60% 45% at 26% 14%, #2a1f18 0%, #1a0a0c 58%, #1a1512 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "3px solid rgba(248,236,219,0.15)",
              borderTopColor: "#D4AF37",
              animation: "ln-spin 0.8s linear infinite",
            }}
          />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
