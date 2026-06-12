"use client";

import type { UnifiedFeedItem } from "@/lib/types";
import { ReviewItem } from "./ReviewItem";
import { AlbumReviewItem } from "./AlbumReviewItem";

interface FeedListProps {
  items: UnifiedFeedItem[];
  onLike?: (reviewId: string) => Promise<void>;
  onRepost?: (reviewId: string) => Promise<void>;
  onAlbumLike?: (albumReviewId: string) => Promise<void>;
  onAlbumRepost?: (albumReviewId: string) => Promise<void>;
}

export function FeedList({ items, onLike, onRepost, onAlbumLike, onAlbumRepost }: FeedListProps) {
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
      {items.map((item, index) => {
        const itemId = item.kind === "review" || item.kind === "repost"
          ? item.review.id
          : (item as any).albumReview.id;

        return (
          <div key={`${itemId}-${index}`}>
            {/* Repost Header */}
            {(item.kind === "repost" || item.kind === "album_repost") && item.repostedBy && (
              <div className="mb-2 flex items-center gap-2 text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                <svg className="w-4 h-4" fill="var(--ln-peach)" viewBox="0 0 20 20">
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
                <span>
                  <span className="font-medium">{item.repostedBy.displayName}</span> reposted
                </span>
              </div>
            )}

            {/* Track Review */}
            {(item.kind === "review" || item.kind === "repost") && (
              <ReviewItem review={item.review} onLike={onLike} onRepost={onRepost} />
            )}

            {/* Album Review */}
            {(item.kind === "album_review" || item.kind === "album_repost") && (
              <AlbumReviewItem albumReview={(item as any).albumReview} onLike={onAlbumLike} onRepost={onAlbumRepost} />
            )}
          </div>
        );
      })}
    </div>
  );
}
