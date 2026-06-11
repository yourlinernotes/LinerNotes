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

  const handleShareToStory = async () => {
    if (!review) return;

    const url = window.location.href;

    try {
      // Copy link to clipboard
      await navigator.clipboard.writeText(url);

      // Generate image of the card
      const cardElement = document.querySelector('.review-card');
      if (!cardElement) {
        alert("Card not found. Try again in a moment.");
        return;
      }

      const { toPng } = await import('html-to-image');

      // Convert card to image
      const dataUrl = await toPng(cardElement as HTMLElement, {
        quality: 1,
        pixelRatio: 2, // Higher quality for Instagram
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'review.png', { type: 'image/png' });

      // Check if we can use Web Share API (works on mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${review.track.name} - ${review.user?.displayName}'s review`,
          text: `Check out my review! Link: ${url}`,
        });
      } else {
        // Fallback: download the image and show instructions
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'review.png';
        link.click();

        alert(
          "Link copied! Image downloaded.\n\n" +
          "To share to Instagram Story:\n" +
          "1. Open Instagram\n" +
          "2. Upload the downloaded image to your story\n" +
          "3. Add a link sticker and paste the copied link"
        );
      }
    } catch (error) {
      console.error("Failed to share:", error);
      alert("Failed to prepare story. Try the 'Copy Link' button instead.");
    }
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
      <div className="flex gap-2">
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
      </div>

      <ReviewCard review={review} />
    </div>
  );
}
