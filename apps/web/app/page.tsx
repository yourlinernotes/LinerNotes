"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { TopBar, Footer } from "@/components/ln/nav";
import { FeedItem } from "@/components/ln/cards";
import { getReviews, toggleLike, toggleRepost } from "@/lib/api";
import { toReviewVM, toAlbumReviewVM, type ReviewVM } from "@/lib/view-adapter";
import type { AlbumReview } from "@/lib/types";

const PROMPTS = [
  { tag: "you played this 4× this week", prompt: "What keeps pulling you back to it?", meta: "on repeat" },
  { tag: "a record you finished today", prompt: "Where did it lose you — or where did it land?", meta: "full listen" },
  { tag: "the song stuck in your head", prompt: "Mark the exact second it gets you.", meta: "one moment" },
];

export default function Home() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ReviewVM[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [reviews, albumRes] = await Promise.all([
          getReviews().catch(() => []),
          fetch("/api/album-reviews").then((r) => (r.ok ? r.json() : { albumReviews: [] })).catch(() => ({ albumReviews: [] })),
        ]);
        const albumReviews: AlbumReview[] = albumRes.albumReviews || [];
        const vms = [
          ...reviews.map((r) => toReviewVM(r)),
          ...albumReviews.map((a) => toAlbumReviewVM(a)),
        ]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          .slice(0, 6);
        if (!cancelled) setItems(vms);
      } catch {
        /* hero stands on its own if nothing loads */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1 }}>
        {/* Hero — the pitch */}
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "118px 24px 26px" }}>
          <div style={{ maxWidth: 760, animation: "ln-rise 0.6s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--ln-label)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "var(--ln-accent)", marginBottom: 18 }}>
              <span style={{ width: 22, height: 1, background: "var(--ln-accent)" }} />
              A listening journal · now in beta
            </div>
            <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: "clamp(40px, 5.4vw, 66px)", lineHeight: 1.02, letterSpacing: "-0.025em", color: "var(--ln-fg)" }}>
              The moment a song hits you, kept while you&apos;re still in it.
            </h1>
            <p style={{ margin: "20px 0 0", maxWidth: 560, fontFamily: "var(--ln-body)", fontSize: 18, lineHeight: 1.55, color: "var(--ln-muted)" }}>
              Rate it, time-stamp the exact second it got you, and pass it to the friends you&apos;d actually tell. This is what people are logging.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 28 }}>
              {session ? (
                <Link href="/feed" className="ln-press" style={{ padding: "14px 24px", borderRadius: 999, textDecoration: "none", background: "var(--ln-accent)", color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700, boxShadow: "0 14px 32px -12px var(--ln-accent)" }}>
                  Go to your feed
                </Link>
              ) : (
                <Link href="/login" className="ln-press" style={{ padding: "14px 24px", borderRadius: 999, textDecoration: "none", background: "var(--ln-accent)", color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700, boxShadow: "0 14px 32px -12px var(--ln-accent)" }}>
                  Join the beta
                </Link>
              )}
              <Link href="/log" className="ln-press" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 22px", borderRadius: 999, textDecoration: "none", border: "1px solid rgba(var(--ln-fg-rgb),0.2)", background: "rgba(var(--ln-fg-rgb),0.04)", color: "var(--ln-fg)", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 600 }}>
                Log a note
              </Link>
            </div>
          </div>
        </section>

        {/* Prompt rail */}
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 24px 6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: "var(--ln-label)", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--ln-accent)" }}>worth a note</span>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.42)", letterSpacing: "0.03em" }}>what the app would ask you to write</span>
          </div>
          <div className="ln-scroll" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
            {PROMPTS.map((p) => (
              <Link key={p.tag} href="/log" className="ln-card-hover" style={{ width: 268, flexShrink: 0, borderRadius: 16, textDecoration: "none", background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)", boxShadow: "0 12px 28px -20px var(--ln-shadow)", padding: "15px 15px 16px", display: "flex", flexDirection: "column", gap: 13, boxSizing: "border-box" }}>
                <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.04em", color: "var(--ln-accent)", lineHeight: 1.3 }}>{p.tag}</span>
                <p style={{ margin: 0, fontFamily: "var(--ln-body)", fontWeight: 500, fontSize: 15.5, lineHeight: 1.34, color: "var(--ln-fg)", flex: 1 }}>{p.prompt}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 11, borderTop: "1px solid rgba(var(--ln-fg-rgb),0.08)" }}>
                  <span style={{ fontFamily: "var(--ln-body)", fontSize: 12, color: "var(--ln-muted)" }}>{p.meta}</span>
                  <span style={{ fontFamily: "var(--ln-body)", fontSize: 12, fontWeight: 600, color: "var(--ln-accent)" }}>Note →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Feed preview */}
        {items.length > 0 && (
          <section style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 90px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
              <span style={{ fontFamily: "var(--ln-label)", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--ln-accent)" }}>the feed</span>
              <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.42)", letterSpacing: "0.03em" }}>from listeners you&apos;d trust</span>
              <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)", alignSelf: "center" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 34, containerType: "inline-size" }}>
              {items.map((vm) => (
                <FeedItem
                  key={vm.id}
                  vm={vm}
                  onLike={() => vm.kind === "track" && toggleLike(vm.id).catch(() => {})}
                  onRepost={() => vm.kind === "track" && toggleRepost(vm.id).catch(() => {})}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />

      <style>{`
        @container (max-width: 680px) {
          .lnw-fcard { flex-direction: column !important; }
          .lnw-fcard-art { width: 100% !important; }
          .lnw-fcard-main { justify-content: flex-start !important; }
          .lnw-fcard-tracks { width: 100% !important; border-left: none !important; border-top: 1px solid rgba(var(--ln-fg-rgb),0.08) !important; }
        }
      `}</style>
    </div>
  );
}
