"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function AuthButton() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

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

  if (session) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
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
    <Link
      href="/login"
      className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: "var(--ln-accent)",
        color: "white",
      }}
    >
      Login
    </Link>
  );
}
