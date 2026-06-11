"use client";

import { useEffect, useState } from "react";
import { checkAuth } from "@/lib/api";
import { AuthButton } from "./AuthButton";
import Link from "next/link";

export function UserNav() {
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth()
      .then((status) => {
        if (status.authenticated && status.userHandle) {
          setUserHandle(status.userHandle);
        }
      })
      .catch(() => {
        setUserHandle(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <AuthButton />;
  }

  return (
    <div className="flex gap-4 items-center">
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
      {userHandle && (
        <Link
          href={`/profile/${userHandle}`}
          className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "var(--ln-surface)",
            color: "var(--ln-ink)",
          }}
        >
          Profile
        </Link>
      )}
      <AuthButton />
    </div>
  );
}
