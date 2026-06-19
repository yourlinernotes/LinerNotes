"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { TopBar, Footer } from "@/components/ln/nav";
import { FeedItem } from "@/components/ln/cards";
import { getReviews, toggleLike, toggleRepost } from "@/lib/api";
import { toReviewVM, toAlbumReviewVM, type ReviewVM } from "@/lib/view-adapter";
import type { AlbumReview } from "@/lib/types";

export default function FeedPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<ReviewVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    const loadFeed = async () => {
      try {
        if (!session) {
          setLoading(false);
          return;
        }

        const reviews = await getReviews({ feed: "friends" });
        const albumReviewsRes = await fetch("/api/album-reviews?feed=friends");
        const albumReviewsData = await albumReviewsRes.json();
        const albumReviews: AlbumReview[] = albumReviewsData.albumReviews || [];

        const vms: ReviewVM[] = [
          ...reviews.map((r) => toReviewVM(r)),
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
  }, [session, status]);

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
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 26 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.01em", color: "var(--ln-fg)" }}>Your feed</h1>
            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: "rgba(var(--ln-fg-rgb),0.42)", letterSpacing: "0.03em" }}>from listeners you&apos;d trust</span>
            <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)", alignSelf: "center" }} />
          </div>

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
              Nothing here yet. <Link href="/log" style={{ color: "var(--ln-accent)" }}>Log the first note</Link>, or add a few friends.
            </div>
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
