"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { User, Review, AlbumReview } from "@/lib/types";
import { TopBar, Footer } from "@/components/ln/nav";
import { LNArt, LNStars, LNIcon } from "@/components/ln/atoms";
import { LNWCard } from "@/components/ln/cards";
import { toReviewVM, toAlbumReviewVM, type ReviewVM } from "@/lib/view-adapter";
import { paletteFromString, tintFromString } from "@/lib/palette";

type ProfileUser = User & { bio?: string; friendCount?: number; favourites?: string | null };

type FavItem = {
  ref: string; // "track:<id>" | "album:<id>"
  kind: "track" | "album";
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  seed: string;
  rating: number;
  href: string;
};

function trackToFav(r: Review): FavItem {
  return { ref: `track:${r.id}`, kind: "track", id: r.id, title: r.track.name, artist: r.track.artist, artworkUrl: r.track.artworkUrl, seed: r.track.trackId || r.track.album || r.track.name, rating: r.rating || 0, href: `/card/${r.id}` };
}
function albumToFav(a: AlbumReview): FavItem {
  return { ref: `album:${a.id}`, kind: "album", id: a.id, title: a.album.name, artist: a.album.artist, artworkUrl: a.album.artworkUrl, seed: a.album.albumId || a.album.name, rating: a.overallRating || 0, href: `/album-card/${a.id}` };
}

function parseFavs(json?: string | null): string[] {
  try {
    const a = JSON.parse(json || "[]");
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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

function FavTile({ item, rank, onOpen, onRemove, selected, flat }: { item: FavItem; rank?: number; onOpen?: () => void; onRemove?: () => void; selected?: boolean; flat?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ln-card-hover"
      style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", minWidth: 0, cursor: onOpen ? "pointer" : "default", transform: !flat && hover && onOpen ? "translateY(-3px)" : "none" }}
    >
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", boxShadow: !flat && hover && onOpen ? "0 22px 44px -22px var(--ln-shadow)" : "0 12px 28px -18px var(--ln-shadow)", border: selected ? "2px solid var(--ln-accent)" : "2px solid transparent" }}>
        <LNArt palette={paletteFromString(item.seed)} src={item.artworkUrl} label="" radius={12} noTag />
        {selected && (
          <>
            <div style={{ position: "absolute", inset: 0, background: "rgba(8,7,6,0.32)" }} />
            <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "var(--ln-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#1a0a04" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </>
        )}
        {item.rating > 0 && !onRemove && !selected && (
          <div style={{ position: "absolute", top: 8, right: 8, padding: "4px 7px", borderRadius: 999, background: "rgba(8,7,6,0.58)", backdropFilter: "blur(6px)", border: "1px solid rgba(var(--ln-line-rgb),0.1)" }}>
            <LNStars rating={item.rating} size={9} color="var(--ln-accent)" />
          </div>
        )}
        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove" style={{ position: "absolute", top: 7, right: 7, width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(8,7,6,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <LNIcon name="close" size={13} color="#f1ebe0" />
          </button>
        )}
        {rank && <span style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: "50%", background: "rgba(8,7,6,0.62)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ln-mono)", fontSize: 10, color: "var(--ln-accent)", border: "1px solid rgba(var(--ln-line-rgb),0.12)" }}>{rank}</span>}
        {item.kind === "album" && <span style={{ position: "absolute", left: 8, bottom: 8, padding: "2px 7px", borderRadius: 999, background: "rgba(8,7,6,0.5)", backdropFilter: "blur(6px)", fontFamily: "var(--ln-mono)", fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#f1ebe0" }}>album</span>}
      </div>
      <div>
        <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 15, color: "var(--ln-fg)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 12.5, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.artist}</div>
      </div>
    </div>
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

  const [favRefs, setFavRefs] = useState<string[]>([]);
  const [savedFavRefs, setSavedFavRefs] = useState<string[]>([]);
  const [editingFavs, setEditingFavs] = useState(false);
  const [savingFavs, setSavingFavs] = useState(false);

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
        const favs = parseFavs(userData.user.favourites);
        setFavRefs(favs);
        setSavedFavRefs(favs);

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

  const pool = useMemo<FavItem[]>(
    () => [...reviews.map(trackToFav), ...albumReviews.map(albumToFav)],
    [reviews, albumReviews]
  );

  const toggleFav = (ref: string) =>
    setFavRefs((refs) => (refs.includes(ref) ? refs.filter((r) => r !== ref) : refs.length < 4 ? [...refs, ref] : refs));

  const saveFavs = async () => {
    setSavingFavs(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favourites: favRefs }),
      });
      if (!res.ok) throw new Error("save failed");
      setSavedFavRefs(favRefs);
      setEditingFavs(false);
    } catch {
      alert("Couldn't save favourites. Please try again.");
    } finally {
      setSavingFavs(false);
    }
  };

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
  const recentItems = [...reviews]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map(trackToFav);
  const momentCount =
    reviews.reduce((s, r) => s + (r.notes?.length || 0), 0) +
    albumReviews.reduce((s, ar) => s + (ar.trackReviews?.reduce((t, tr) => t + (tr.notes?.length || 0), 0) || 0), 0);

  const selectedFavs = favRefs.map((ref) => pool.find((p) => p.ref === ref)).filter(Boolean) as FavItem[];
  const favsToShow = selectedFavs.length > 0 ? selectedFavs : [...pool].sort((a, b) => b.rating - a.rating).slice(0, 4);

  const noteVms: ReviewVM[] = [
    ...reviews.map((r) => toReviewVM({ ...r, user: r.user || user })),
    ...albumReviews.map((ar) => toAlbumReviewVM({ ...ar, user: ar.user || user })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const ghostBtn: React.CSSProperties = { padding: "6px 14px", borderRadius: 999, cursor: "pointer", background: "rgba(var(--ln-fg-rgb),0.05)", color: "rgba(var(--ln-fg-rgb),0.75)", border: "1px solid rgba(var(--ln-fg-rgb),0.18)", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600 };
  const goldBtn: React.CSSProperties = { padding: "6px 16px", borderRadius: 999, cursor: "pointer", background: "var(--ln-accent)", color: "#1a0a04", border: "none", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 700 };

  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column", flex: 1 }}>
      <TopBar />

      <main style={{ position: "relative", zIndex: 1, flex: 1 }}>
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

            {/* favourites */}
            {(favsToShow.length > 0 || isOwnProfile) && (
              <div style={{ marginTop: 48 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <span style={{ fontFamily: "var(--ln-label)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--ln-accent)" }}>favourites</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(var(--ln-fg-rgb),0.1)" }} />
                  {isOwnProfile && (editingFavs ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setFavRefs(savedFavRefs); setEditingFavs(false); }} className="ln-press" style={ghostBtn}>Cancel</button>
                      <button onClick={saveFavs} disabled={savingFavs} className="ln-press" style={{ ...goldBtn, opacity: savingFavs ? 0.6 : 1 }}>{savingFavs ? "Saving…" : "Done"}</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingFavs(true)} className="ln-press" style={ghostBtn}>{savedFavRefs.length ? "Edit" : "Choose"}</button>
                  ))}
                </div>

                {!editingFavs && favsToShow.length > 0 && (
                  <div className="lnw-fav-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
                    {favsToShow.map((it, i) => <FavTile key={it.ref} item={it} rank={i + 1} onOpen={() => router.push(it.href)} />)}
                  </div>
                )}
                {!editingFavs && favsToShow.length === 0 && (
                  <div style={{ fontFamily: "var(--ln-preview)", fontStyle: "italic", fontSize: 17, color: "var(--ln-muted)" }}>
                    No favourites yet.{isOwnProfile && pool.length > 0 ? " Tap Choose to pick your Top 4." : ""}
                  </div>
                )}

                {editingFavs && (
                  <>
                    <div className="lnw-fav-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
                      {Array.from({ length: 4 }).map((_, i) => {
                        const ref = favRefs[i];
                        const it = ref ? pool.find((p) => p.ref === ref) : null;
                        return it ? (
                          <FavTile key={it.ref} item={it} rank={i + 1} onRemove={() => setFavRefs((refs) => refs.filter((r) => r !== ref))} />
                        ) : (
                          <div key={`slot-${i}`} style={{ aspectRatio: "1 / 1", borderRadius: 12, border: "1.5px dashed rgba(var(--ln-fg-rgb),0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--ln-mono)", fontSize: 18, color: "rgba(var(--ln-fg-rgb),0.25)" }}>{i + 1}</div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 22 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(var(--ln-fg-rgb),0.5)" }}>your ratings — tap to choose</span>
                        <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: "var(--ln-accent)" }}>{favRefs.length}/4</span>
                      </div>
                      {pool.length === 0 ? (
                        <div style={{ marginTop: 10, fontFamily: "var(--ln-body)", fontSize: 13.5, color: "rgba(var(--ln-fg-rgb),0.45)" }}>Log a note first, then pick your favourites.</div>
                      ) : (
                        <div className="ln-scroll" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 6, marginTop: 12 }}>
                          {pool.map((it) => {
                            const sel = favRefs.includes(it.ref);
                            return (
                              <div key={it.ref} style={{ width: 150, flexShrink: 0, opacity: !sel && favRefs.length >= 4 ? 0.45 : 1 }}>
                                <FavTile item={it} flat selected={sel} onOpen={() => toggleFav(it.ref)} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {favRefs.length >= 4 && <div style={{ marginTop: 8, fontFamily: "var(--ln-mono)", fontSize: 10, color: "var(--ln-accent)" }}>Top 4 full — tap a chosen one to swap.</div>}
                    </div>
                  </>
                )}
              </div>
            )}

            {recentItems.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <SectionLabel>recent ratings</SectionLabel>
                <div className="ln-scroll" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 6 }}>
                  {recentItems.map((it) => (
                    <div key={it.ref} style={{ width: 150, flexShrink: 0 }}>
                      <FavTile item={it} onOpen={() => router.push(it.href)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

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
