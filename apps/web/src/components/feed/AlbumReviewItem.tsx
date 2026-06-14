"use client";

import type { AlbumReview } from "@/lib/types";
import Link from "next/link";

interface AlbumReviewItemProps {
  albumReview: AlbumReview;
  onLike?: (albumReviewId: string) => Promise<void>;
  onRepost?: (albumReviewId: string) => Promise<void>;
}

export function AlbumReviewItem({
  albumReview,
  onLike,
  onRepost,
}: AlbumReviewItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getReactionEmoji = (reaction?: string) => {
    switch (reaction) {
      case "flame":
        return "🔥";
      case "love":
        return "❤️";
      case "skip":
        return "⏭️";
      default:
        return null;
    }
  };

  // Get tracks with reactions (the ones that stuck)
  const reactedTracks = albumReview.trackReviews?.filter(
    (tr) => tr.reaction || tr.notes?.length || tr.take
  ) || [];

  return (
    <Link href={`/album-card/${albumReview.id}`}>
      <div
        className="p-4 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
        style={{ backgroundColor: "var(--ln-surface)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {albumReview.user?.avatarUrl && (
              <img
                src={albumReview.user.avatarUrl}
                alt={albumReview.user.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${albumReview.user?.handle}`}
                  className="font-medium hover:underline"
                  style={{ color: "var(--ln-ink)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {albumReview.user?.displayName || "Unknown User"}
                </Link>
                <span className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                  @{albumReview.user?.handle}
                </span>
                <span className="mx-1" style={{ color: "var(--ln-ink-soft)" }}>
                  •
                </span>
                <span className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                  {formatDate(albumReview.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={`/album-card/${albumReview.id}`}
            className="text-sm px-3 py-1 rounded hover:opacity-80"
            style={{
              backgroundColor: "var(--ln-line)",
              color: "var(--ln-ink-soft)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            Share
          </Link>
        </div>

        {/* Album Content */}
        <div className="flex gap-4">
          <img
            src={albumReview.album.artworkUrl}
            alt={albumReview.album.name}
            className="w-24 h-24 rounded object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold truncate" style={{ color: "var(--ln-ink)" }}>
                {albumReview.album.name}
              </span>
              {albumReview.overallRating && (
                <span className="text-sm flex-shrink-0" style={{ color: "var(--ln-accent)" }}>
                  ⭐ {albumReview.overallRating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="text-sm mb-2 truncate" style={{ color: "var(--ln-ink-soft)" }}>
              {albumReview.album.artist}
            </div>

            {/* Album Take */}
            {albumReview.take && (
              <p className="text-sm italic line-clamp-2 mb-2" style={{ color: "var(--ln-ink)" }}>
                "{albumReview.take}"
              </p>
            )}

            {/* Reactions Preview */}
            {reactedTracks.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs" style={{ color: "var(--ln-ink-soft)" }}>
                  {reactedTracks.length} track{reactedTracks.length !== 1 ? "s" : ""} stood out:
                </span>
                <div className="flex gap-1">
                  {reactedTracks.slice(0, 8).map((tr) =>
                    tr.reaction ? (
                      <span key={tr.id} className="text-sm">
                        {getReactionEmoji(tr.reaction)}
                      </span>
                    ) : null
                  )}
                  {reactedTracks.length > 8 && (
                    <span className="text-xs opacity-75">
                      +{reactedTracks.length - 8}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Footer Stats */}
            <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLike?.(albumReview.id);
                }}
                className="flex items-center gap-1 hover:opacity-70"
              >
                <span>{albumReview.likedByMe ? "❤️" : "🤍"}</span>
                <span>{albumReview.likeCount || 0}</span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRepost?.(albumReview.id);
                }}
                className="flex items-center gap-1 hover:opacity-70"
              >
                <svg
                  className="w-4 h-4"
                  fill={albumReview.repostedByMe ? "var(--ln-peach)" : "currentColor"}
                  viewBox="0 0 20 20"
                >
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
                <span>{albumReview.repostCount || 0}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
