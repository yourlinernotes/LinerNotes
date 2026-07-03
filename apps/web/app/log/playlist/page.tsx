"use client";

import { PlaylistComposer } from "@/components/compose/PlaylistComposer";
import { TopBar, Footer } from "@/components/ln/nav";

export default function LogPlaylistPage() {
  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main id="main" style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Create a playlist</h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            Curate a collection of tracks with notes on what makes each one special.
          </p>

          <PlaylistComposer />
        </section>
      </main>

      <Footer />
    </div>
  );
}
