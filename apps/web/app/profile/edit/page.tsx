"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar, Footer } from "@/components/ln/nav";
import { tintFromString } from "@/lib/palette";
import { ListeningConnect } from "@/components/ListeningConnect";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(var(--ln-fg-rgb),0.06)",
  color: "var(--ln-fg)",
  border: "1px solid rgba(var(--ln-line-rgb),0.16)",
  borderRadius: 13,
  padding: "13px 15px",
  fontFamily: "var(--ln-body)",
  fontSize: 15,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--ln-label)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "rgba(var(--ln-fg-rgb),0.55)",
  marginBottom: 8,
};

const hintStyle: React.CSSProperties = {
  fontFamily: "var(--ln-mono)",
  fontSize: 10.5,
  color: "rgba(var(--ln-fg-rgb),0.42)",
  marginTop: 7,
  lineHeight: 1.5,
};

function EditProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [handle, setHandle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Pick a photo from the device → resize to a small square → store inline (a
  // data URL). No storage infra needed; a 256px JPEG is ~20KB.
  const onAvatarFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setAvatarBusy(false); return; }
        // Center-crop cover.
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setAvatarUrl(canvas.toDataURL("image/jpeg", 0.85));
        setAvatarBusy(false);
      };
      img.onerror = () => setAvatarBusy(false);
      img.src = reader.result as string;
    };
    reader.onerror = () => setAvatarBusy(false);
    reader.readAsDataURL(file);
  };
  const [lastfmConnected, setLastfmConnected] = useState(false);
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [lastfmLoading, setLastfmLoading] = useState(false);
  const [lastfmError, setLastfmError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/");
            return;
          }
          throw new Error("Failed to load profile");
        }
        const data = await res.json();
        setDisplayName(data.user.displayName || "");
        setBio(data.user.bio || "");
        setAvatarUrl(data.user.avatarUrl || "");
        setHandle(data.user.handle || "");
      } catch (error) {
        console.error("Failed to load profile:", error);
        alert("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [router]);

  // Load Last.fm connection status
  useEffect(() => {
    const loadLastfmStatus = async () => {
      try {
        console.log("Fetching Last.fm connection status...");
        const res = await fetch("/api/connect/lastfm");
        console.log("Last.fm response status:", res.status);

        if (res.ok) {
          const data = await res.json();
          console.log("Last.fm response data:", data);
          setLastfmConnected(data.connected);
          setLastfmUsername(data.username || "");
          setLastfmError("");
        } else {
          // Non-200 response - log and show error
          const errorText = await res.text();
          console.error("Last.fm API error:", {
            status: res.status,
            statusText: res.statusText,
            body: errorText,
            headers: Object.fromEntries(res.headers.entries())
          });
          setLastfmError(`Failed to check Last.fm status (${res.status}): ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.error("Last.fm fetch error:", error);
        setLastfmError(`Failed to check Last.fm connection: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    loadLastfmStatus();

    // Check if redirected from Last.fm OAuth
    const connected = searchParams.get("lastfm_connected");
    if (connected === "true") {
      // Reload Last.fm status after a short delay to ensure the connection is saved
      setTimeout(loadLastfmStatus, 500);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
          handle: handle.trim().toLowerCase(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }
      const result = await res.json();
      router.push(`/profile/${result.user.handle}`);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectLastfm = () => {
    window.location.href = "/api/connect/lastfm?callbackUrl=/profile/edit";
  };

  const handleDisconnectLastfm = async () => {
    if (!confirm("Disconnect Last.fm? You can reconnect anytime.")) return;

    setLastfmLoading(true);
    try {
      const res = await fetch("/api/connect/lastfm", {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to disconnect Last.fm");
      }
      setLastfmConnected(false);
      setLastfmUsername("");
    } catch (error) {
      console.error("Failed to disconnect Last.fm:", error);
      alert("Failed to disconnect Last.fm");
    } finally {
      setLastfmLoading(false);
    }
  };

  const tint = tintFromString(handle || "ln");
  const gold = "var(--ln-accent)";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ln-bg)" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: gold, animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 560, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: "0 0 26px", fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Edit profile</h1>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22, padding: "26px 24px", borderRadius: 18, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {/* Tap the avatar to pick a photo from your device. */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="ln-press"
                style={{ position: "relative", width: 104, height: 104, borderRadius: "50%", padding: 0, border: "none", background: "none", cursor: "pointer", overflow: "hidden" }}
                aria-label="Change profile photo"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar preview" style={{ width: 104, height: 104, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: 104, height: 104, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${tint}22`, border: `1.5px solid ${tint}66`, color: tint, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 44 }}>
                    {(displayName || handle || "?")[0].toUpperCase()}
                  </div>
                )}
                {/* "camera" overlay hint */}
                <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(10,8,7,0.55)", color: "#f1ebe0", fontFamily: "var(--ln-mono)", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", padding: "3px 0", textAlign: "center" }}>
                  {avatarBusy ? "…" : "change"}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onAvatarFile(e.target.files?.[0])} style={{ display: "none" }} />
              <button type="button" onClick={() => fileRef.current?.click()} className="ln-press" style={{ padding: "9px 18px", borderRadius: 999, cursor: "pointer", background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.16)", fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600 }}>
                {avatarBusy ? "Processing…" : "Choose from device"}
              </button>
            </div>


            <div>
              <label style={labelStyle}>Display name *</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" required maxLength={50} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Handle *</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--ln-mono)", color: "rgba(var(--ln-fg-rgb),0.5)", fontSize: 16 }}>@</span>
                <input type="text" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="your_handle" required minLength={3} maxLength={20} pattern="[a-z0-9_]+" style={inputStyle} />
              </div>
              <p style={hintStyle}>3–20 chars · lowercase letters, numbers, underscores. Your URL: /profile/{handle || "your_handle"}</p>
            </div>

            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Logging the songs worth stopping for…" maxLength={200} rows={4} style={{ ...inputStyle, resize: "none" }} />
              <div style={{ ...hintStyle, textAlign: "right" }}>{bio.length}/200</div>
            </div>

            {/* Last.fm Connection Section */}
            <div style={{ borderTop: "1px solid rgba(var(--ln-line-rgb),0.12)", paddingTop: 22, marginTop: 8 }}>
              <label style={labelStyle}>Connected listening</label>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--ln-body)", fontSize: 13, color: "rgba(var(--ln-fg-rgb),0.6)", lineHeight: 1.5 }}>
                Connect a service so LinerNotes suggests what to write about — from what you actually play.
              </p>
              <ListeningConnect lastfmCallbackUrl="/profile/edit" />
            </div>

            <div style={{ display: "flex", gap: 11 }}>
              <button type="button" onClick={() => router.push(`/profile/${handle}`)} className="ln-press" style={{ flex: 1, padding: "13px", borderRadius: 13, cursor: "pointer", background: "rgba(var(--ln-fg-rgb),0.06)", color: "var(--ln-fg)", border: "1px solid rgba(var(--ln-fg-rgb),0.16)", fontFamily: "var(--ln-body)", fontWeight: 600 }}>Cancel</button>
              <button type="submit" disabled={saving || !displayName.trim()} className="ln-press" style={{ flex: 1, padding: "13px", borderRadius: 13, cursor: saving ? "default" : "pointer", background: gold, color: "#1a0a04", border: "none", fontFamily: "var(--ln-body)", fontWeight: 700, opacity: saving || !displayName.trim() ? 0.5 : 1 }}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ln-bg)" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
        </div>
      }
    >
      <EditProfileContent />
    </Suspense>
  );
}
