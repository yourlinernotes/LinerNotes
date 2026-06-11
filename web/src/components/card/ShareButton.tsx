"use client";

import { useState } from "react";

interface ShareButtonProps {
  reviewId: string;
  cardElement: HTMLElement | null;
}

export function ShareButton({ reviewId, cardElement }: ShareButtonProps) {
  const [sharing, setSharing] = useState(false);

  const shareToInstagram = async () => {
    if (!cardElement) return;

    setSharing(true);
    try {
      const { toPng } = await import("html-to-image");

      // Generate PNG blob
      const dataUrl = await toPng(cardElement, {
        quality: 1.0,
        pixelRatio: 2,
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Create file from blob
      const file = new File([blob], `linernotes-${reviewId}.png`, {
        type: "image/png",
      });

      // Check if Web Share API is available
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My LinerNotes Review",
          text: "Check out my music review on LinerNotes!",
        });
      } else {
        // Fallback: Download the image
        const link = document.createElement("a");
        link.download = `linernotes-${reviewId}.png`;
        link.href = dataUrl;
        link.click();

        alert(
          "Image downloaded! Upload it to your Instagram story manually.\n\n" +
          "Tip: On mobile, use the share button to share directly to Instagram."
        );
      }
    } catch (error) {
      console.error("Share failed:", error);
      alert("Failed to share. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <button
      onClick={shareToInstagram}
      disabled={sharing || !cardElement}
      className="px-6 py-3 rounded-lg font-medium transition-opacity disabled:opacity-50"
      style={{
        backgroundColor: "var(--ln-accent-2)",
        color: "white",
      }}
    >
      {sharing ? "Preparing..." : "Share to Instagram"}
    </button>
  );
}
