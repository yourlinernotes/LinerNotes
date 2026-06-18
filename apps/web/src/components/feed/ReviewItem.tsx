"use client";

import { useState } from "react";
import type { Review } from "@/lib/types";
import Link from "next/link";

interface ReviewItemProps {
  review: Review;
  onLike?: (reviewId: string) => Promise<void>;
  onRepost?: (reviewId: string) => Promise<void>;
}

export function ReviewItem({ review, onLike, onRepost }: ReviewItemProps) {
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [repostCount, setRepostCount] = useState(review.repostCount);
  const [likedByMe, setLikedByMe] = useState(review.likedByMe || false);
  const [repostedByMe, setRepostedByMe] = useState(review.repostedByMe || false);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading) return;

    setLoading(true);

    // Optimistic UI update
    const wasLiked = likedByMe;
    setLikedByMe(!wasLiked);
    setLikeCount((prev) => prev + (wasLiked ? -1 : 1));

    try {
      if (onLike) {
        await onLike(review.id);
      } else {
        // Fallback to mock API
        const { mockAPI } = await import("@/lib/mocks");
        const result = await mockAPI.likeReview(review.id);
        setLikeCount(result.likeCount);
        setLikedByMe(result.likedByMe);
      }
    } catch (error) {
      // Revert on error
      setLikedByMe(wasLiked);
      setLikeCount((prev) => prev + (wasLiked ? 1 : -1));
      console.error("Failed to like:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRepost = async () => {
    if (loading) return;

    setLoading(true);

    // Optimistic UI update
    const wasReposted = repostedByMe;
    setRepostedByMe(!wasReposted);
    setRepostCount((prev) => prev + (wasReposted ? -1 : 1));

    try {
      if (onRepost) {
        await onRepost(review.id);
      } else {
        // Fallback to mock API
        const { mockAPI } = await import("@/lib/mocks");
        const result = await mockAPI.repostReview(review.id);
        setRepostCount(result.repostCount);
        setRepostedByMe(result.repostedByMe);
      }
    } catch (error) {
      // Revert on error
      setRepostedByMe(wasReposted);
      setRepostCount((prev) => prev + (wasReposted ? 1 : -1));
      console.error("Failed to repost:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className="p-5 rounded-xl space-y-4 transition-all hover:shadow-lg border"
      style={{
        backgroundColor: "var(--ln-surface)",
        borderColor: "rgba(217, 178, 90, 0.1)",
      }}
    >
      {/* User Info */}
      <div className="flex items-center gap-3">
        {review.user?.avatarUrl && (
          <Link href={`/profile/${review.user?.handle}`}>
            <img
              src={review.user.avatarUrl}
              alt={review.user.displayName}
              className="w-10 h-10 rounded-full ring-2 ring-offset-2 hover:opacity-90 transition-opacity"
              style={{
                '--tw-ring-color': 'var(--ln-accent)',
                '--tw-ring-offset-color': 'var(--ln-surface)',
              } as React.CSSProperties}
            />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${review.user?.handle}`}
            className="font-semibold hover:opacity-80 transition-opacity block truncate"
            style={{ color: "var(--ln-ink)" }}
          >
            {review.user?.displayName || "Unknown User"}
          </Link>
          <span className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
            {formatDate(review.createdAt)}
          </span>
        </div>
        <Link
          href={`/card/${review.id}`}
          className="text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-all font-medium shadow-sm"
          style={{
            backgroundColor: "var(--ln-accent)",
            color: "var(--ln-bg)",
          }}
        >
          View
        </Link>
      </div>

      {/* Track + Review - Clickable */}
      <Link
        href={`/card/${review.id}`}
        className="block group cursor-pointer"
      >
        <div className="flex gap-4">
          <img
            src={review.track.artworkUrl}
            alt={review.track.album}
            className="w-24 h-24 rounded-lg object-cover shadow-md group-hover:shadow-xl transition-shadow"
          />
          <div className="flex-1 space-y-2 min-w-0">
            <div
              className="font-bold text-lg leading-tight truncate group-hover:opacity-80 transition-opacity"
              style={{ color: "var(--ln-ink)" }}
            >
              {review.track.name}
            </div>
            <div className="text-sm truncate" style={{ color: "var(--ln-ink-soft)" }}>
              {review.track.artist}
            </div>
            <div className="flex items-center gap-2">
              <StarDisplay rating={review.rating} />
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--ln-accent)" }}
              >
                {review.rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Take */}
        {review.take && (
          <div
            className="mt-3 italic pl-4 border-l-3 leading-relaxed"
            style={{
              color: "var(--ln-ink)",
              borderColor: "var(--ln-accent)",
              borderLeftWidth: "3px",
            }}
          >
            "{review.take}"
          </div>
        )}

        {/* Moment */}
        {review.moment && (
          <div
            className="mt-2 text-sm inline-block px-3 py-1 rounded-full"
            style={{
              color: "var(--ln-accent)",
              backgroundColor: "rgba(217, 178, 90, 0.1)",
            }}
          >
            <span className="font-medium">{formatTime(review.moment.seconds)}</span>
            <span className="mx-2">•</span>
            <span>{review.moment.label}</span>
          </div>
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "rgba(217, 178, 90, 0.1)" }}>
        <button
          onClick={handleLike}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:scale-105 transition-all disabled:opacity-50 font-medium shadow-sm"
          style={{
            backgroundColor: likedByMe ? "var(--ln-accent)" : "var(--ln-line)",
            color: likedByMe ? "white" : "var(--ln-ink)",
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">{likeCount}</span>
        </button>

        <button
          onClick={handleRepost}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:scale-105 transition-all disabled:opacity-50 font-medium shadow-sm"
          style={{
            backgroundColor: repostedByMe ? "var(--ln-peach)" : "var(--ln-line)",
            color: repostedByMe ? "white" : "var(--ln-ink)",
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
          </svg>
          <span className="text-sm">{repostCount}</span>
        </button>
      </div>
    </div>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const stars = [];

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <svg key={i} className="w-4 h-4" fill="var(--ln-accent)" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <svg key={i} className="w-4 h-4" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half-star-feed">
              <stop offset="50%" stopColor="var(--ln-accent)" />
              <stop offset="50%" stopColor="var(--ln-line)" />
            </linearGradient>
          </defs>
          <path
            fill="url(#half-star-feed)"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
          />
        </svg>
      );
    } else {
      stars.push(
        <svg key={i} className="w-4 h-4" fill="var(--ln-line)" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    }
  }

  return <div className="flex gap-0.5">{stars}</div>;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
