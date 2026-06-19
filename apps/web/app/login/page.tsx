"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const INK = "#f8ecdb";
const PAPER = "#1a0a0c";
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

function LoginForm() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        displayName,
        action: isSignup ? "signup" : "login",
        redirect: false,
      });
      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => signIn("google", { callbackUrl });

  const gold = "var(--ln-accent)";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "#0a0908", position: "relative", overflow: "hidden" }}>
      {/* card */}
      <div style={{ position: "relative", width: "100%", maxWidth: 440, background: PAPER, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,205,165,0.14)", boxShadow: "0 50px 110px -34px rgba(0,0,0,0.8)", animation: "ln-pop 0.3s cubic-bezier(.16,1,.3,1) both" }}>
        {/* garnet glow */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(90% 50% at 50% -8%, #7a1d24 0%, #3a0f14 40%, ${PAPER} 72%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(64% 32% at 50% 0%, ${gold}4d 0%, transparent 60%)` }} />
        </div>

        <div style={{ position: "relative", padding: "44px 32px 32px" }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 26, color: INK, letterSpacing: "-0.02em" }}>LinerNotes</span>
            <span style={{ fontFamily: "var(--ln-body)", fontSize: 9, letterSpacing: "0.14em", color: gold, textTransform: "uppercase", fontWeight: 700, border: `1px solid ${gold}66`, borderRadius: 999, padding: "2px 6px", position: "relative", top: -5 }}>beta</span>
          </div>

          <h2 style={{ margin: "20px 0 0", fontFamily: "var(--ln-syne)", fontWeight: 700, fontSize: 25, lineHeight: 1.16, color: INK, letterSpacing: "-0.01em" }}>
            {isSignup ? "Get early access to the app." : "Welcome back."}
          </h2>
          <p style={{ margin: "10px 0 0", fontFamily: "var(--ln-body)", fontSize: 14.5, lineHeight: 1.5, color: muted(0.64) }}>
            {isSignup
              ? "LinerNotes for iOS & Android is rolling out in waves. Create your account to start logging."
              : "Pick up where you left off — your notes and the friends you'd tell."}
          </p>

          {(errorParam || error) && (
            <div style={{ marginTop: 18, padding: "11px 13px", borderRadius: 12, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.45)", color: "#ffb4b4", fontFamily: "var(--ln-body)", fontSize: 13.5 }}>
              {error || "Authentication error. Please try again."}
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 11 }}>
            <button onClick={handleGoogleSignIn} className="ln-press" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: "pointer", background: "#f4ede0", color: "#1a1714", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 600, boxShadow: "0 10px 26px -14px rgba(0,0,0,0.8)" }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v7.8h12.4c-.3 2.1-1.6 5.2-4.6 7.3l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.5z" />
                <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.7 2.3-8.8 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "3px 0" }}>
              <span style={{ flex: 1, height: 1, background: LINE }} />
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: muted(0.45), letterSpacing: "0.05em" }}>or</span>
              <span style={{ flex: 1, height: 1, background: LINE }} />
            </div>

            <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {isSignup && (
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required={isSignup} placeholder="Your name" style={inputStyle} />
              )}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@email.com" inputMode="email" style={inputStyle} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="••••••••" style={inputStyle} />
              <button type="submit" disabled={loading} className="ln-press" style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: loading ? "default" : "pointer", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700, boxShadow: `0 12px 30px -10px ${gold}cc`, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Please wait…" : isSignup ? "Join the beta" : "Log in"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 6, fontFamily: "var(--ln-body)", fontSize: 13, color: muted(0.64) }}>
              {isSignup ? "Already have an account?" : "New to LinerNotes?"}{" "}
              <button onClick={() => { setIsSignup(!isSignup); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: gold, fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: 0 }}>
                {isSignup ? "Log in" : "Join the beta"}
              </button>
            </div>

            <p style={{ textAlign: "center", marginTop: 8, fontFamily: "var(--ln-mono)", fontSize: 9.5, lineHeight: 1.5, color: muted(0.38), letterSpacing: "0.02em" }}>
              No Spotify or Last.fm account needed. Connect your listening later, in the app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0908", color: INK }}>
          <span style={{ fontFamily: "var(--ln-logo)", fontWeight: 800, fontSize: 26 }}>LinerNotes</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
