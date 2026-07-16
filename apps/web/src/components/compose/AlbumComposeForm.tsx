"use client";

import { useMemo, useState } from "react";
import type { Album, Track, Reaction, AlbumReview } from "@/lib/types";
import { AlbumSearch } from "./AlbumSearch";
import { StarsInput, MomentsEditor, CaptionPicker, Chip, DepthMeter, ModeTabs, PreviewShell, cmpInput, type Depth } from "./composer-ui";
import { MomentCaptureBar } from "./MomentCaptureBar";
import { LNArt, LNReact, LN_REACT, LNIcon } from "@/components/ln/atoms";
import { LNWCard } from "@/components/ln/cards";
import { paletteFromString } from "@/lib/palette";
import type { ReviewVM, TrackVM } from "@/lib/view-adapter";
import { momentLabelAt, type LyricLine } from "@/lib/lrc";

interface AlbumComposeFormProps {
  onSubmit?: (albumReview: Partial<AlbumReview>) => Promise<void>;
  onSuccess?: (albumReview: AlbumReview) => void;
  searchAPI?: (query: string) => Promise<Album[]>;
}

interface TrackNote { seconds: number | null; note: string }
interface TrackReaction {
  track: Track;
  trackNumber: number;
  reaction: Reaction | null;
  rating: number;
  take?: string;
  notes: TrackNote[];
  showNoteForm: boolean;
}

export function AlbumComposeForm({ onSubmit, onSuccess, searchAPI }: AlbumComposeFormProps) {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [albumWithTracks, setAlbumWithTracks] = useState<Album | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [showTake, setShowTake] = useState(false);
  const [albumTake, setAlbumTake] = useState("");
  const [captionIdx, setCaptionIdx] = useState(0);
  const [showTracks, setShowTracks] = useState(true);
  const [trackReactions, setTrackReactions] = useState<TrackReaction[]>([]);
  const [lyricsByTrack, setLyricsByTrack] = useState<Record<string, LyricLine[]>>({});
  const [openTrack, setOpenTrack] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const handleAlbumSelect = async (album: Album) => {
    setSelectedAlbum(album);
    setLoadingTracks(true);
    try {
      const res = await fetch(`/api/albums/${album.albumId}`);
      if (!res.ok) throw new Error("Failed to fetch album details");
      const data = await res.json();
      const fullAlbum: Album = data.album;
      setAlbumWithTracks(fullAlbum);
      if (fullAlbum.tracks) {
        setTrackReactions(
          fullAlbum.tracks.map((track, index) => ({
            track,
            trackNumber: index + 1,
            reaction: null,
            rating: 3.0,
            take: "",
            notes: [],
            showNoteForm: false,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch album tracks:", error);
      alert("Failed to load album tracks");
    } finally {
      setLoadingTracks(false);
    }
  };

  const upd = (i: number, patch: Partial<TrackReaction>) =>
    setTrackReactions((arr) => arr.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const isIncluded = (tr: TrackReaction) => !!(tr.reaction || tr.notes.some((n) => n.seconds != null) || tr.take);
  const includedCount = trackReactions.filter(isIncluded).length;

  const takeLines = albumTake.split("\n").map((s) => s.trim()).filter(Boolean);
  const capIdx = takeLines.length ? Math.min(captionIdx, takeLines.length - 1) : 0;
  // Caption is prepended as a pull-quote; the full review follows in written order.
  const take = takeLines.length > 1 ? [takeLines[capIdx], ...takeLines].join("\n") : takeLines[0] || "";
  const multiline = takeLines.length > 1;
  const depth: Depth = multiline ? "full" : take ? "caption" : overallRating > 0 || includedCount > 0 ? "floor" : null;
  const canPost = overallRating > 0 || includedCount > 0;

  const reset = () => {
    setSelectedAlbum(null);
    setAlbumWithTracks(null);
    setOverallRating(0);
    setAlbumTake("");
    setTrackReactions([]);
    setLyricsByTrack({});
    setOpenTrack(null);
    setCaptionIdx(0);
  };

  const draft: ReviewVM | null = useMemo(() => {
    if (!selectedAlbum) return null;
    const tracks: TrackVM[] = trackReactions.filter(isIncluded).map((tr) => ({
      n: tr.trackNumber,
      name: tr.track.name,
      reaction: tr.reaction,
      moments: tr.notes
        .filter((n): n is { seconds: number; note: string } => n.seconds != null)
        .map((n) => ({ sec: n.seconds, label: momentLabelAt(lyricsByTrack[tr.track.trackId] || [], n.seconds), note: n.note || "" })),
      review: tr.take || undefined,
    }));
    return {
      id: "draft",
      href: "#",
      kind: "album",
      album: {
        title: selectedAlbum.name,
        artist: selectedAlbum.artist,
        year: selectedAlbum.releaseDate ? String(new Date(selectedAlbum.releaseDate).getFullYear()) : undefined,
        artworkUrl: selectedAlbum.artworkUrl || null,
        palette: paletteFromString(selectedAlbum.albumId || selectedAlbum.name),
        kind: "album",
        tracks,
      },
      user: { id: "", name: "", handle: "", tint: "#bd9183" },
      rating: overallRating,
      take: take || undefined,
      notes: [],
      via: null,
      likeCount: 0,
      repostCount: 0,
      at: "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum, trackReactions, overallRating, take]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlbum || !albumWithTracks) {
      alert("Please select an album first");
      return;
    }
    setSubmitting(true);
    try {
      const reviewedTracks = trackReactions.filter(isIncluded);
      const albumReviewData = {
        albumId: String(selectedAlbum.albumId),
        albumName: selectedAlbum.name,
        albumArtist: selectedAlbum.artist,
        artworkUrl: selectedAlbum.artworkUrl,
        releaseDate: selectedAlbum.releaseDate,
        totalTracks: selectedAlbum.totalTracks,
        overallRating: overallRating || undefined,
        take: take || undefined,
        trackReviews: reviewedTracks.map((tr) => ({
          trackId: String(tr.track.trackId),
          trackName: tr.track.name,
          trackArtist: tr.track.artist,
          artworkUrl: tr.track.artworkUrl,
          previewUrl: tr.track.previewUrl,
          rating: tr.rating,
          take: tr.take || undefined,
          reaction: tr.reaction || undefined,
          trackNumber: tr.trackNumber,
          notes: tr.notes
            .filter((n): n is { seconds: number; note: string } => n.seconds != null)
            .map((n) => ({ seconds: n.seconds, label: momentLabelAt(lyricsByTrack[tr.track.trackId] || [], n.seconds), note: n.note || undefined })),
        })),
      };

      if (onSubmit) {
        await onSubmit(albumReviewData as unknown as Partial<AlbumReview>);
      } else {
        const res = await fetch("/api/album-reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(albumReviewData),
        });
        if (!res.ok) throw new Error("Failed to create album review");
        const data = await res.json();
        window.location.href = `/album-card/${data.albumReview.id}`;
        return;
      }
      reset();
    } catch (error) {
      console.error("Failed to submit album review:", error);
      const msg = error instanceof Error ? error.message : "Failed to submit";
      alert(/unauthor/i.test(msg) ? "Please log in to post a review." : `Couldn't post: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const gold = "var(--ln-accent)";

  if (!selectedAlbum) {
    return (
      <div>
        <ModeTabs active="album" />
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: "var(--ln-mono)", fontSize: 9.5, letterSpacing: "0.06em", color: gold, textTransform: "uppercase", marginBottom: 8 }}>which record did you sit with?</div>
          <AlbumSearch onAlbumSelect={handleAlbumSelect} searchAPI={searchAPI} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ModeTabs active="album" />

      <form onSubmit={handleSubmit} className="lnw-cmp" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>
        {/* EDITOR */}
        <div style={{ minWidth: 0 }}>
          {/* proposed album */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 14, background: "rgba(var(--ln-fg-rgb),0.04)", border: "1px solid rgba(var(--ln-fg-rgb),0.09)" }}>
            <div style={{ width: 60, height: 60, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
              <LNArt palette={paletteFromString(selectedAlbum.albumId || selectedAlbum.name)} src={selectedAlbum.artworkUrl} label="" radius={9} noTag />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ln-album)", fontWeight: 600, fontSize: 18, color: "var(--ln-fg)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedAlbum.name}</div>
              <div style={{ fontFamily: "var(--ln-body)", fontSize: 13, color: "var(--ln-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedAlbum.artist}
                {selectedAlbum.releaseDate && ` · ${new Date(selectedAlbum.releaseDate).getFullYear()}`}
              </div>
            </div>
            <button type="button" onClick={reset} className="ln-press" style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, cursor: "pointer", background: "rgba(var(--ln-fg-rgb),0.06)", color: "rgba(var(--ln-fg-rgb),0.7)", border: "1px solid rgba(var(--ln-fg-rgb),0.16)", fontFamily: "var(--ln-body)", fontSize: 12.5, fontWeight: 600 }}>Change</button>
          </div>

          {loadingTracks ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", border: "3px solid rgba(var(--ln-fg-rgb),0.15)", borderTopColor: gold, animation: "ln-spin 0.8s linear infinite" }} />
            </div>
          ) : (
            <>
              {/* overall rating */}
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <div style={{ fontFamily: "var(--ln-mono)", fontSize: 10.5, letterSpacing: "0.1em", color: "rgba(var(--ln-fg-rgb),0.5)", textTransform: "uppercase" }}>overall rating</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
                  <StarsInput rating={overallRating} onChange={setOverallRating} />
                  <span style={{ fontFamily: "var(--ln-mono)", fontSize: 23, color: overallRating ? gold : "rgba(var(--ln-fg-rgb),0.3)", minWidth: 38, textAlign: "left" }}>{overallRating ? overallRating.toFixed(1) : "·"}</span>
                </div>
                {overallRating > 0 && (
                  <button type="button" onClick={() => setOverallRating(0)} style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--ln-body)", fontSize: 12, color: "rgba(var(--ln-fg-rgb),0.5)" }}>Clear · auto-calculate from tracks</button>
                )}
              </div>

              <div style={{ marginTop: 22 }}>
                <DepthMeter depth={depth} badge={includedCount > 0 ? `album · ${includedCount}` : undefined} />
              </div>

              {/* chips */}
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Chip label="Write a note" on={showTake} onToggle={() => setShowTake((v) => !v)} />
                <Chip label={`Review the tracks${includedCount ? ` · ${includedCount}` : ""}`} on={showTracks} onToggle={() => setShowTracks((v) => !v)} />
              </div>

              {showTake && (
                <div style={{ marginTop: 13 }}>
                  <textarea value={albumTake} onChange={(e) => setAlbumTake(e.target.value)} rows={3} placeholder="What did you think of the album as a whole? Each line can be your caption…" style={cmpInput} maxLength={1000} />
                  <CaptionPicker lines={takeLines} selected={capIdx} onSelect={setCaptionIdx} />
                </div>
              )}

              {/* track strip */}
              {showTracks && (
                <div style={{ marginTop: 13, borderRadius: 14, border: "1px solid rgba(var(--ln-fg-rgb),0.1)" }}>
                  <div style={{ padding: "9px 14px", fontFamily: "var(--ln-mono)", fontSize: 10, letterSpacing: "0.06em", color: "rgba(var(--ln-fg-rgb),0.5)", textTransform: "uppercase", borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.08)" }}>tap a track to react · bookmark a note</div>
                  {trackReactions.map((tr, i) => {
                    const open = openTrack === i;
                    const mc = tr.notes.filter((n) => n.seconds != null).length;
                    const included = isIncluded(tr);
                    return (
                      <div key={tr.track.trackId} style={{ borderBottom: "1px solid rgba(var(--ln-fg-rgb),0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div onClick={() => setOpenTrack((o) => (o === i ? null : i))} style={{ flex: 1, display: "flex", alignItems: "center", gap: 11, padding: "12px 6px 12px 14px", cursor: "pointer", minWidth: 0 }}>
                            <span style={{ fontFamily: "var(--ln-mono)", fontSize: 11, color: included ? "rgba(var(--ln-fg-rgb),0.45)" : "rgba(var(--ln-fg-rgb),0.28)", width: 16 }}>{String(tr.trackNumber).padStart(2, "0")}</span>
                            <span style={{ flex: 1, fontFamily: "var(--ln-body)", fontSize: 14.5, color: included ? "var(--ln-fg)" : "rgba(var(--ln-fg-rgb),0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{tr.track.name}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, paddingRight: 4 }}>
                            {(["flame", "love", "skip"] as const).map((k) => {
                              const active = tr.reaction === k;
                              return (
                                <button key={k} type="button" title={LN_REACT[k].label} onClick={() => upd(i, { reaction: active ? null : k })} className="ln-press" style={{ padding: 7, borderRadius: 9, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: active ? `${LN_REACT[k].color}22` : "transparent", opacity: active ? 1 : 0.42, transition: "opacity 0.15s, background 0.15s" }}>
                                  <LNReact kind={k} size={18} />
                                </button>
                              );
                            })}
                          </div>
                          <button type="button" onClick={() => setOpenTrack((o) => (o === i ? null : i))} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "12px 13px", background: "none", border: "none", borderLeft: "1px solid rgba(var(--ln-fg-rgb),0.06)", cursor: "pointer" }}>
                            {(mc > 0 || tr.take) && <span style={{ fontFamily: "var(--ln-mono)", fontSize: 10, color: gold }}>{mc || "·"}</span>}
                            <LNIcon name="save" size={16} color={mc || tr.take || open ? gold : "rgba(var(--ln-fg-rgb),0.4)"} />
                          </button>
                        </div>
                        {open && (
                          <div style={{ padding: "2px 14px 14px", display: "flex", flexDirection: "column", gap: 9, background: `${gold}07` }}>
                            <textarea value={tr.take || ""} onChange={(e) => upd(i, { take: e.target.value })} rows={2} placeholder={`A note on “${tr.track.name}”…`} style={{ ...cmpInput, fontSize: 13.5 }} />
                            {/* Listen + scrub / tap a lyric to capture this track's moment. */}
                            <MomentCaptureBar
                              track={tr.track.name}
                              artist={tr.track.artist || selectedAlbum.artist}
                              onLyricsChange={(ls) => setLyricsByTrack((s) => ({ ...s, [tr.track.trackId]: ls }))}
                              onMark={(seconds) =>
                                upd(i, {
                                  notes: [...tr.notes, { seconds, note: "" }].sort(
                                    (a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity),
                                  ),
                                })
                              }
                              onManualMark={() => upd(i, { notes: [...tr.notes, { seconds: null, note: "" }] })}
                            />
                            <MomentsEditor
                              moments={tr.notes}
                              lyrics={lyricsByTrack[tr.track.trackId] || []}
                              onAdd={() => upd(i, { notes: [...tr.notes, { seconds: null, note: "" }] })}
                              onChange={(idx, patch) => upd(i, { notes: tr.notes.map((n, j) => (j === idx ? { ...n, ...patch } : n)) })}
                              onRemove={(idx) => upd(i, { notes: tr.notes.filter((_, j) => j !== idx) })}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="submit" disabled={!canPost || submitting} className="ln-press" style={{ width: "100%", marginTop: 22, padding: "15px", borderRadius: 14, border: "none", cursor: canPost && !submitting ? "pointer" : "default", fontFamily: "var(--ln-body)", fontSize: 15.5, fontWeight: 700, background: canPost ? gold : "rgba(var(--ln-fg-rgb),0.1)", color: canPost ? "#1a0a04" : "rgba(var(--ln-fg-rgb),0.4)", transition: "background 0.2s" }}>
                {submitting ? "Posting…" : !canPost ? "React or rate to post" : "Post album review"}
              </button>
            </>
          )}
        </div>

        {/* LIVE PREVIEW */}
        <div className="lnw-cmp-prev">
          <PreviewShell ready={!!draft && canPost}>
            {draft && <LNWCard vm={draft} />}
          </PreviewShell>
        </div>
      </form>

      <style>{`
        @media (max-width: 820px) {
          .lnw-cmp { grid-template-columns: 1fr !important; }
          .lnw-cmp-prev { display: none !important; }
        }
      `}</style>
    </div>
  );
}
