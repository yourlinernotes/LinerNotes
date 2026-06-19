"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { User, Review, AlbumReview } from "@/lib/types";
import { TopBar, Footer } from "@/components/ln/nav";
import { LNArt, LNStars } from "@/components/ln/atoms";
import { LNWCard } from "@/components/ln/cards";
import { toReviewVM, toAlbumReviewVM, type ReviewVM } from "@/lib/view-adapter";
import { paletteFromString, tintFromString } from "@/lib/palette";

type ProfileUser = User & { bio?: string; friendCount?: number };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <span style={{ fontFamily: "var(--ln-label)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--ln-accent)" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)" }} />
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
      <span style={{ fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 21, color: "var(--ln-fg)" }}>{n}</span>
      <span style={{ fontFamily: "var(--ln-label)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, color: "rgba(var(--ln-fg-rgb),0.42)", marginTop: 2 }}>{label}</span>
    </div>
  );
}

function AlbumTile({ review, onOpen, rank }: { review: Review; onOpen: () => void; rank?: number }) {
  const [hover, setHover] = useState(false);
  const p = paletteFromString(review.track.trackId || review.track.album || review.track.name);
  return (
    <button onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="ln-card-hover" style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", minWidth: 0, boxSizing: "border-box", cursor: "pointer", background: "none", border: "none", padding: 0, textAlign: "left", transform: hover ? "translateY(-3px)" : "none" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", boxShadow: hover ? "0 22px 44px -22px var(--ln-shadow)" : "0 12px 28px -18px var(--ln-shadow)" }}>
        <LNArt palette={p} src={review.track.artworkUrl} label="" radius={12} noTag />
        {review.rating > 0 && (
          <div style={{ position: "absolute", top: 8, right: 8, padding: "4px 7px", borderRadius: 999, background: "rgba(8,7,6,0.58)", backdropFilter: "blur(6px)", border: "1px solid rgba(var(--ln-line-rgb),0.1)" }}>
            <LNStars rating={review.rating} size={9} color="var(--ln-accent)" />
          </div>
        )}
        {rank && <span style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: "50%", background: "rgba(8,7,6,0.62)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ln-mono)", fontSize: 10, color: "var(--ln-accent)", border: "1px solid rgba(var(--ln-line-rgb),0.12)" }}>{rank}</span>}
      </div>
      <div>
        <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 15, color: "var(--ln-fg)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{review.track.name}</div>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{review.track.artist}</div>
      </div>
    </button>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const { data: session } = useSession();

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [albumReviews, setAlbumReviews] = useState<AlbumReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"notes" | "saved">("notes");
  const isOwnProfile = session?.user?.handle === handle;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userResponse = await fetch(`/api/users/${handle}`);
        if (!userResponse.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const userData = await userResponse.json();
        setUser(userData.user);

        const reviewsResponse = await fetch(`/api/reviews?userId=${userData.user.id}`);
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          setReviews(reviewsData.reviews || []);
        }

        const albumReviewsResponse = await fetch(`/api/album-reviews?userId=${userData.user.id}`);
        if (albumReviewsResponse.ok) {
          const albumReviewsData = await albumReviewsResponse.json();
          setAlbumReviews(albumReviewsData.albumReviews || []);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    if (handle) loadProfile();
  }, [handle, session]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ln-bg)" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: "var(--ln-accent)", animation: "ln-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: "var(--ln-display)", fontSize: 30, fontWeight: 600, margin: 0 }}>Profile not found</h1>
            <p style={{ fontFamily: "var(--ln-body)", color: "var(--ln-muted)", marginTop: 8 }}>We couldn&apos;t load @{handle}.</p>
            <Link href="/" style={{ display: "inline-block", marginTop: 18, padding: "12px 24px", borderRadius: 999, textDecoration: "none", background: "var(--ln-accent)", color: "#1a0a04", fontFamily: "var(--ln-body)", fontWeight: 700 }}>Go home</Link>
          </div>
        </div>
      </div>
    );
  }

  const tint = tintFromString(user.id || user.handle);
  const topReviews = [...reviews].sort((a, b) => b.rating - a.rating).slice(0, 4);
  const recent = [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
  const momentCount =
    reviews.reduce((s, r) => s + (r.notes?.length || 0), 0) +
    albumReviews.reduce((s, ar) => s + (ar.trackReviews?.reduce((t, tr) => t + (tr.notes?.length || 0), 0) || 0), 0);

  const noteVms: ReviewVM[] = [
    ...reviews.map((r) => toReviewVM({ ...r, user: r.user || user })),
    ...albumReviews.map((ar) => toAlbumReviewVM({ ...ar, user: ar.user || user })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
        {/* header band */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, height: 320, background: `linear-gradient(180deg, ${tint}1f 0%, transparent 90%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", padding: "120px 24px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 26, flexWrap: "wrap" }}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.displayName} style={{ width: 104, height: 104, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 104, height: 104, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${tint}22`, border: `1.5px solid ${tint}66`, color: tint, fontFamily: "var(--ln-display)", fontWeight: 600, fontSize: 44 }}>
                  {(user.displayName || user.handle || "?")[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 260, paddingTop: 6 }}>
                <h1 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: "clamp(30px, 3.4vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--ln-fg)" }}>{user.displayName}</h1>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 13, color: "rgba(var(--ln-fg-rgb),0.5)", marginTop: 5 }}>@{user.handle}</div>
                {user.bio && <p style={{ margin: "14px 0 0", maxWidth: 520, fontFamily: "var(--ln-body)", fontSize: 16, lineHeight: 1.55, color: "rgba(var(--ln-fg-rgb),0.78)" }}>{user.bio}</p>}
                <div style={{ display: "flex", gap: 26, marginTop: 18 }}>
                  <Stat n={reviews.length + albumReviews.length} label="notes" />
                  <Stat n={momentCount} label="moments" />
                  <Stat n={user.friendCount || 0} label="friends" />
                </div>
              </div>
              {isOwnProfile && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
                  <Link href="/profile/edit" className="ln-press" style={{ padding: "11px 26px", borderRadius: 999, textDecoration: "none", border: "1px solid rgba(var(--ln-fg-rgb),0.18)", background: "rgba(var(--ln-fg-rgb),0.04)", color: "var(--ln-fg)", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600 }}>Edit profile</Link>
                </div>
              )}
            </div>

            {topReviews.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <SectionLabel>favourites</SectionLabel>
                <div className="lnw-fav-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
                  {topReviews.map((r, i) => (
                    <AlbumTile key={r.id} review={r} rank={i + 1} onOpen={() => router.push(`/card/${r.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {recent.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <SectionLabel>recent ratings</SectionLabel>
                <div className="ln-scroll" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 6 }}>
                  {recent.map((r) => (
                    <div key={r.id} style={{ width: 150, flexShrink: 0 }}>
                      <AlbumTile review={r} onOpen={() => router.push(`/card/${r.id}`)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* notes / saved */}
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px 96px" }}>
          <div style={{ display: "flex", gap: 26, borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.1)", marginBottom: 26 }}>
            {([["notes", `notes · ${noteVms.length}`], ["saved", "saved · 0"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 12px", fontFamily: "var(--ln-label)", fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: tab === id ? "var(--ln-fg)" : "rgba(var(--ln-fg-rgb),0.4)", borderBottom: tab === id ? "2px solid var(--ln-accent)" : "2px solid transparent", marginBottom: -1 }}>{label}</button>
            ))}
          </div>

          {tab === "notes" && (
            noteVms.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 18, color: "var(--ln-muted)" }}>No notes yet.</div>
            ) : (
              <div className="lnw-note-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28, alignItems: "start" }}>
                {noteVms.map((vm) => (
                  <LNWCard key={`${vm.kind}-${vm.id}`} vm={vm} onOpen={() => router.push(vm.href)} />
                ))}
              </div>
            )
          )}

          {tab === "saved" && (
            <div style={{ textAlign: "center", padding: "50px 0", fontFamily: "var(--ln-mono)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.4)" }}>Nothing saved yet</div>
          )}
        </div>
      </main>

      <Footer />

      <style>{`
        @media (max-width: 860px) {
          .lnw-fav-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lnw-note-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
