"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ComposeForm } from "@/components/compose";
import { searchTracks } from "@/lib/api";
import { TopBar, Footer } from "@/components/ln/nav";
import type { Track } from "@/lib/types";

function LogPageContent() {
  const searchParams = useSearchParams();

  // Check if we have track data from Last.fm prompt
  const trackName = searchParams.get("track");
  const artistName = searchParams.get("artist");
  const albumName = searchParams.get("album");
  const artworkUrl = searchParams.get("artwork");
  const promptText = searchParams.get("prompt");
  const promptTag = searchParams.get("tag");
  const initialRating = searchParams.get("rating");

  // Create initial track object if params exist
  const initialTrack: Track | undefined = trackName && artistName ? {
    trackId: `lastfm-${trackName}-${artistName}`,
    name: trackName,
    artist: artistName,
    album: albumName || "",
    artworkUrl: artworkUrl || "",
    previewUrl: "",
  } : undefined;

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main id="main" style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Log a note</h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            {promptText || "Search a track, rate it, and time-stamp the exact second it got you. A rating alone is a valid note."}
          </p>
          {promptTag && (
            <div style={{ marginBottom: 16, padding: "6px 12px", borderRadius: 999, background: "rgba(var(--ln-accent-rgb),0.12)", border: "1px solid rgba(var(--ln-accent-rgb),0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ln-accent)", fontWeight: 700 }}>{promptTag}</span>
            </div>
          )}

          <ComposeForm
            searchAPI={searchTracks}
            initialTrack={initialTrack}
            initialRating={initialRating ? parseInt(initialRating) : undefined}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    }>
      <LogPageContent />
    </Suspense>
  );
}
