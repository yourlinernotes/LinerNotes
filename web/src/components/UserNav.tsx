"use client";

import { useSession } from "next-auth/react";
import { AuthButton } from "./AuthButton";
import Link from "next/link";

export function UserNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <AuthButton />;
  }

  const userHandle = session?.user?.handle;

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
