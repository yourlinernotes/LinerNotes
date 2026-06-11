"use client";

import { useRef, useState } from "react";
import { ReviewCard, useCardExport } from "@/components/card";
import { mockReviews } from "@/lib/mocks";

export default function Home() {
  const cardRef = useRef<HTMLDivElement>(null);
  const { exportCard, copyCardToClipboard } = useCardExport();
  const [selectedReview, setSelectedReview] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    if (!cardRef.current) return;

    setExporting(true);
    try {
      await exportCard(cardRef.current, mockReviews[selectedReview].id);
      alert("Card exported successfully!");
    } catch (error) {
      alert("Failed to export card. Check console for details.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;

    setExporting(true);
    try {
      await copyCardToClipboard(cardRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert("Failed to copy card. Check console for details.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen p-8" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold" style={{ color: "var(--ln-ink)" }}>
            LinerNotes Review Card
          </h1>
          <p className="text-lg" style={{ color: "var(--ln-ink-soft)" }}>
            Preview and export review cards
          </p>
        </div>

        {/* Review selector */}
        <div className="flex justify-center gap-2">
          {mockReviews.map((review, idx) => (
            <button
              key={review.id}
              onClick={() => setSelectedReview(idx)}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor:
                  selectedReview === idx
                    ? "var(--ln-accent)"
                    : "var(--ln-surface)",
                color:
                  selectedReview === idx
                    ? "white"
                    : "var(--ln-ink)",
              }}
            >
              Review {idx + 1}
            </button>
          ))}
        </div>

        {/* Card preview */}
        <div className="flex flex-col items-center gap-6">
          <div ref={cardRef}>
            <ReviewCard review={mockReviews[selectedReview]} />
          </div>

          {/* Export controls */}
          <div className="flex gap-4">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              {exporting ? "Exporting..." : "Download as PNG"}
            </button>

            <button
              onClick={handleCopy}
              disabled={exporting}
              className="px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: "var(--ln-peach)",
                color: "white",
              }}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>

          {/* Share link */}
          <div className="text-center space-y-2">
            <p className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              Public share link:
            </p>
            <code
              className="px-4 py-2 rounded text-sm"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-accent-2)",
              }}
            >
              {typeof window !== "undefined"
                ? `${window.location.origin}/card/${mockReviews[selectedReview].id}`
                : `/card/${mockReviews[selectedReview].id}`}
            </code>
          </div>
        </div>

        {/* Info */}
        <div
          className="text-center text-sm p-6 rounded-lg"
          style={{
            backgroundColor: "var(--ln-surface)",
            color: "var(--ln-ink-soft)",
          }}
        >
          <p>
            This is Anusha's feat/card branch demo.
            <br />
            Card colors are extracted from album art dynamically.
            <br />
            The waveform shows the marked moment with an accent notch.
          </p>
        </div>
      </div>
    </main>
  );
}
