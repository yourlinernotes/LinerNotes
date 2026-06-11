"use client";

import { useState } from "react";
import type { Track, Review, Moment } from "@/lib/types";
import { TrackSearch } from "./TrackSearch";
import { RatingSelector } from "./RatingSelector";

interface ComposeFormProps {
  onSubmit?: (review: Partial<Review>) => Promise<void>;
  onSuccess?: (review: Review) => void;
  searchAPI?: (query: string) => Promise<Track[]>;
}

export function ComposeForm({ onSubmit, onSuccess, searchAPI }: ComposeFormProps) {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [rating, setRating] = useState(3.5);
  const [take, setTake] = useState("");
  const [momentSeconds, setMomentSeconds] = useState("");
  const [momentLabel, setMomentLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrack) {
      alert("Please select a track first");
      return;
    }

    setSubmitting(true);

    try {
      const moment: Moment | undefined =
        momentSeconds && momentLabel
          ? { seconds: parseFloat(momentSeconds), label: momentLabel }
          : undefined;

      const reviewData: Partial<Review> = {
        track: selectedTrack,
        rating,
        take: take.trim() || undefined,
        moment,
      };

      if (onSubmit) {
        await onSubmit(reviewData);
      } else {
        // Fallback to mock API
        const { mockAPI } = await import("@/lib/mocks");
        const newReview = await mockAPI.submitReview(reviewData);
        onSuccess?.(newReview);
      }

      // Reset form
      setSelectedTrack(null);
      setRating(3.5);
      setTake("");
      setMomentSeconds("");
      setMomentLabel("");

      alert("Review submitted successfully!");
    } catch (error) {
      console.error("Failed to submit review:", error);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Track Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
          Search for a track
        </label>
        <TrackSearch onTrackSelect={setSelectedTrack} searchAPI={searchAPI} />
      </div>

      {/* Selected Track Preview */}
      {selectedTrack && (
        <div
          className="p-4 rounded-lg flex items-center gap-4"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          <img
            src={selectedTrack.artworkUrl}
            alt={selectedTrack.album}
            className="w-20 h-20 rounded object-cover"
          />
          <div className="flex-1">
            <div className="font-bold text-lg" style={{ color: "var(--ln-ink)" }}>
              {selectedTrack.name}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              {selectedTrack.artist} • {selectedTrack.album}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTrack(null)}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: "var(--ln-line)",
              color: "var(--ln-ink-soft)",
            }}
          >
            Change
          </button>
        </div>
      )}

      {/* Rating */}
      {selectedTrack && (
        <>
          <RatingSelector rating={rating} onChange={setRating} />

          {/* Take (optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Your take (optional)
            </label>
            <input
              type="text"
              value={take}
              onChange={(e) => setTake(e.target.value)}
              placeholder="What did you think? (one line)"
              maxLength={150}
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
                borderColor: "var(--ln-line)",
              }}
            />
            <div className="text-xs text-right" style={{ color: "var(--ln-ink-soft)" }}>
              {take.length}/150
            </div>
          </div>

          {/* Moment (optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Mark the moment (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={momentSeconds}
                onChange={(e) => setMomentSeconds(e.target.value)}
                placeholder="Seconds"
                min="0"
                max="600"
                step="1"
                className="flex-1 px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--ln-surface)",
                  color: "var(--ln-ink)",
                  borderColor: "var(--ln-line)",
                }}
              />
              <input
                type="text"
                value={momentLabel}
                onChange={(e) => setMomentLabel(e.target.value)}
                placeholder="Label (e.g., 'best bit')"
                maxLength={30}
                className="flex-1 px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--ln-surface)",
                  color: "var(--ln-ink)",
                  borderColor: "var(--ln-line)",
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg font-medium text-lg transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "var(--ln-accent)",
              color: "white",
            }}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </>
      )}
    </form>
  );
}
