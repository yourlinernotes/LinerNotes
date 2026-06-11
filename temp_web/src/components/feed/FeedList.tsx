"use client";

import type { FeedItem } from "@/lib/types";
import { ReviewItem } from "./ReviewItem";

interface FeedListProps {
  items: FeedItem[];
  onLike?: (reviewId: string) => Promise<void>;
  onRepost?: (reviewId: string) => Promise<void>;
}

export function FeedList({ items, onLike, onRepost }: FeedListProps) {
  if (items.length === 0) {
    return (
      <div
        className="p-8 rounded-lg text-center"
        style={{
          backgroundColor: "var(--ln-surface)",
          color: "var(--ln-ink-soft)",
        }}
      >
        <p>No reviews yet. Follow some friends and check back!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.review.id}-${index}`}>
          {/* Repost Header */}
          {item.kind === "repost" && item.repostedBy && (
            <div className="mb-2 flex items-center gap-2 text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              <svg className="w-4 h-4" fill="var(--ln-peach)" viewBox="0 0 20 20">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              <span>
                <span className="font-medium">{item.repostedBy.displayName}</span> reposted
              </span>
            </div>
          )}

          {/* Review */}
          <ReviewItem review={item.review} onLike={onLike} onRepost={onRepost} />
        </div>
      ))}
    </div>
  );
}
