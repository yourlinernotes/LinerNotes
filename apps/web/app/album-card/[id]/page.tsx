"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AlbumReview } from "@/lib/types";

export default function AlbumCardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [albumReview, setAlbumReview] = useState<AlbumReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadAlbumReview = async () => {
      try {
        const res = await fetch(`/api/album-reviews/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setAlbumReview(data.albumReview);

        // Check if current user is the owner
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const authData = await authRes.json();
          const ownerStatus = authData.userId === data.albumReview.userId;
          console.log('Album owner check:', { currentUserId: authData.userId, albumReviewUserId: data.albumReview.userId, isOwner: ownerStatus });
          setIsOwner(ownerStatus);
        }
      } catch (error) {
        console.error("Failed to fetch album review:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadAlbumReview();
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getReactionEmoji = (reaction?: string) => {
    switch (reaction) {
      case "flame": return "🔥";
      case "love": return "❤️";
      case "skip": return "⏭️";
      default: return null;
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleDelete = async () => {
    if (!albumReview) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/album-reviews/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete album review');
      }

      // Navigate back to home/feed after successful deletion
      router.push('/');
    } catch (error) {
      console.error('Failed to delete album review:', error);
      alert('Failed to delete album review: ' + (error as Error).message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--ln-accent)" }} />
      </div>
    );
  }

  if (!albumReview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0a0a0a", color: "white" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Album Review Not Found</h1>
          <p className="opacity-75">This review doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  // Get tracks with reactions (the ones that stuck)
  const reactedTracks = albumReview.trackReviews?.filter(tr => tr.reaction || tr.notes?.length || tr.take) || [];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Close button - fixed top right */}
      <button
        onClick={handleClose}
        className="fixed top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-80 z-50"
        style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "white" }}
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
            style={{ backgroundColor: copied ? "var(--ln-accent)" : "rgba(255,255,255,0.1)", color: "white" }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.5)", maxWidth: "320px" }}>
          Share this album review with friends
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md p-6 rounded-lg space-y-4" style={{ backgroundColor: "#1a1a1a" }}>
            <h3 className="text-xl font-bold text-white">Delete Album Review?</h3>
            <p className="text-white opacity-75">
              Are you sure you want to delete this album review? This action cannot be undone and will delete all track reviews as well.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "white" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#dc2626", color: "white" }}
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "white" }} />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Album Review Card */}
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#1a1a1a", color: "#ffffff" }}
      >
        {/* Album Art & Header */}
        <div className="relative">
          <img
            src={albumReview.album.artworkUrl}
            alt={albumReview.album.name}
            className="w-full aspect-square object-cover"
          />

          {/* Overall Rating Overlay */}
          {albumReview.overallRating && (
            <div
              className="absolute top-4 right-4 px-4 py-2 rounded-lg backdrop-blur-md text-2xl font-bold"
              style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            >
              ⭐ {albumReview.overallRating.toFixed(1)}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Album Info */}
          <div>
            <h2 className="text-3xl font-bold leading-tight">{albumReview.album.name}</h2>
            <p className="text-lg opacity-75 mt-1">{albumReview.album.artist}</p>
            {albumReview.album.releaseDate && (
              <p className="text-sm opacity-60 mt-1">
                {new Date(albumReview.album.releaseDate).getFullYear()}
                {albumReview.album.totalTracks && ` • ${albumReview.album.totalTracks} tracks`}
              </p>
            )}
          </div>

          {/* Album Take */}
          {albumReview.take && (
            <blockquote
              className="text-xl italic leading-relaxed border-l-4 pl-4"
              style={{ borderColor: "var(--ln-accent)" }}
            >
              "{albumReview.take}"
            </blockquote>
          )}

          {/* The Ones That Stuck */}
          {reactedTracks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold opacity-75">The ones that stuck</h3>
              <div className="space-y-3">
                {reactedTracks.map((tr) => (
                  <div
                    key={tr.id}
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm opacity-50 w-6">{tr.trackNumber}</span>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tr.track.name}</span>
                          {tr.reaction && (
                            <span className="text-xl">{getReactionEmoji(tr.reaction)}</span>
                          )}
                          <span className="text-sm opacity-75">⭐ {tr.rating.toFixed(1)}</span>
                        </div>

                        {tr.take && (
                          <p className="text-sm opacity-90 italic">"{tr.take}"</p>
                        )}

                        {tr.notes && tr.notes.length > 0 && (
                          <div className="space-y-1">
                            {tr.notes.map((note) => (
                              <div key={note.id} className="text-sm opacity-75 flex items-center gap-2">
                                <span>🔖 {formatTime(note.seconds)} · {note.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t space-y-2 text-sm opacity-60"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            <div className="flex items-center justify-between">
              <span>made on LinerNotes</span>
              {albumReview.user && <span>@{albumReview.user.handle}</span>}
            </div>
            <div className="text-xs opacity-75">
              {formatDate(albumReview.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Delete button - below the card */}
      {isOwner && (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-80 flex items-center gap-2 mt-4"
          style={{ backgroundColor: "rgba(220,38,38,0.2)", color: "#ff6b6b" }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Delete Album Review
        </button>
      )}
    </div>
  );
}
