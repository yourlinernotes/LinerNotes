"use client";

import { useState } from "react";
import type { Track, Review, Note } from "@/lib/types";
import { TrackSearch } from "./TrackSearch";
import { RatingSelector } from "./RatingSelector";

interface ComposeFormProps {
  onSubmit?: (review: Partial<Review>) => Promise<void>;
  onSuccess?: (review: Review) => void;
  searchAPI?: (query: string) => Promise<Track[]>;
}

interface NoteInput {
  time: string; // mm:ss format
  label: string;
  note?: string;
}

export function ComposeForm({ onSubmit, onSuccess, searchAPI }: ComposeFormProps) {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [rating, setRating] = useState(3.5);
  const [take, setTake] = useState("");
  const [notes, setNotes] = useState<NoteInput[]>([{ time: "", label: "", note: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrack) {
      alert("Please select a track first");
      return;
    }

    setSubmitting(true);

    try {
      // Convert notes from input format to API format
      const notesData = notes
        .filter(note => note.time && note.label) // Only include notes with time and label
        .map(note => {
          const parts = note.time.split(':');
          const mins = parts.length === 2 ? parseInt(parts[0]) || 0 : 0;
          const secs = parts.length === 2 ? parseInt(parts[1]) || 0 : 0;
          return {
            seconds: mins * 60 + secs,
            label: note.label,
            note: note.note?.trim() || undefined,
          };
        });

      const reviewData = {
        trackId: selectedTrack.trackId,
        trackName: selectedTrack.name,
        trackArtist: selectedTrack.artist,
        trackAlbum: selectedTrack.album,
        artworkUrl: selectedTrack.artworkUrl,
        previewUrl: selectedTrack.previewUrl,
        rating,
        take: take.trim() || undefined,
        notes: notesData.length > 0 ? notesData : undefined,
      };

      if (onSubmit) {
        await onSubmit(reviewData as any);
      } else {
        // Use real API
        const { createReview } = await import("@/lib/api");
        const newReview = await createReview(reviewData);
        onSuccess?.(newReview);
      }

      // Reset form
      setSelectedTrack(null);
      setRating(3.5);
      setTake("");
      setNotes([{ time: "", label: "", note: "" }]);

      // Redirect to profile to see the review
      const { checkAuth } = await import("@/lib/api");
      const authStatus = await checkAuth();
      if (authStatus.userHandle) {
        window.location.href = `/profile/${authStatus.userHandle}`;
      } else {
        alert("Review submitted successfully!");
      }
    } catch (error) {
      console.error("Failed to submit review:", error);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const addNote = () => {
    setNotes([...notes, { time: "", label: "", note: "" }]);
  };

  const removeNote = (index: number) => {
    if (notes.length > 1) {
      setNotes(notes.filter((_, i) => i !== index));
    }
  };

  const updateNote = (index: number, field: keyof NoteInput, value: string) => {
    const newNotes = [...notes];
    newNotes[index] = { ...newNotes[index], [field]: value };
    setNotes(newNotes);
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

          {/* Notes (optional) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Mark moments (optional)
            </label>
            {notes.map((note, index) => (
              <div key={index} className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: "var(--ln-surface)" }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={note.time}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9:]/g, '');
                      updateNote(index, 'time', value);
                    }}
                    placeholder="0:00 (mm:ss)"
                    maxLength={5}
                    className="w-24 px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: "var(--ln-bg)",
                      color: "var(--ln-ink)",
                      borderColor: "var(--ln-line)",
                    }}
                  />
                  <input
                    type="text"
                    value={note.label}
                    onChange={(e) => updateNote(index, 'label', e.target.value)}
                    placeholder="Label (e.g., 'best bit', 'intro', 'drop')"
                    maxLength={30}
                    className="flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: "var(--ln-bg)",
                      color: "var(--ln-ink)",
                      borderColor: "var(--ln-line)",
                    }}
                  />
                  {notes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeNote(index)}
                      className="px-3 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: "var(--ln-line)",
                        color: "var(--ln-ink-soft)",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={note.note || ""}
                  onChange={(e) => updateNote(index, 'note', e.target.value)}
                  placeholder="Optional note or commentary..."
                  maxLength={150}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: "var(--ln-bg)",
                    color: "var(--ln-ink)",
                    borderColor: "var(--ln-line)",
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addNote}
              className="w-full py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
              }}
            >
              + Add another moment
            </button>
            <p className="text-xs" style={{ color: "var(--ln-ink-soft)" }}>
              Mark specific moments in the track. Examples: 0:00 (intro), 1:23 (drop), 3:45 (outro)
            </p>
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
