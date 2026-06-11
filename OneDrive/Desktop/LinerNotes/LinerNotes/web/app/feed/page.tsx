"use client";

import { useEffect, useState } from "react";
import { FeedList } from "@/components/feed";
import { mockFeedItems } from "@/lib/mocks";
import type { FeedItem } from "@/lib/types";
import Link from "next/link";

export default function FeedPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load feed on mount
    const loadFeed = async () => {
      // TODO: Replace with GET /api/feed when Abia's backend is ready
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
      setFeedItems(mockFeedItems);
      setLoading(false);
    };

    loadFeed();
  }, []);

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
            Friends Feed
          </h1>
          <nav className="flex gap-4">
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
              href="/profile/anusha"
              className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
              }}
            >
              Profile
            </Link>
          </nav>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div
              className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--ln-accent)" }}
            />
          </div>
        )}

        {/* Feed */}
        {!loading && <FeedList items={feedItems} />}
      </div>
    </div>
  );
}
