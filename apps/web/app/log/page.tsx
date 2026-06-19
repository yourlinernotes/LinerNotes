"use client";

import { ComposeForm } from "@/components/compose";
import { searchTracks } from "@/lib/api";
import Link from "next/link";
import { TopBar, Footer } from "@/components/ln/nav";

export default function LogPage() {
  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 680, margin: "0 auto", padding: "112px 20px 90px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Log a note</h1>
            <Link href="/log/album" style={{ fontFamily: "var(--ln-body)", fontSize: 13.5, fontWeight: 600, color: "var(--ln-accent)", textDecoration: "none" }}>Review an album →</Link>
          </div>
          <p style={{ margin: "0 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            Search a track, rate it, and time-stamp the exact second it got you. A rating alone is a valid note.
          </p>

          <div style={{ padding: "24px 22px", borderRadius: 18, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
            <ComposeForm searchAPI={searchTracks} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
