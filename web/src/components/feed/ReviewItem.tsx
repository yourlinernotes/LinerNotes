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
      className="p-4 rounded-lg space-y-3"
      style={{ backgroundColor: "var(--ln-surface)" }}
    >
      {/* User Info */}
      <div className="flex items-center gap-2">
        {review.user?.avatarUrl && (
          <img
            src={review.user.avatarUrl}
            alt={review.user.displayName}
            className="w-8 h-8 rounded-full"
          />
        )}
        <div className="flex-1">
          <Link
            href={`/profile/${review.user?.handle}`}
            className="font-medium hover:opacity-80"
            style={{ color: "var(--ln-ink)" }}
          >
            {review.user?.displayName || "Unknown User"}
          </Link>
          <span className="mx-2" style={{ color: "var(--ln-ink-soft)" }}>
            •
          </span>
          <span className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
            {formatDate(review.createdAt)}
          </span>
        </div>
        <Link
          href={`/card/${review.id}`}
          className="text-sm px-3 py-1 rounded hover:opacity-80"
          style={{
            backgroundColor: "var(--ln-line)",
            color: "var(--ln-ink-soft)",
          }}
        >
          Share
        </Link>
      </div>

      {/* Track + Review */}
      <div className="flex gap-3">
        <img
          src={review.track.artworkUrl}
          alt={review.track.album}
          className="w-20 h-20 rounded object-cover"
        />
        <div className="flex-1 space-y-1">
          <div className="font-bold" style={{ color: "var(--ln-ink)" }}>
            {review.track.name}
          </div>
          <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
            {review.track.artist}
          </div>
          <div className="flex items-center gap-1">
            <StarDisplay rating={review.rating} />
            <span className="text-sm font-medium" style={{ color: "var(--ln-accent)" }}>
              {review.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Take */}
      {review.take && (
        <div
          className="italic pl-4 border-l-2"
          style={{
            color: "var(--ln-ink)",
            borderColor: "var(--ln-accent)",
          }}
        >
          "{review.take}"
        </div>
      )}

      {/* Moment */}
      {review.moment && (
        <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
          {formatTime(review.moment.seconds)} • {review.moment.label}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleLike}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-50"
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
          <span className="text-sm font-medium">{likeCount}</span>
        </button>

        <button
          onClick={handleRepost}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-50"
          style={{
            backgroundColor: repostedByMe ? "var(--ln-peach)" : "var(--ln-line)",
            color: repostedByMe ? "white" : "var(--ln-ink)",
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
          </svg>
          <span className="text-sm font-medium">{repostCount}</span>
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
