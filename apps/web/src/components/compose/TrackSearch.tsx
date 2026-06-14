"use client";

import { useState } from "react";
import type { Track } from "@/lib/types";

interface TrackSearchProps {
  onTrackSelect: (track: Track) => void;
  searchAPI?: (query: string) => Promise<Track[]>;
}

export function TrackSearch({ onTrackSelect, searchAPI }: TrackSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (value: string) => {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (!searchAPI) {
      // Fallback to mock data if no API provided
      const { mockAPI } = await import("@/lib/mocks");
      searchAPI = mockAPI.searchTracks;
    }

    setLoading(true);
    try {
      const tracks = await searchAPI(value);
      setResults(tracks);
      setShowResults(true);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectTrack = (track: Track) => {
    onTrackSelect(track);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search for a track..."
        className="w-full px-4 py-3 rounded-lg text-lg focus:outline-none focus:ring-2"
        style={{
          backgroundColor: "var(--ln-surface)",
          color: "var(--ln-ink)",
          borderColor: "var(--ln-line)",
        }}
      />

      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--ln-accent)" }}
          />
        </div>
      )}

      {showResults && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg overflow-hidden z-10 max-h-96 overflow-y-auto"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          {results.map((track) => (
            <button
              key={track.trackId}
              onClick={() => selectTrack(track)}
              className="w-full p-3 flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
              style={{
                borderBottom: `1px solid var(--ln-line)`,
              }}
            >
              <img
                src={track.artworkUrl}
                alt={track.album}
                className="w-12 h-12 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="font-medium truncate"
                  style={{ color: "var(--ln-ink)" }}
                >
                  {track.name}
                </div>
                <div
                  className="text-sm truncate"
                  style={{ color: "var(--ln-ink-soft)" }}
                >
                  {track.artist} • {track.album}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && !loading && (
        <div
          className="absolute top-full left-0 right-0 mt-2 p-4 rounded-lg text-center"
          style={{
            backgroundColor: "var(--ln-surface)",
            color: "var(--ln-ink-soft)",
          }}
        >
          No tracks found
        </div>
      )}
    </div>
  );
}
