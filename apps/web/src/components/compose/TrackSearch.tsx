"use client";

import { useState } from "react";
import type { Track } from "@/lib/types";
import { cmpInput } from "./composer-ui";

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
    let api = searchAPI;
    if (!api) {
      const { mockAPI } = await import("@/lib/mocks");
      api = mockAPI.searchTracks;
    }
    setLoading(true);
    try {
      const tracks = await api(value);
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
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search for a track…"
        style={cmpInput}
      />

      {loading && (
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(var(--ln-fg-rgb),0.2)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
        </div>
      )}

      {showResults && (results.length > 0 || !loading) && (
        <div className="ln-scroll" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, borderRadius: 14, overflow: "hidden", overflowY: "auto", overscrollBehavior: "contain", maxHeight: "min(360px, 50vh)", zIndex: 80, background: "var(--ln-bg)", border: "1px solid rgba(var(--ln-line-rgb),0.18)", boxShadow: "0 26px 56px -26px var(--ln-shadow)" }}>
          {results.length > 0 ? (
            results.map((track) => (
              <button key={track.trackId} type="button" onClick={() => selectTrack(track)} style={{ width: "100%", padding: "11px 13px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.06)", cursor: "pointer" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.artworkUrl} alt={track.album} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</div>
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.artist} · {track.album}</div>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: "16px", textAlign: "center", fontFamily: "var(--ln-body)", fontSize: 13.5, color: "var(--ln-muted)" }}>No tracks found</div>
          )}
        </div>
      )}
    </div>
  );
}
