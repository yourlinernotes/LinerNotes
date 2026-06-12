"use client";

import { AlbumComposeForm } from "@/components/compose/AlbumComposeForm";
import { UserNav } from "@/components/UserNav";
import Link from "next/link";

export default function LogAlbumPage() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/log"
              className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
              }}
            >
              ← Track Review
            </Link>
            <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
              Review an Album
            </h1>
          </div>
          <UserNav />
        </div>

        {/* Info */}
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          <p className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
            <strong>Tip:</strong> You don't need to rate every track. React to the ones that stuck (flame/love/skip),
            add notes to standout moments, and let the rest gracefully fade into the background.
          </p>
        </div>

        {/* Form */}
        <AlbumComposeForm />
      </div>
    </div>
  );
}
