"use client";

import { useEffect, useState } from "react";
import { AuthButton } from "@/components/AuthButton";
import { checkAuth } from "@/lib/api";
import Link from "next/link";

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth()
      .then((status) => setAuthenticated(status.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main
        className="min-h-screen p-8 flex items-center justify-center"
        style={{ backgroundColor: "var(--ln-bg)" }}
      >
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--ln-accent)" }}
        />
      </main>
    );
  }

  // If authenticated, redirect to feed
  if (authenticated) {
    return (
      <main className="min-h-screen p-8" style={{ backgroundColor: "var(--ln-bg)" }}>
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Navigation */}
          <div className="flex justify-end gap-4 items-center">
            <Link
              href="/log"
              className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              Log Review
            </Link>
            <Link
              href="/feed"
              className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
              }}
            >
              Feed
            </Link>
            <Link
              href="/friends"
              className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
              }}
            >
              Friends
            </Link>
            <AuthButton />
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-6 py-12">
            <h1 className="text-5xl font-bold" style={{ color: "var(--ln-ink)" }}>
              Welcome to LinerNotes
            </h1>
            <p className="text-xl" style={{ color: "var(--ln-ink-soft)" }}>
              Share your music reviews with emotion and personality
            </p>
            <div className="flex gap-4 justify-center pt-6">
              <Link
                href="/log"
                className="px-8 py-4 rounded-lg text-lg font-medium transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: "var(--ln-accent)",
                  color: "white",
                }}
              >
                Write a Review
              </Link>
              <Link
                href="/feed"
                className="px-8 py-4 rounded-lg text-lg font-medium transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: "var(--ln-surface)",
                  color: "var(--ln-ink)",
                }}
              >
                See Your Feed
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Landing page for non-authenticated users
  return (
    <main className="min-h-screen p-8" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Hero */}
        <div className="text-center space-y-6 py-12">
          <h1 className="text-6xl font-bold" style={{ color: "var(--ln-ink)" }}>
            LinerNotes
          </h1>
          <p className="text-2xl" style={{ color: "var(--ln-ink-soft)" }}>
            Music reviews with emotion and personality
          </p>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--ln-ink-soft)" }}>
            Rate tracks, share your takes, mark the moment that hit you.
            <br />
            Create beautiful review cards and share them with friends.
          </p>
          <div className="pt-6">
            <a
              href="/api/auth/spotify/login"
              className="inline-block px-10 py-5 rounded-lg text-xl font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              Login with Spotify
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: "var(--ln-surface)" }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: "var(--ln-ink)" }}>
              Rate & Review
            </h3>
            <p style={{ color: "var(--ln-ink-soft)" }}>
              0.5-5.0 star ratings with optional one-liner takes. Simple or detailed,
              your choice.
            </p>
          </div>
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: "var(--ln-surface)" }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: "var(--ln-ink)" }}>
              Mark the Moment
            </h3>
            <p style={{ color: "var(--ln-ink-soft)" }}>
              Timestamp the exact second that gave you chills, made you cry, or blew
              your mind.
            </p>
          </div>
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: "var(--ln-surface)" }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: "var(--ln-ink)" }}>
              Share Everywhere
            </h3>
            <p style={{ color: "var(--ln-ink-soft)" }}>
              Export beautiful cards to Instagram Stories, or share with friends on
              LinerNotes.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
