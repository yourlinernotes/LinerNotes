"use client";

import { useEffect, useState } from "react";
import { FeedList } from "@/components/feed";
import { UserNav } from "@/components/UserNav";
import { getReviews, checkAuth, toggleLike, toggleRepost } from "@/lib/api";
import type { FeedItem, Review } from "@/lib/types";
import Link from "next/link";

export default function FeedPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check auth and load feed
    const loadFeed = async () => {
      try {
        const authStatus = await checkAuth();
        setAuthenticated(authStatus.authenticated);

        if (!authStatus.authenticated) {
          setLoading(false);
          return;
        }

        // Get friends' reviews
        const reviews = await getReviews({ feed: "friends" });

        // Transform reviews into feed items
        // If a review has reposts, create multiple feed items
        const items: FeedItem[] = [];

        for (const review of reviews) {
          // Add original review
          items.push({
            kind: "review",
            review,
            at: review.createdAt,
          });

          // Add repost entries
          if ((review as any).reposts) {
            for (const repost of (review as any).reposts) {
              items.push({
                kind: "repost",
                review,
                repostedBy: repost.user,
                at: repost.createdAt,
              });
            }
          }
        }

        // Sort by creation time (most recent first)
        items.sort((a, b) => {
          const aTime = new Date(a.review.createdAt).getTime();
          const bTime = new Date(b.review.createdAt).getTime();
          return bTime - aTime;
        });

        setFeedItems(items);
      } catch (error) {
        console.error("Failed to load feed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, []);

  const handleLike = async (reviewId: string) => {
    try {
      const result = await toggleLike(reviewId);

      // Update feed items with new like count and status
      setFeedItems((items) =>
        items.map((item) =>
          item.review.id === reviewId
            ? {
                ...item,
                review: {
                  ...item.review,
                  likeCount: result.likeCount,
                  likedByMe: result.liked,
                },
              }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const handleRepost = async (reviewId: string) => {
    try {
      const result = await toggleRepost(reviewId);

      // Update feed items with new repost count and status
      setFeedItems((items) =>
        items.map((item) =>
          item.review.id === reviewId
            ? {
                ...item,
                review: {
                  ...item.review,
                  repostCount: result.repostCount,
                  repostedByMe: result.reposted,
                },
              }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to toggle repost:", error);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
            Friends Feed
          </h1>
          <UserNav />
        </div>

        {/* Not authenticated */}
        {!loading && !authenticated && (
          <div
            className="p-8 rounded-lg text-center"
            style={{
              backgroundColor: "var(--ln-surface)",
              color: "var(--ln-ink)",
            }}
          >
            <p className="text-lg mb-4">Login with Spotify to see your friends' reviews</p>
            <a
              href="/api/auth/spotify/login"
              className="inline-block px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              Login with Spotify
            </a>
          </div>
        )}

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
        {!loading && authenticated && (
          <FeedList items={feedItems} onLike={handleLike} onRepost={handleRepost} />
        )}
      </div>
    </div>
  );
}
