"use client";

import { useState } from "react";
import type { Album, Track, Reaction, AlbumReview } from "@/lib/types";
import { AlbumSearch } from "./AlbumSearch";
import { RatingSelector } from "./RatingSelector";

interface AlbumComposeFormProps {
  onSubmit?: (albumReview: Partial<AlbumReview>) => Promise<void>;
  onSuccess?: (albumReview: AlbumReview) => void;
  searchAPI?: (query: string) => Promise<Album[]>;
}

interface TrackReaction {
  track: Track;
  trackNumber: number;
  reaction: Reaction | null;
  rating: number;
  take?: string;
  notes: { seconds: number; label: string; note?: string }[];
  showNoteForm: boolean;
}

export function AlbumComposeForm({ onSubmit, onSuccess, searchAPI }: AlbumComposeFormProps) {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumWithTracks, setAlbumWithTracks] = useState<Album | null>(null);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [albumTake, setAlbumTake] = useState("");
  const [trackReactions, setTrackReactions] = useState<TrackReaction[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const handleAlbumSelect = async (album: Album) => {
    setSelectedAlbum(album);
    setLoadingTracks(true);

    try {
      // Fetch full album details with tracklist
      const res = await fetch(`/api/albums/${album.albumId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch album details");
      }

      const data = await res.json();
      const fullAlbum: Album = data.album;
      setAlbumWithTracks(fullAlbum);

      // Initialize track reactions
      if (fullAlbum.tracks) {
        setTrackReactions(
          fullAlbum.tracks.map((track, index) => ({
            track,
            trackNumber: index + 1,
            reaction: null,
            rating: 3.0,
            take: "",
            notes: [],
            showNoteForm: false,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch album tracks:", error);
      alert("Failed to load album tracks");
    } finally {
      setLoadingTracks(false);
    }
  };

  const setReaction = (index: number, reaction: Reaction | null) => {
    const newReactions = [...trackReactions];
    newReactions[index].reaction = reaction;
    setTrackReactions(newReactions);
  };

  const setTrackRating = (index: number, rating: number) => {
    const newReactions = [...trackReactions];
    newReactions[index].rating = rating;
    setTrackReactions(newReactions);
  };

  const setTrackTake = (index: number, take: string) => {
    const newReactions = [...trackReactions];
    newReactions[index].take = take;
    setTrackReactions(newReactions);
  };

  const toggleNoteForm = (index: number) => {
    const newReactions = [...trackReactions];
    newReactions[index].showNoteForm = !newReactions[index].showNoteForm;
    setTrackReactions(newReactions);
  };

  const addNote = (index: number) => {
    const newReactions = [...trackReactions];
    newReactions[index].notes.push({ seconds: 0, label: "", note: "" });
    setTrackReactions(newReactions);
  };

  const updateNote = (trackIndex: number, noteIndex: number, field: 'seconds' | 'label' | 'note', value: string | number) => {
    const newReactions = [...trackReactions];
    (newReactions[trackIndex].notes[noteIndex] as any)[field] = value;
    setTrackReactions(newReactions);
  };

  const removeNote = (trackIndex: number, noteIndex: number) => {
    const newReactions = [...trackReactions];
    newReactions[trackIndex].notes.splice(noteIndex, 1);
    setTrackReactions(newReactions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAlbum || !albumWithTracks) {
      alert("Please select an album first");
      return;
    }

    setSubmitting(true);

    try {
      // Only include tracks with reactions or notes
      const reviewedTracks = trackReactions.filter(
        tr => tr.reaction !== null || tr.notes.length > 0 || tr.take
      );

      const albumReviewData = {
        albumId: selectedAlbum.albumId,
        albumName: selectedAlbum.name,
        albumArtist: selectedAlbum.artist,
        artworkUrl: selectedAlbum.artworkUrl,
        releaseDate: selectedAlbum.releaseDate,
        totalTracks: selectedAlbum.totalTracks,
        overallRating: overallRating || undefined,
        take: albumTake.trim() || undefined,
        trackReviews: reviewedTracks.map(tr => ({
          trackId: tr.track.trackId,
          trackName: tr.track.name,
          trackArtist: tr.track.artist,
          artworkUrl: tr.track.artworkUrl,
          previewUrl: tr.track.previewUrl,
          rating: tr.rating,
          take: tr.take || undefined,
          reaction: tr.reaction || undefined,
          trackNumber: tr.trackNumber,
          notes: tr.notes.filter(n => n.label).map(n => ({
            seconds: n.seconds,
            label: n.label,
            note: n.note || undefined,
          })),
        })),
      };

      if (onSubmit) {
        await onSubmit(albumReviewData as any);
      } else {
        const res = await fetch("/api/album-reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(albumReviewData),
        });

        if (!res.ok) {
          throw new Error("Failed to create album review");
        }

        const data = await res.json();

        // Redirect to album card page to view the review
        window.location.href = `/album-card/${data.albumReview.id}`;
        return;
      }

      // Reset form
      setSelectedAlbum(null);
      setAlbumWithTracks(null);
      setOverallRating(null);
      setAlbumTake("");
      setTrackReactions([]);
    } catch (error) {
      console.error("Failed to submit album review:", error);
      alert("Failed to submit album review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return 0;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Album Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
          Search for an album
        </label>
        <AlbumSearch onAlbumSelect={handleAlbumSelect} searchAPI={searchAPI} />
      </div>

      {/* Selected Album Preview */}
      {selectedAlbum && (
        <div
          className="p-4 rounded-lg flex items-center gap-4"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          <img
            src={selectedAlbum.artworkUrl}
            alt={selectedAlbum.name}
            className="w-20 h-20 rounded object-cover"
          />
          <div className="flex-1">
            <div className="font-bold text-lg" style={{ color: "var(--ln-ink)" }}>
              {selectedAlbum.name}
            </div>
            <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
              {selectedAlbum.artist}
              {selectedAlbum.releaseDate && ` • ${new Date(selectedAlbum.releaseDate).getFullYear()}`}
              {selectedAlbum.totalTracks && ` • ${selectedAlbum.totalTracks} tracks`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedAlbum(null);
              setAlbumWithTracks(null);
              setTrackReactions([]);
            }}
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

      {loadingTracks && (
        <div className="flex items-center justify-center p-8">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--ln-accent)" }}
          />
        </div>
      )}

      {/* Album Review Form */}
      {albumWithTracks && !loadingTracks && (
        <>
          {/* Overall Rating (Optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Overall album rating (optional - auto-calculated from tracks if not set)
            </label>
            <div className="flex items-center gap-4">
              <RatingSelector
                rating={overallRating || 0}
                onChange={setOverallRating}
              />
              {overallRating !== null && (
                <button
                  type="button"
                  onClick={() => setOverallRating(null)}
                  className="text-sm opacity-75 hover:opacity-100"
                  style={{ color: "var(--ln-ink-soft)" }}
                >
                  Clear (use auto-calculate)
                </button>
              )}
            </div>
          </div>

          {/* Album Take (Optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Overall thoughts (optional)
            </label>
            <textarea
              value={albumTake}
              onChange={(e) => setAlbumTake(e.target.value)}
              placeholder="What did you think of the album as a whole?"
              maxLength={500}
              rows={3}
              className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--ln-surface)",
                color: "var(--ln-ink)",
                borderColor: "var(--ln-line)",
              }}
            />
            <div className="text-xs text-right" style={{ color: "var(--ln-ink-soft)" }}>
              {albumTake.length}/500
            </div>
          </div>

          {/* The Strip - Per-Track Reactions */}
          <div className="space-y-3">
            <label className="block text-sm font-medium" style={{ color: "var(--ln-ink)" }}>
              Track-by-track (optional - react to the ones that stuck)
            </label>
            <p className="text-xs" style={{ color: "var(--ln-ink-soft)" }}>
              Tap a reaction to mark standout tracks. Add notes via the bookmark icon.
            </p>

            <div className="space-y-2">
              {trackReactions.map((tr, index) => (
                <div
                  key={tr.track.trackId}
                  className="p-3 rounded-lg space-y-3"
                  style={{ backgroundColor: "var(--ln-surface)" }}
                >
                  {/* Track row with reactions */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm opacity-50 w-6">{tr.trackNumber}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm" style={{ color: "var(--ln-ink)" }}>
                        {tr.track.name}
                      </div>
                    </div>

                    {/* Reactions */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReaction(index, tr.reaction === "flame" ? null : "flame")}
                        className="p-2 rounded hover:bg-opacity-80 transition-all"
                        style={{
                          backgroundColor: tr.reaction === "flame" ? "rgba(255,100,0,0.2)" : "transparent",
                        }}
                      >
                        🔥
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(index, tr.reaction === "love" ? null : "love")}
                        className="p-2 rounded hover:bg-opacity-80 transition-all"
                        style={{
                          backgroundColor: tr.reaction === "love" ? "rgba(255,0,100,0.2)" : "transparent",
                        }}
                      >
                        ❤️
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaction(index, tr.reaction === "skip" ? null : "skip")}
                        className="p-2 rounded hover:bg-opacity-80 transition-all"
                        style={{
                          backgroundColor: tr.reaction === "skip" ? "rgba(100,100,100,0.2)" : "transparent",
                        }}
                      >
                        ⏭️
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleNoteForm(index)}
                        className="p-2 rounded hover:bg-opacity-80 transition-all"
                        style={{
                          backgroundColor: tr.showNoteForm || tr.notes.length > 0 ? "rgba(100,100,255,0.2)" : "transparent",
                        }}
                      >
                        🔖
                      </button>
                    </div>
                  </div>

                  {/* Expanded note form */}
                  {tr.showNoteForm && (
                    <div className="space-y-2 pl-9">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="5"
                          value={tr.rating}
                          onChange={(e) => setTrackRating(index, parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 rounded text-sm"
                          style={{
                            backgroundColor: "var(--ln-bg)",
                            color: "var(--ln-ink)",
                          }}
                        />
                        <span className="text-xs" style={{ color: "var(--ln-ink-soft)" }}>stars</span>
                      </div>

                      <textarea
                        value={tr.take}
                        onChange={(e) => setTrackTake(index, e.target.value)}
                        placeholder="Your thoughts on this track (as long or short as you want)..."
                        rows={3}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{
                          backgroundColor: "var(--ln-bg)",
                          color: "var(--ln-ink)",
                        }}
                      />

                      {tr.notes.map((note, noteIdx) => (
                        <div key={noteIdx} className="space-y-1">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={note.seconds > 0 ? formatTime(note.seconds) : ""}
                              onChange={(e) => updateNote(index, noteIdx, 'seconds', parseTime(e.target.value))}
                              placeholder="0:00"
                              maxLength={5}
                              className="w-20 px-2 py-1 rounded text-sm"
                              style={{
                                backgroundColor: "var(--ln-bg)",
                                color: "var(--ln-ink)",
                              }}
                            />
                            <input
                              type="text"
                              value={note.label}
                              onChange={(e) => updateNote(index, noteIdx, 'label', e.target.value)}
                              placeholder="Label (e.g., 'drop', 'bridge')"
                              maxLength={30}
                              className="flex-1 px-2 py-1 rounded text-sm"
                              style={{
                                backgroundColor: "var(--ln-bg)",
                                color: "var(--ln-ink)",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removeNote(index, noteIdx)}
                              className="px-2 py-1 rounded text-sm"
                              style={{
                                backgroundColor: "var(--ln-line)",
                                color: "var(--ln-ink-soft)",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={note.note || ""}
                            onChange={(e) => updateNote(index, noteIdx, 'note', e.target.value)}
                            placeholder="Optional note..."
                            maxLength={150}
                            className="w-full px-2 py-1 rounded text-sm"
                            style={{
                              backgroundColor: "var(--ln-bg)",
                              color: "var(--ln-ink)",
                            }}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addNote(index)}
                        className="text-sm px-3 py-1 rounded"
                        style={{
                          backgroundColor: "var(--ln-bg)",
                          color: "var(--ln-ink)",
                        }}
                      >
                        + Add moment
                      </button>
                    </div>
                  )}
                </div>
              ))}
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
            {submitting ? "Submitting..." : "Submit Album Review"}
          </button>
        </>
      )}
    </form>
  );
}
