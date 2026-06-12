"use client";

import { useEffect, useState } from "react";
import { FeedList } from "@/components/feed";
import { UserNav } from "@/components/UserNav";
import { getReviews, checkAuth, toggleLike, toggleRepost } from "@/lib/api";
import type { UnifiedFeedItem, Review, AlbumReview } from "@/lib/types";
import Link from "next/link";

export default function FeedPage() {
  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>([]);
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

        // Get friends' track reviews
        const reviews = await getReviews({ feed: "friends" });

        // Get friends' album reviews
        const albumReviewsRes = await fetch("/api/album-reviews?feed=friends");
        const albumReviewsData = await albumReviewsRes.json();
        const albumReviews: AlbumReview[] = albumReviewsData.albumReviews || [];

        // Transform reviews into feed items
        const items: UnifiedFeedItem[] = [];

        // Add track reviews
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

        // Add album reviews
        for (const albumReview of albumReviews) {
          // Add original album review
          items.push({
            kind: "album_review",
            albumReview,
            at: albumReview.createdAt,
          });

          // Add album repost entries
          if ((albumReview as any).reposts) {
            for (const repost of (albumReview as any).reposts) {
              items.push({
                kind: "album_repost",
                albumReview,
                repostedBy: repost.user,
                at: repost.createdAt,
              });
            }
          }
        }

        // Sort by creation time (most recent first)
        items.sort((a, b) => {
          const aTime = new Date(a.at).getTime();
          const bTime = new Date(b.at).getTime();
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
          item.kind === "review" || item.kind === "repost"
            ? item.review.id === reviewId
              ? {
                  ...item,
                  review: {
                    ...item.review,
                    likeCount: result.likeCount,
                    likedByMe: result.liked,
                  },
                }
              : item
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
          item.kind === "review" || item.kind === "repost"
            ? item.review.id === reviewId
              ? {
                  ...item,
                  review: {
                    ...item.review,
                    repostCount: result.repostCount,
                    repostedByMe: result.reposted,
                  },
                }
              : item
            : item
        )
      );
    } catch (error) {
      console.error("Failed to toggle repost:", error);
    }
  };

  const handleAlbumLike = async (albumReviewId: string) => {
    try {
      const result = await fetch(`/api/album-reviews/${albumReviewId}/like`, {
        method: "POST",
      });
      const data = await result.json();

      // Update feed items with new like count and status
      setFeedItems((items) =>
        items.map((item) =>
          item.kind === "album_review" || item.kind === "album_repost"
            ? item.albumReview.id === albumReviewId
              ? {
                  ...item,
                  albumReview: {
                    ...item.albumReview,
                    likeCount: data.likeCount,
                    likedByMe: data.liked,
                  },
                }
              : item
            : item
        )
      );
    } catch (error) {
      console.error("Failed to toggle album like:", error);
    }
  };

  const handleAlbumRepost = async (albumReviewId: string) => {
    try {
      const result = await fetch(`/api/album-reviews/${albumReviewId}/repost`, {
        method: "POST",
      });
      const data = await result.json();

      // Update feed items with new repost count and status
      setFeedItems((items) =>
        items.map((item) =>
          item.kind === "album_review" || item.kind === "album_repost"
            ? item.albumReview.id === albumReviewId
              ? {
                  ...item,
                  albumReview: {
                    ...item.albumReview,
                    repostCount: data.repostCount,
                    repostedByMe: data.reposted,
                  },
                }
              : item
            : item
        )
      );
    } catch (error) {
      console.error("Failed to toggle album repost:", error);
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
          <FeedList
            items={feedItems}
            onLike={handleLike}
            onRepost={handleRepost}
            onAlbumLike={handleAlbumLike}
            onAlbumRepost={handleAlbumRepost}
          />
        )}
      </div>
    </div>
  );
}
