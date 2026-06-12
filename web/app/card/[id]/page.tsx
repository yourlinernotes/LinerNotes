"use client";

import { ReviewCard } from "@/components/card";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Review } from "@/lib/types";

export default function CardPage() {
  const params = useParams();
  const id = params.id as string;

  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);

  useEffect(() => {
    const loadReview = async () => {
      try {
        const res = await fetch(`/api/reviews/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setReview(data.review);

        // Check if current user is the owner
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const authData = await authRes.json();
          setIsOwner(authData.userId === data.review.userId);
        }
      } catch (error) {
        console.error("Failed to fetch review:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadReview();
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

  const handleSetFeaturedNote = async (noteId: string) => {
    if (!review) return;

    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredNoteId: noteId }),
      });

      if (!res.ok) {
        alert('Failed to update featured note');
        return;
      }

      const data = await res.json();
      setReview(data.review);
      setShowNotePicker(false);
    } catch (error) {
      console.error('Failed to update featured note:', error);
      alert('Failed to update featured note');
    }
  };

  const handleShareToStory = async () => {
    if (!review) return;

    const url = window.location.href;

    try {
      // Copy link to clipboard
      await navigator.clipboard.writeText(url);

      // Generate image of the export card (without links)
      const cardElement = document.querySelector('#export-card .review-card');
      if (!cardElement) {
        alert("Card not found. Try again in a moment.");
        return;
      }

      const { toPng } = await import('html-to-image');

      // Convert card to image with transparent background
      const dataUrl = await toPng(cardElement as HTMLElement, {
        quality: 1,
        pixelRatio: 2, // Higher quality for Instagram
        backgroundColor: 'transparent', // Transparent background for sticker
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Try Instagram's native sharing API first (mobile only)
      const isInstagramAvailable = /Instagram/i.test(navigator.userAgent);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && isInstagramAvailable) {
        // Use Instagram's sticker layer format
        // This works when sharing from Instagram's in-app browser
        const stickerFile = new File([blob], 'sticker.png', { type: 'image/png' });

        const shareData = {
          files: [stickerFile],
          title: `${review.track.name} review`,
          text: url, // The link will be available to paste
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      // Fallback: Download and provide instructions
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'linernotes-review.png';
      link.click();

      alert(
        "✅ Link copied! Image downloaded.\n\n" +
        "📸 To share to Instagram Story:\n" +
        "1. Open Instagram\n" +
        "2. Create a new story with any background\n" +
        "3. Tap the sticker icon → Camera Roll\n" +
        "4. Select the downloaded review card\n" +
        "5. Add a link sticker → paste the copied link\n" +
        "6. Position the review card over the link to hide it"
      );
    } catch (error) {
      console.error("Failed to share:", error);
      alert("Failed to prepare story. Try the 'Copy Link' button instead.");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--ln-accent)" }} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0a0a0a", color: "white" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Review Not Found</h1>
          <p className="opacity-75">This review doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4" style={{ backgroundColor: "#0a0a0a" }}>
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
          <button
            onClick={handleShareToStory}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "white" }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            Share to Story
          </button>
          {isOwner && review.notes && review.notes.length > 1 && (
            <button
              onClick={() => setShowNotePicker(!showNotePicker)}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80 flex items-center gap-2"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "white" }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Choose Featured Note
            </button>
          )}
        </div>
        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.5)", maxWidth: "320px" }}>
          Tip: The card exports as a transparent sticker. Add it to your story, then hide the link sticker underneath it.
        </p>
      </div>

      {/* Note Picker Modal */}
      {showNotePicker && review.notes && review.notes.length > 0 && (
        <div className="w-full max-w-md p-4 rounded-lg space-y-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Select Featured Note</h3>
            <button
              onClick={() => setShowNotePicker(false)}
              className="text-white opacity-75 hover:opacity-100"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {review.notes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSetFeaturedNote(note.id)}
                className="w-full p-3 rounded-lg text-left transition-all hover:opacity-90"
                style={{
                  backgroundColor: review.featuredNoteId === note.id ? "var(--ln-accent)" : "rgba(255,255,255,0.1)",
                  color: "white",
                  border: review.featuredNoteId === note.id ? "2px solid white" : "none",
                }}
              >
                <div className="flex items-center gap-2 font-medium">
                  {review.featuredNoteId === note.id && <span>★</span>}
                  <span>{formatTime(note.seconds)} · {note.label}</span>
                </div>
                {note.note && (
                  <p className="text-sm opacity-75 mt-1">"{note.note}"</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visible card with links */}
      <ReviewCard review={review} />

      {/* Hidden card without links for Instagram export - positioned off-screen */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }} id="export-card">
        <ReviewCard review={review} hideLinks={true} />
      </div>
    </div>
  );
}
