"use client";

import { useEffect, useState } from "react";
import { UserNav } from "@/components/UserNav";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [originalHandle, setOriginalHandle] = useState("");

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
        setOriginalHandle(data.user.handle || "");
      } catch (error) {
        console.error("Failed to load profile:", error);
        alert("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

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

      // Redirect to profile (use new handle if it changed)
      router.push(`/profile/${result.user.handle}`);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center" style={{ backgroundColor: "var(--ln-bg)" }}>
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--ln-accent)" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
            Edit Profile
          </h1>
          <UserNav />
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-lg space-y-6"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          {/* Avatar Preview */}
          {avatarUrl && (
            <div className="flex justify-center">
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="w-32 h-32 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Avatar URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Avatar URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/your-avatar.jpg"
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--ln-bg)",
                color: "var(--ln-ink)",
                borderColor: "var(--ln-line)",
              }}
            />
            <p className="text-xs" style={{ color: "var(--ln-ink-soft)" }}>
              Paste a link to your profile picture. You can use your Spotify avatar or any image URL.
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              maxLength={50}
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--ln-bg)",
                color: "var(--ln-ink)",
                borderColor: "var(--ln-line)",
              }}
            />
          </div>

          {/* Handle */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Handle *
            </label>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--ln-ink-soft)" }}>@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="your_handle"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
                className="flex-1 px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--ln-bg)",
                  color: "var(--ln-ink)",
                  borderColor: "var(--ln-line)",
                }}
              />
            </div>
            <p className="text-xs" style={{ color: "var(--ln-ink-soft)" }}>
              3-20 characters, lowercase letters, numbers, and underscores only. Your profile URL will be /profile/@{handle || "your_handle"}
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={200}
              rows={4}
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{
                backgroundColor: "var(--ln-bg)",
                color: "var(--ln-ink)",
                borderColor: "var(--ln-line)",
              }}
            />
            <div className="text-xs text-right" style={{ color: "var(--ln-ink-soft)" }}>
              {bio.length}/200
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/profile/${handle}`)}
              className="flex-1 py-3 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-line)",
                color: "var(--ln-ink)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="flex-1 py-3 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
