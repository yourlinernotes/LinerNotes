"use client";

import { ComposeForm } from "@/components/compose";
import { UserNav } from "@/components/UserNav";
import { searchTracks } from "@/lib/api";
import Link from "next/link";

export default function LogPage() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
            Log a Review
          </h1>
          <UserNav />
        </div>

        {/* Info */}
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: "var(--ln-surface)", color: "var(--ln-ink-soft)" }}
        >
          <p className="text-sm">
            Search for a track, rate it (0.5–5.0), optionally add your take and mark a
            moment. Minimum: just a rating!
          </p>
        </div>

        {/* Compose Form */}
        <div
          className="p-6 rounded-lg"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          <ComposeForm searchAPI={searchTracks} />
        </div>
      </div>
    </div>
  );
}
