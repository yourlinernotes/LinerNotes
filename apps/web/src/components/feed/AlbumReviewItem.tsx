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
    <div
      className="p-5 rounded-xl space-y-4 transition-all hover:shadow-lg border"
      style={{
        backgroundColor: "var(--ln-surface)",
        borderColor: "rgba(217, 178, 90, 0.1)",
      }}
    >
      {/* User Info */}
      <div className="flex items-center gap-3">
        {albumReview.user?.avatarUrl && (
          <Link href={`/profile/${albumReview.user?.handle}`}>
            <img
              src={albumReview.user.avatarUrl}
              alt={albumReview.user.displayName}
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
            href={`/profile/${albumReview.user?.handle}`}
            className="font-semibold hover:opacity-80 transition-opacity block truncate"
            style={{ color: "var(--ln-ink)" }}
          >
            {albumReview.user?.displayName || "Unknown User"}
          </Link>
          <span className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
            {formatDate(albumReview.createdAt)}
          </span>
        </div>
        <Link
          href={`/album-card/${albumReview.id}`}
          className="text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-all font-medium shadow-sm"
          style={{
            backgroundColor: "var(--ln-accent)",
            color: "var(--ln-bg)",
          }}
        >
          View
        </Link>
      </div>

      {/* Album Content - Clickable */}
      <Link
        href={`/album-card/${albumReview.id}`}
        className="block group cursor-pointer"
      >
        <div className="flex gap-4">
          <img
            src={albumReview.album.artworkUrl}
            alt={albumReview.album.name}
            className="w-24 h-24 rounded-lg object-cover shadow-md group-hover:shadow-xl transition-shadow flex-shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="font-bold text-lg leading-tight truncate group-hover:opacity-80 transition-opacity"
                style={{ color: "var(--ln-ink)" }}
              >
                {albumReview.album.name}
              </span>
              {albumReview.overallRating && (
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: "var(--ln-accent)" }}>
                  ⭐ {albumReview.overallRating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="text-sm truncate" style={{ color: "var(--ln-ink-soft)" }}>
              {albumReview.album.artist}
            </div>

            {/* Album Take */}
            {albumReview.take && (
              <p
                className="italic pl-4 border-l-3 leading-relaxed line-clamp-2"
                style={{
                  color: "var(--ln-ink)",
                  borderColor: "var(--ln-accent)",
                  borderLeftWidth: "3px",
                }}
              >
                "{albumReview.take}"
              </p>
            )}

            {/* Reactions Preview */}
            {reactedTracks.length > 0 && (
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
                style={{
                  backgroundColor: "rgba(217, 178, 90, 0.1)",
                  color: "var(--ln-accent)",
                }}
              >
                <span className="text-xs font-medium">
                  {reactedTracks.length} track{reactedTracks.length !== 1 ? "s" : ""} stood out
                </span>
                <div className="flex gap-1">
                  {reactedTracks.slice(0, 5).map((tr) =>
                    tr.reaction ? (
                      <span key={tr.id} className="text-sm">
                        {getReactionEmoji(tr.reaction)}
                      </span>
                    ) : null
                  )}
                  {reactedTracks.length > 5 && (
                    <span className="text-xs font-medium">
                      +{reactedTracks.length - 5}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "rgba(217, 178, 90, 0.1)" }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            onLike?.(albumReview.id);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:scale-105 transition-all font-medium shadow-sm"
          style={{
            backgroundColor: albumReview.likedByMe ? "var(--ln-accent)" : "var(--ln-line)",
            color: albumReview.likedByMe ? "white" : "var(--ln-ink)",
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">{albumReview.likeCount || 0}</span>
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            onRepost?.(albumReview.id);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:scale-105 transition-all font-medium shadow-sm"
          style={{
            backgroundColor: albumReview.repostedByMe ? "var(--ln-peach)" : "var(--ln-line)",
            color: albumReview.repostedByMe ? "white" : "var(--ln-ink)",
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
          </svg>
          <span className="text-sm">{albumReview.repostCount || 0}</span>
        </button>
      </div>
    </div>
  );
}
