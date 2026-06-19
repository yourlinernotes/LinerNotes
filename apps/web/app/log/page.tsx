"use client";

import { ComposeForm } from "@/components/compose";
import { searchTracks } from "@/lib/api";
import { TopBar, Footer } from "@/components/ln/nav";

export default function LogPage() {
  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Log a note</h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            Search a track, rate it, and time-stamp the exact second it got you. A rating alone is a valid note.
          </p>

          <ComposeForm searchAPI={searchTracks} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
