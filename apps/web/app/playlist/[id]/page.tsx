"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface PlaylistTrack {
  id: string;
  trackId: string;
  name: string;
  artist: string;
  artworkUrl: string;
  note?: string;
  order: number;
}

interface Playlist {
  id: string;
  userId: string;
  title: string;
  description?: string;
  tracks: PlaylistTrack[];
  user?: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl?: string;
  };
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  createdAt: string;
}

export default function PlaylistPage() {
  const params = useParams();
  const id = params.id as string;

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        const res = await fetch(`/api/playlists/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPlaylist(data.playlist);
      } catch (error) {
        console.error("Failed to fetch playlist:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadPlaylist();
    }
  }, [id]);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy link");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--ln-accent)" }}
        />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: "#0a0a0a", color: "white" }}
      >
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Playlist Not Found</h1>
          <p className="opacity-75 mb-6">
            This playlist doesn't exist yet, or playlists haven't been
            implemented.
          </p>
          <Link
            href="/feed"
            className="inline-block px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--ln-accent)", color: "white" }}
          >
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: "var(--ln-bg)" }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/feed"
            className="text-sm px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: "var(--ln-surface)",
              color: "var(--ln-ink)",
            }}
          >
            ← Back
          </Link>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
            style={{
              backgroundColor: copied
                ? "var(--ln-accent)"
                : "rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* Playlist Card */}
        <div
          className="p-6 rounded-xl space-y-6"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          {/* Playlist Header */}
          <div className="space-y-4">
            {/* User Info */}
            {playlist.user && (
              <div className="flex items-center gap-3">
                {playlist.user.avatarUrl && (
                  <img
                    src={playlist.user.avatarUrl}
                    alt={playlist.user.displayName}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <Link
                    href={`/profile/${playlist.user.handle}`}
                    className="font-semibold hover:opacity-80 transition-opacity"
                    style={{ color: "var(--ln-ink)" }}
                  >
                    {playlist.user.displayName}
                  </Link>
                  <p
                    className="text-sm"
                    style={{ color: "var(--ln-ink-soft)" }}
                  >
                    {formatDate(playlist.createdAt)}
                  </p>
                </div>
              </div>
            )}

            {/* Title & Description */}
            <div>
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: "var(--ln-ink)" }}
              >
                {playlist.title}
              </h1>
              {playlist.description && (
                <p
                  className="text-lg italic leading-relaxed"
                  style={{ color: "var(--ln-ink-soft)" }}
                >
                  "{playlist.description}"
                </p>
              )}
            </div>

            {/* Track Count */}
            <div
              className="inline-block px-4 py-2 rounded-full"
              style={{
                backgroundColor: "rgba(217, 178, 90, 0.1)",
                color: "var(--ln-accent)",
              }}
            >
              <span className="font-medium">
                {playlist.tracks.length} track
                {playlist.tracks.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Track List */}
          <div className="space-y-3">
            {playlist.tracks
              .sort((a, b) => a.order - b.order)
              .map((track, index) => (
                <div
                  key={track.id}
                  className="flex gap-4 p-4 rounded-lg hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: "rgba(217, 178, 90, 0.05)",
                    borderLeft: "3px solid var(--ln-accent)",
                  }}
                >
                  {/* Track Number */}
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: "var(--ln-accent)",
                      color: "var(--ln-bg)",
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Album Art */}
                  <img
                    src={track.artworkUrl}
                    alt={track.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold truncate"
                      style={{ color: "var(--ln-ink)" }}
                    >
                      {track.name}
                    </div>
                    <div
                      className="text-sm truncate"
                      style={{ color: "var(--ln-ink-soft)" }}
                    >
                      {track.artist}
                    </div>
                    {track.note && (
                      <p
                        className="text-sm italic mt-2 leading-relaxed"
                        style={{ color: "var(--ln-ink)" }}
                      >
                        "{track.note}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "rgba(217, 178, 90, 0.1)" }}>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:scale-105 transition-all font-medium shadow-sm"
              style={{
                backgroundColor: playlist.likedByMe
                  ? "var(--ln-accent)"
                  : "var(--ln-line)",
                color: playlist.likedByMe ? "white" : "var(--ln-ink)",
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">{playlist.likeCount}</span>
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:scale-105 transition-all font-medium shadow-sm"
              style={{
                backgroundColor: playlist.repostedByMe
                  ? "var(--ln-peach)"
                  : "var(--ln-line)",
                color: playlist.repostedByMe ? "white" : "var(--ln-ink)",
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
              </svg>
              <span className="text-sm">{playlist.repostCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
