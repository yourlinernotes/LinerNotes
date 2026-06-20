"use client";

/**
 * Web Onboarding Flow
 * Two-step process after signup: (1) Create profile, (2) Connect Last.fm (optional)
 * Mirrors mobile onboarding but uses OAuth for Last.fm instead of just username
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
  const [lastfmConnected, setLastfmConnected] = useState(false);

  // Check if redirected from Last.fm OAuth
  useEffect(() => {
    const connected = searchParams.get("lastfm_connected");
    if (connected === "true") {
      setLastfmConnected(true);
    }
  }, [searchParams]);

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
    // Redirect to Last.fm OAuth flow
    window.location.href = "/api/connect/lastfm?callbackUrl=/onboarding";
  };

  const skipLastFm = () => {
    // Complete onboarding and go to home
    router.push("/");
  };

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

        {/* Step 2: Last.fm Connection */}
        {step === 2 && (
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
                Connect Last.fm
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
                {lastfmConnected
                  ? "Last.fm connected! We'll suggest songs from your listening history."
                  : "Connect your Last.fm account to get personalized prompts based on what you're listening to. (Optional)"}
              </p>
            </div>

            {lastfmConnected ? (
              <div
                style={{
                  padding: "16px 18px",
                  background: "rgba(127,207,155,0.1)",
                  border: "1px solid rgba(127,207,155,0.3)",
                  borderRadius: 14,
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <circle cx="10" cy="10" r="10" fill="#7fcf9b" />
                  <path
                    d="M6 10l3 3 5-6"
                    stroke={PAPER}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{
                    fontFamily: "var(--ln-body)",
                    fontSize: 14,
                    color: "#7fcf9b",
                  }}
                >
                  Last.fm account connected successfully
                </span>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!lastfmConnected && (
                <button
                  onClick={connectLastFm}
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
                    cursor: "pointer",
                  }}
                >
                  Connect Last.fm
                </button>
              )}

              <button
                onClick={skipLastFm}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: muted(0.7),
                  border: `1px solid ${LINE}`,
                  borderRadius: 14,
                  padding: "15px 20px",
                  fontFamily: "var(--ln-body)",
                  fontSize: 15.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {lastfmConnected ? "Continue to LinerNotes" : "Skip for now"}
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
