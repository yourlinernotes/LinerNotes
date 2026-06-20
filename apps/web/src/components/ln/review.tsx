"use client";

// The immersive review page — the story-tap destination. A full album-colour flood,
// big cover + rating + Spotify hand-off on the left; the take, the body, every track
// & moment expanded on the right; related notes + a beta CTA below. Adapted from the
// design bundle's web-review.jsx to consume a ReviewVM.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LNArt, LNStars, LNReact, LNIcon, LNAvatar, lnFmt, lnRel, LN_REACT } from "./atoms";
import type { ReviewVM, MomentVM, TrackVM } from "@/lib/view-adapter";

const INK = "#f1ebe0";
const muted = (a: number) => `rgba(241,235,224,${a})`;

function Eq({ color, small }: { color: string; small?: boolean }) {
  const bars = small ? [0, 1, 2] : [0, 1, 2, 3];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: small ? 2 : 2.5, height: small ? 14 : 20, width: small ? 13 : 18, flexShrink: 0 }}>
      {bars.map((i) => (
        <div key={i} style={{ flex: 1, background: color, borderRadius: 1, animation: `ln-eq 0.9s ease-in-out ${i * 0.18}s infinite alternate`, height: "60%" }} />
      ))}
    </div>
  );
}

function SectionLabel({ children, gold }: { children: ReactNode; gold: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontFamily: "var(--ln-label)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: gold }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(241,235,224,0.12)" }} />
    </div>
  );
}

function MomentLine({ m, gold, compact }: { m: MomentVM; gold: string; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: compact ? "9px 11px" : "12px 13px", borderRadius: 11, background: `${gold}0c`, border: `1px solid ${gold}2e` }}>
      <span style={{ fontFamily: "var(--ln-mono)", fontSize: 12.5, color: "#1a0a04", background: gold, borderRadius: 6, padding: "3px 8px", flexShrink: 0, fontWeight: 600, letterSpacing: "-0.02em" }}>{lnFmt(m.sec)}</span>
      <span style={{ flex: 1, fontFamily: "var(--ln-body)", fontSize: compact ? 13.5 : 15, color: muted(0.88), lineHeight: 1.4, minWidth: 0 }}>{m.note || m.label}</span>
    </div>
  );
}

function TrackCard({ t, gold, np }: { t: TrackVM; gold: string; np: boolean }) {
  const mc = t.moments?.length || 0;
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${np ? gold + "55" : "rgba(241,235,224,0.1)"}`, background: np ? `${gold}0d` : "rgba(241,235,224,0.03)", padding: "15px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        {np ? <Eq color={gold} small /> : <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: muted(0.4), width: 18, textAlign: "center" }}>{String(t.n).padStart(2, "0")}</span>}
        <span style={{ flex: 1, fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 17, color: np ? gold : INK, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
        {mc > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--ln-mono)", fontSize: 10, color: gold, background: `${gold}16`, borderRadius: 999, padding: "2px 7px" }}>
            <LNIcon name="save" size={10} color={gold} />
            {mc}
          </span>
        )}
        {t.reaction && <LNReact kind={t.reaction} size={18} />}
      </div>

      {t.review && (
        <p style={{ margin: 0, fontFamily: "var(--ln-body)", fontSize: 14.5, lineHeight: 1.55, color: muted(0.84), paddingLeft: 13, borderLeft: "2px solid rgba(241,235,224,0.18)" }}>{t.review}</p>
      )}

      {mc > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {t.moments.map((m, i) => (
            <MomentLine key={i} m={{ ...m, label: m.label || t.name }} gold={gold} compact />
          ))}
        </div>
      )}

      {!t.review && mc === 0 && (
        <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: muted(0.38), letterSpacing: "0.03em" }}>
          {t.reaction ? LN_REACT[t.reaction].label : "no note"}
        </span>
      )}
    </div>
  );
}

function RelatedCard({ vm, gold, onOpen }: { vm: ReviewVM; gold: string; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const p = vm.album.palette;
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ln-card-hover"
      style={{ textAlign: "left", padding: 0, cursor: "pointer", borderRadius: 14, overflow: "hidden", border: `1px solid rgba(241,235,224,${hover ? 0.2 : 0.1})`, background: "rgba(241,235,224,0.04)", transform: hover ? "translateY(-3px)" : "none", boxShadow: hover ? "0 22px 48px -26px rgba(0,0,0,0.9)" : "none" }}
    >
      <div style={{ position: "relative" }}>
        <LNArt palette={p} src={vm.album.artworkUrl} label="" radius={0} noTag dim />
        {vm.rating > 0 && vm.album.kind !== "playlist" && (
          <div style={{ position: "absolute", top: 9, right: 9, padding: "4px 7px", borderRadius: 999, background: "rgba(8,7,6,0.6)", backdropFilter: "blur(6px)" }}>
            <LNStars rating={vm.rating} size={9} color={gold} />
          </div>
        )}
      </div>
      <div style={{ padding: "12px 13px 14px" }}>
        <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vm.album.title}</div>
        <div style={{ fontFamily: "var(--ln-body)", fontSize: 12, color: muted(0.6), marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vm.album.artist}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <LNAvatar user={vm.user} size={20} />
          <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: muted(0.55) }}>@{vm.user.handle}</span>
        </div>
      </div>
    </button>
  );
}

export function ImmersiveReview({
  vm,
  related = [],
  actions,
  isSelf = false,
}: {
  vm: ReviewVM;
  related?: ReviewVM[];
  actions?: ReactNode;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const { album } = vm;
  const p = album.palette;
  const gold = "var(--ln-accent)";
  const isAlbum = album.kind === "album" && album.tracks.length > 0;
  const npTrack = (album.tracks || []).find((t) => t.moments && t.moments.length) || null;

  // The note: the first line is the caption pull-quote (quoted + italic headline);
  // everything after it is the full review, kept in the order it was written.
  const takeLines = (vm.take || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const caption = takeLines[0] || "";
  // Body = everything after the pull-quote line. Back-compat: notes saved before
  // the pull-quote change stored the caption ONLY as the lead line and dropped it
  // from the body. If the body no longer contains the caption, surface it so the
  // full review still reads with the caption included (its exact original position
  // can't be recovered for those older notes).
  let restLines = takeLines.slice(1);
  if (takeLines.length > 1 && caption && !restLines.includes(caption)) {
    restLines = [caption, ...restLines];
  }

  const [spotify, setSpotify] = useState(false);
  const [follow, setFollow] = useState(false);
  const openSpotify = () => {
    setSpotify(true);
    window.open(`https://open.spotify.com/search/${encodeURIComponent(`${album.title} ${album.artist}`)}`, "_blank", "noopener");
    window.setTimeout(() => setSpotify(false), 1900);
  };

  const relatedTitle = isAlbum ? "more on LinerNotes" : "more on LinerNotes";

  return (
    <main style={{ position: "relative", minHeight: "100vh", overflow: "hidden", color: INK }}>
      {/* immersive flood */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", background: "#0a0807" }}>
        <div style={{ position: "absolute", inset: -120, filter: "blur(80px)", transform: "scale(1.1)", opacity: 0.92 }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 45% at 26% 14%, ${p.mid} 0%, ${p.deep} 58%, ${p.lo} 100%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(50% 42% at 82% 26%, ${p.glow}bb 0%, transparent 60%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(46% 40% at 14% 88%, ${p.accent}55 0%, transparent 58%)` }} />
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,7,6,0.42) 0%, rgba(8,7,6,0.2) 24%, rgba(8,7,6,0.7) 70%, #0a0807 100%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "112px 24px 0" }}>
        {/* breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: muted(0.55), marginBottom: 26 }}>
          <button onClick={() => router.back()} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: "pointer", color: muted(0.55), fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit" }}>
            <LNIcon name="back" size={13} color={muted(0.55)} /> back
          </button>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>a note by</span>
          <button onClick={() => router.push(`/profile/${vm.user.handle}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: gold, fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit" }}>@{vm.user.handle}</button>
        </div>

        {/* hero */}
        <div className="lnw-hero" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 48, alignItems: "start" }}>
          <div className="lnw-hero-left" style={{ position: "sticky", top: 92, display: "flex", flexDirection: "column", gap: 18, animation: "ln-rise 0.6s cubic-bezier(.2,.8,.2,1) both" }}>
            <div onClick={openSpotify} style={{ cursor: "pointer", borderRadius: 16, overflow: "hidden", boxShadow: "0 36px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)" }}>
              <LNArt palette={p} src={album.artworkUrl} label={album.title.toLowerCase()} radius={16} noTag={album.kind === "playlist"} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              {album.kind !== "playlist" && vm.rating > 0 ? (
                <LNStars rating={vm.rating} size={19} color={gold} />
              ) : (
                <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: gold }}>curated set</span>
              )}
            </div>

            <button onClick={openSpotify} className="ln-press" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "12px 16px", borderRadius: 999, border: "1px solid rgba(241,235,224,0.18)", background: "rgba(241,235,224,0.06)", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 14, fontWeight: 600, color: INK }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#1db954", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <LNIcon name="play" size={9} color="#fff" />
              </span>
              Open in Spotify
            </button>

            {npTrack && (
              <div style={{ padding: "13px 15px", borderRadius: 14, background: `${gold}12`, border: `1px solid ${gold}3a`, display: "flex", alignItems: "center", gap: 12 }}>
                <Eq color={gold} />
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: gold }}>following along</div>
                  <div style={{ fontFamily: "var(--ln-body)", fontSize: 14, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{npTrack.name}</div>
                </div>
                <span style={{ fontFamily: "var(--ln-mono)", fontSize: 9, color: muted(0.5), letterSpacing: "0.03em", textAlign: "right", flexShrink: 0 }}>via<br />last.fm</span>
              </div>
            )}

            {/* reviewer */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px 11px 11px", borderRadius: 14, background: "rgba(241,235,224,0.05)", border: "1px solid rgba(241,235,224,0.1)" }}>
              <button onClick={() => router.push(`/profile/${vm.user.handle}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <LNAvatar user={vm.user} size={36} />
              </button>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                <button onClick={() => router.push(`/profile/${vm.user.handle}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "var(--ln-body)", fontSize: 14, color: INK, fontWeight: 600, width: "fit-content" }}>{vm.user.name}</button>
                <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, color: muted(0.5) }}>@{vm.user.handle}</span>
              </div>
              {!isSelf && (
                <button onClick={() => setFollow((f) => !f)} className="ln-press" style={{ padding: "7px 15px", borderRadius: 999, border: `1px solid ${gold}`, cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600, background: follow ? "transparent" : gold, color: follow ? gold : "#1a0a04" }}>
                  {follow ? "following" : "follow"}
                </button>
              )}
            </div>

            {actions}
          </div>

          {/* right */}
          <div className="lnw-hero-right" style={{ minWidth: 0, animation: "ln-rise 0.6s cubic-bezier(.2,.8,.2,1) 0.08s both" }}>
            {(album.kind === "playlist" || isAlbum) && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 16, padding: "5px 11px", borderRadius: 999, background: "rgba(241,235,224,0.08)", border: "1px solid rgba(241,235,224,0.12)", fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: INK }}>
                {album.kind === "playlist" ? "playlist" : "album review"}
              </div>
            )}
            <h1 style={{ margin: 0, fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: "clamp(38px, 4.6vw, 62px)", lineHeight: 1.04, letterSpacing: "-0.02em", color: INK }}>{album.title}</h1>
            <div style={{ marginTop: 12, fontFamily: "var(--ln-body)", fontSize: 17, color: muted(0.74) }}>
              {album.artist}{album.year ? ` · ${album.year}` : ""} <span style={{ color: muted(0.4) }}>· logged {lnRel(vm.at)}</span>
            </div>

            {caption && (
              <p style={{ margin: "30px 0 0", fontFamily: "var(--ln-preview)", fontStyle: "italic", fontWeight: 500, fontSize: "clamp(24px, 2.6vw, 34px)", lineHeight: 1.32, color: INK, borderLeft: `3px solid ${gold}`, paddingLeft: 22 }}>
                “{caption}”
              </p>
            )}

            {(restLines.length > 0 || vm.body) && (
              <div style={{ marginTop: 26, maxWidth: 620, display: "flex", flexDirection: "column", gap: 16 }}>
                {restLines.map((ln, i) => (
                  <p key={i} style={{ margin: 0, fontFamily: "var(--ln-body)", fontStyle: "normal", fontSize: 18.5, lineHeight: 1.72, color: muted(0.86) }}>{ln}</p>
                ))}
                {vm.body && <p style={{ margin: 0, fontFamily: "var(--ln-body)", fontStyle: "normal", fontSize: 18.5, lineHeight: 1.72, color: muted(0.86) }}>{vm.body}</p>}
              </div>
            )}

            {!vm.body && !vm.take && (
              <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 30, height: 1, background: `${gold}99` }} />
                <span style={{ fontFamily: "var(--ln-body)", fontSize: 17, color: muted(0.72) }}>A quiet rating. Sometimes the stars say it.</span>
              </div>
            )}

            {!isAlbum && vm.notes && vm.notes.length > 0 && (
              <div style={{ marginTop: 34 }}>
                <SectionLabel gold={gold}>the moment{vm.notes.length > 1 ? "s" : ""}</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16, maxWidth: 620 }}>
                  {vm.notes.map((m, i) => (
                    <MomentLine key={i} m={m} gold={gold} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isAlbum && (
          <section style={{ marginTop: 72 }}>
            <SectionLabel gold={gold}>tracks &amp; moments</SectionLabel>
            <div className="lnw-track-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginTop: 20 }}>
              {album.tracks.map((tr) => (
                <TrackCard key={tr.n} t={tr} gold={gold} np={!!npTrack && tr.n === npTrack.n} />
              ))}
            </div>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "72px 24px 0" }}>
          <SectionLabel gold={gold}>{relatedTitle}</SectionLabel>
          <div className="lnw-rel-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 20 }}>
            {related.map((r) => (
              <RelatedCard key={r.id} vm={r} gold={gold} onOpen={() => router.push(r.href)} />
            ))}
          </div>
        </section>
      )}

      {/* conversion band */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "76px 24px 96px" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", position: "relative", border: `1px solid ${gold}33`, background: `linear-gradient(135deg, ${p.deep}, #0a0807)`, padding: "clamp(34px, 5vw, 58px)" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 120% at 88% 10%, ${gold}22, transparent 60%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 620 }}>
            <div style={{ fontFamily: "var(--ln-label)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: gold, marginBottom: 16 }}>made on LinerNotes</div>
            <h2 style={{ margin: 0, fontFamily: "var(--ln-display)", fontWeight: 700, fontSize: "clamp(28px, 3.4vw, 42px)", lineHeight: 1.08, letterSpacing: "-0.02em", color: INK }}>
              This is one note. Your library is full of them.
            </h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--ln-body)", fontSize: 17, lineHeight: 1.55, color: muted(0.74) }}>
              Capture the exact second a song gets you, the moment you&apos;re still in it — and keep them somewhere that remembers. The app is in beta.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 13, marginTop: 26 }}>
              <button onClick={() => router.push("/login")} className="ln-press" style={{ padding: "14px 24px", borderRadius: 999, border: "none", cursor: "pointer", background: gold, color: "#1a0a04", fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 700, boxShadow: `0 14px 32px -12px ${gold}` }}>
                Join the beta
              </button>
              <button onClick={() => router.push(`/profile/${vm.user.handle}`)} className="ln-press" style={{ padding: "14px 22px", borderRadius: 999, cursor: "pointer", border: "1px solid rgba(241,235,224,0.2)", background: "rgba(241,235,224,0.05)", color: INK, fontFamily: "var(--ln-body)", fontSize: 15, fontWeight: 600 }}>
                See {vm.user.name}&apos;s profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* spotify toast */}
      <div style={{ position: "fixed", left: "50%", bottom: spotify ? 30 : 6, transform: "translateX(-50%)", opacity: spotify ? 1 : 0, transition: "all 0.25s cubic-bezier(.2,.8,.2,1)", pointerEvents: "none", display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", borderRadius: 999, background: "rgba(8,7,6,0.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(29,185,84,0.6)", zIndex: 200, boxShadow: "0 16px 40px -12px rgba(0,0,0,0.7)" }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#1db954", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <LNIcon name="play" size={9} color="#fff" />
        </span>
        <span style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: INK }}>opening {album.title} in Spotify…</span>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .lnw-hero { grid-template-columns: 1fr !important; gap: 30px !important; }
          .lnw-hero-left { position: static !important; max-width: 340px; }
          .lnw-track-grid { grid-template-columns: 1fr !important; }
          .lnw-rel-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .lnw-rel-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

// A restyled action toolbar for owners/sharers, rendered in the hero-left column.
export function ReviewActions({
  onCopy,
  copied,
  onShare,
  onPickNote,
  onDelete,
  isOwner,
  canPickNote,
}: {
  onCopy: () => void;
  copied: boolean;
  onShare?: () => void;
  onPickNote?: () => void;
  onDelete?: () => void;
  isOwner: boolean;
  canPickNote?: boolean;
}) {
  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid rgba(241,235,224,0.18)",
    background: "rgba(241,235,224,0.06)",
    cursor: "pointer",
    fontFamily: "var(--ln-body)",
    fontSize: 13.5,
    fontWeight: 600,
    color: INK,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
      <button onClick={onCopy} className="ln-press" style={{ ...btn, background: copied ? "var(--ln-accent)" : btn.background, color: copied ? "#1a0a04" : INK, borderColor: copied ? "transparent" : "rgba(241,235,224,0.18)" }}>
        <LNIcon name="share" size={15} color={copied ? "#1a0a04" : INK} />
        {copied ? "Link copied" : "Copy link"}
      </button>
      {onShare && (
        <button onClick={onShare} className="ln-press" style={btn}>
          <LNIcon name="share" size={15} color={INK} />
          Share to story
        </button>
      )}
      {onPickNote && canPickNote && (
        <button onClick={onPickNote} className="ln-press" style={btn}>
          <LNIcon name="edit" size={15} color={INK} />
          Choose featured note
        </button>
      )}
      {isOwner && onDelete && (
        <button onClick={onDelete} className="ln-press" style={{ ...btn, background: "rgba(220,38,38,0.14)", border: "1px solid rgba(220,38,38,0.4)", color: "#ff8f8f" }}>
          Delete
        </button>
      )}
    </div>
  );
}
