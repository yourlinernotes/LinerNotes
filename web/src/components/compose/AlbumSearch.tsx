"use client";

import { useState, useEffect } from "react";
import type { Album } from "@/lib/types";

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
      } catch (err: any) {
        console.error("Search error:", err);
        setError(err.message || "Failed to search albums");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [query, searchAPI]);

  const handleSelect = (album: Album) => {
    onAlbumSelect(album);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for an album..."
        className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2"
        style={{
          backgroundColor: "var(--ln-surface)",
          color: "var(--ln-ink)",
          borderColor: "var(--ln-line)",
        }}
      />

      {loading && (
        <div className="absolute right-4 top-4">
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--ln-accent)" }}
          />
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(255,0,0,0.1)", color: "#ff4444" }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div
          className="absolute z-10 w-full mt-2 rounded-lg overflow-hidden shadow-lg max-h-96 overflow-y-auto"
          style={{ backgroundColor: "var(--ln-surface)" }}
        >
          {results.map((album) => (
            <button
              key={album.albumId}
              onClick={() => handleSelect(album)}
              className="w-full p-3 flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
              style={{ borderBottom: "1px solid var(--ln-line)" }}
            >
              <img
                src={album.artworkUrl}
                alt={album.name}
                className="w-12 h-12 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" style={{ color: "var(--ln-ink)" }}>
                  {album.name}
                </div>
                <div className="text-sm truncate" style={{ color: "var(--ln-ink-soft)" }}>
                  {album.artist}
                  {album.releaseDate && ` • ${new Date(album.releaseDate).getFullYear()}`}
                  {album.totalTracks && ` • ${album.totalTracks} tracks`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
