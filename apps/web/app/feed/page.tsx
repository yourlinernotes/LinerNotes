"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { TopBar, Footer } from "@/components/ln/nav";
import { FeedItem } from "@/components/ln/cards";
import { SuggestedToFollow } from "@/components/SuggestedToFollow";
import { toggleLike, toggleRepost } from "@/lib/api";
import { toReviewVM, toAlbumReviewVM, type ReviewVM } from "@/lib/view-adapter";
import type { AlbumReview } from "@/lib/types";

export default function FeedPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<ReviewVM[]>([]);
  const [loading, setLoading] = useState(true);
  // Home = people you follow + you (backfilled). Discover = the community.
  const [view, setView] = useState<"home" | "discover">("home");

  useEffect(() => {
    if (status === "loading") return;

    const loadFeed = async () => {
      setLoading(true);
      try {
        if (!session) {
          setLoading(false);
          return;
        }

        const [reviewsRes, albumReviewsRes] = await Promise.all([
          fetch(`/api/reviews?feed=${view}`),
          fetch(`/api/album-reviews?feed=${view}`),
        ]);
        const reviews = reviewsRes.ok ? (await reviewsRes.json()).reviews || [] : [];
        const albumReviews: AlbumReview[] = albumReviewsRes.ok ? (await albumReviewsRes.json()).albumReviews || [] : [];

        const vms: ReviewVM[] = [
          ...reviews.map((r: any) => toReviewVM(r)),
          ...albumReviews.map((a) => toAlbumReviewVM(a)),
        ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        setItems(vms);
      } catch (error) {
        console.error("Failed to load feed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, [session, status, view]);

  const onLike = (vm: ReviewVM) => {
    if (vm.kind === "track") toggleLike(vm.id).catch(() => {});
    else if (vm.kind === "album") fetch(`/api/album-reviews/${vm.id}/like`, { method: "POST" }).catch(() => {});
  };
  const onRepost = (vm: ReviewVM) => {
    if (vm.kind === "track") toggleRepost(vm.id).catch(() => {});
    else if (vm.kind === "album") fetch(`/api/album-reviews/${vm.id}/repost`, { method: "POST" }).catch(() => {});
  };

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "112px 20px 90px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em", color: "var(--ln-fg)" }}>Your feed</h1>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.42)", letterSpacing: "0.03em" }}>
              {view === "home" ? "people you follow" : "from the community"}
            </span>
            <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)", alignSelf: "center" }} />
          </div>

          {session && (
            <div style={{ display: "inline-flex", gap: 4, padding: 4, marginBottom: 26, borderRadius: 999, background: "rgba(var(--ln-fg-rgb),0.05)", border: "1px solid rgba(var(--ln-line-rgb),0.1)" }}>
              {(["home", "discover"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="ln-press"
                  style={{
                    padding: "7px 18px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--ln-body)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    background: view === v ? "var(--ln-accent)" : "transparent",
                    color: view === v ? "#1a0a04" : "rgba(var(--ln-fg-rgb),0.6)",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {!loading && !session && (
            <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: 18, background: "var(--ln-surface)", border: "1px solid rgba(var(--ln-line-rgb),0.08)" }}>
              <p style={{ margin: "0 0 18px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 20, color: "var(--ln-fg)" }}>Log in to see what your friends are logging.</p>
              <Link href="/login" className="ln-press" style={{ display: "inline-block", padding: "13px 26px", borderRadius: 999, textDecoration: "none", background: "var(--ln-accent)", color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700 }}>Log in</Link>
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
            </div>
          )}

          {!loading && session && items.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 24px", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 19, color: "var(--ln-muted)" }}>
              {view === "home" ? (
                <>Quiet here. <button onClick={() => setView("discover")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "var(--ln-accent)" }}>Explore Discover</button> to find people to follow, or <Link href="/log" style={{ color: "var(--ln-accent)" }}>log the first note</Link>.</>
              ) : (
                <>Nothing in the community yet. <Link href="/log" style={{ color: "var(--ln-accent)" }}>Log the first note</Link>.</>
              )}
            </div>
          )}

          {/* Cold-start rail: fill a sparse feed with people to follow. Always in
              Discover; in Home only when it's thin. */}
          {!loading && session && (view === "discover" || items.length < 5) && (
            <SuggestedToFollow />
          )}

          {!loading && session && items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 34, containerType: "inline-size" }}>
              {items.map((vm) => (
                <FeedItem key={`${vm.kind}-${vm.id}`} vm={vm} onLike={() => onLike(vm)} onRepost={() => onRepost(vm)} />
              ))}
              <div style={{ textAlign: "center", marginTop: 10, fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.06em", color: "rgba(var(--ln-fg-rgb),0.3)" }}>You&apos;re all caught up · breathe</div>
            </div>
          )}
        </section>
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
