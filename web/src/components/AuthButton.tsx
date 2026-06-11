"use client";

import { useState, useEffect } from "react";
import { checkAuth, logout } from "@/lib/api";

export function AuthButton() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth()
      .then((status) => {
        setAuthenticated(status.authenticated);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div
        className="px-4 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: "var(--ln-surface)",
          color: "var(--ln-ink-soft)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (authenticated) {
    return (
      <button
        onClick={() => logout()}
        className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
        style={{
          backgroundColor: "var(--ln-surface)",
          color: "var(--ln-ink)",
        }}
      >
        Logout
      </button>
    );
  }

  return (
    <a
      href="/api/auth/spotify/login"
      className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: "var(--ln-accent)",
        color: "white",
      }}
    >
      Login with Spotify
    </a>
  );
}
