"use client";

import { AlbumComposeForm } from "@/components/compose/AlbumComposeForm";
import { TopBar, Footer } from "@/components/ln/nav";

export default function LogAlbumPage() {
  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "112px 20px 90px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em" }}>Review an album</h1>
          <p style={{ margin: "8px 0 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
            You don&apos;t need to rate every track. React to the ones that stuck, mark the moments, and let the rest fade.
          </p>

          <AlbumComposeForm />
        </section>
      </main>

      <Footer />
    </div>
  );
}
