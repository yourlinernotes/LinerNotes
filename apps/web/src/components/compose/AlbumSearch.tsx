"use client";

import { useState, useEffect } from "react";
import type { Album } from "@/lib/types";
import { cmpInput } from "./composer-ui";

interface AlbumSearchProps {
  onAlbumSelect: (album: Album) => void;
  searchAPI?: (query: string) => Promise<Album[]>;
}

export function AlbumSearch({ onAlbumSelect, searchAPI }: AlbumSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let albums: Album[];
        if (searchAPI) {
          albums = await searchAPI(query);
        } else {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=album`);
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Search failed");
          }
          const data = await res.json();
          albums = data.albums;
        }
        setResults(albums);
      } catch (err) {
        console.error("Search error:", err);
        setError(err instanceof Error ? err.message : "Failed to search albums");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, searchAPI]);

  const handleSelect = (album: Album) => {
    onAlbumSelect(album);
    setQuery("");
    setResults([]);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for an album…"
        style={cmpInput}
      />

      {loading && (
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(var(--ln-fg-rgb),0.2)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, padding: "11px 13px", borderRadius: 12, fontFamily: "var(--ln-body)", fontSize: 13, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.4)", color: "#ffb4b4" }}>{error}</div>
      )}

      {results.length > 0 && (
        <div className="ln-scroll" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, borderRadius: 14, overflow: "hidden", overflowY: "auto", overscrollBehavior: "contain", maxHeight: "min(360px, 50vh)", zIndex: 80, background: "var(--ln-bg)", border: "1px solid rgba(var(--ln-line-rgb),0.18)", boxShadow: "0 26px 56px -26px var(--ln-shadow)" }}>
          {results.map((album) => (
            <button key={album.albumId} type="button" onClick={() => handleSelect(album)} style={{ width: "100%", padding: "11px 13px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.06)", cursor: "pointer" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={album.artworkUrl} alt={album.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: "var(--ln-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.name}</div>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {album.artist}
                  {album.releaseDate && ` · ${new Date(album.releaseDate).getFullYear()}`}
                  {album.totalTracks && ` · ${album.totalTracks} tracks`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
