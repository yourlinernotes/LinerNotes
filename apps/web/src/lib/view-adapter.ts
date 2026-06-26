// Maps the real data contract (src/lib/types) onto the design bundle's
// view-model so the editorial components can render real reviews unchanged.

import type { Review, AlbumReview, User, Playlist } from "@/lib/types";
import { paletteFromString, tintFromString, type Palette } from "@/lib/palette";

export type MomentVM = { sec: number; label: string; note: string };

export type TrackVM = {
  n: number;
  name: string;
  reaction?: "flame" | "love" | "skip" | null;
  moments: MomentVM[];
  review?: string;
  previewUrl?: string | null; // 30s iTunes preview, when available
};

export type UserVM = {
  id: string;
  name: string;
  handle: string;
  tint: string;
  avatarUrl?: string | null;
};

export type AlbumVM = {
  title: string;
  artist: string;
  year?: string;
  artworkUrl?: string | null;
  palette: Palette;
  kind: "track" | "album" | "playlist";
  tracks: TrackVM[];
  previewUrl?: string | null; // 30s iTunes preview for single-track reviews
};

export type ReviewVM = {
  id: string;
  href: string;
  kind: "track" | "album" | "playlist";
  album: AlbumVM;
  user: UserVM;
  rating: number;
  take?: string;
  body?: string;
  notes: MomentVM[];
  via?: { name: string; handle: string } | null;
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  saved?: boolean;
  at: string;
};

const FALLBACK_USER: UserVM = { id: "anon", name: "Someone", handle: "someone", tint: "#bd9183" };

export function toUserVM(u?: User | null): UserVM {
  if (!u) return FALLBACK_USER;
  return {
    id: u.id,
    name: u.displayName || u.handle || "Someone",
    handle: u.handle || "someone",
    tint: tintFromString(u.id || u.handle),
    avatarUrl: u.avatarUrl ?? null,
  };
}

function yearOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  const y = new Date(iso).getFullYear();
  return Number.isFinite(y) && y > 1900 ? String(y) : undefined;
}

function notesToMoments(
  notes: Review["notes"],
  featuredNoteId?: string
): MomentVM[] {
  if (!notes || notes.length === 0) return [];
  const mapped = notes.map((n) => ({
    sec: Math.round(n.seconds),
    label: n.label || "moment",
    note: n.note || n.label || "",
  }));
  if (featuredNoteId) {
    const idx = notes.findIndex((n) => n.id === featuredNoteId);
    if (idx > 0) {
      const [f] = mapped.splice(idx, 1);
      mapped.unshift(f);
    }
  }
  return mapped;
}

export function toReviewVM(review: Review, via?: { name: string; handle: string } | null): ReviewVM {
  const t = review.track;
  return {
    id: review.id,
    href: `/card/${review.id}`,
    kind: "track",
    album: {
      title: t.name,
      artist: t.artist,
      year: undefined,
      artworkUrl: t.artworkUrl || null,
      palette: paletteFromString(t.trackId || t.album || t.name),
      kind: "track",
      tracks: [],
      previewUrl: t.previewUrl ?? null,
    },
    user: toUserVM(review.user),
    rating: review.rating || 0,
    take: review.take || undefined,
    body: undefined,
    notes: notesToMoments(review.notes, review.featuredNoteId),
    via: via ?? null,
    likeCount: review.likeCount ?? 0,
    repostCount: review.repostCount ?? 0,
    likedByMe: review.likedByMe,
    repostedByMe: review.repostedByMe,
    at: review.createdAt,
  };
}

export function toAlbumReviewVM(
  ar: AlbumReview,
  via?: { name: string; handle: string } | null
): ReviewVM {
  const a = ar.album;
  const trackReviews = ar.trackReviews || [];
  const tracks: TrackVM[] = trackReviews
    .slice()
    .sort((x, y) => (x.trackNumber ?? 0) - (y.trackNumber ?? 0))
    .map((tr, i) => ({
      n: tr.trackNumber ?? i + 1,
      name: tr.track?.name || `Track ${i + 1}`,
      reaction: tr.reaction ?? null,
      moments: notesToMoments(tr.notes, tr.featuredNoteId),
      review: tr.take || undefined,
      previewUrl: tr.track?.previewUrl ?? null,
    }));
  return {
    id: ar.id,
    href: `/album-card/${ar.id}`,
    kind: "album",
    album: {
      title: a.name,
      artist: a.artist,
      year: yearOf(a.releaseDate),
      artworkUrl: a.artworkUrl || null,
      palette: paletteFromString(a.albumId || a.name),
      kind: "album",
      tracks,
    },
    user: toUserVM(ar.user),
    rating: ar.overallRating || 0,
    take: ar.take || undefined,
    body: undefined,
    notes: [],
    via: via ?? null,
    likeCount: ar.likeCount ?? 0,
    repostCount: ar.repostCount ?? 0,
    likedByMe: ar.likedByMe,
    repostedByMe: ar.repostedByMe,
    at: ar.createdAt,
  };
}

export function toPlaylistVM(
  pl: Playlist,
  via?: { name: string; handle: string } | null
): ReviewVM {
  const tracks: TrackVM[] = (pl.tracks || [])
    .slice()
    .sort((x, y) => x.order - y.order)
    .map((pt, i) => ({
      n: i + 1,
      name: pt.name,
      reaction: null,
      moments: [],
      review: pt.note || undefined,
    }));
  return {
    id: pl.id,
    href: `/playlist/${pl.id}`,
    kind: "playlist",
    album: {
      title: pl.title,
      artist: pl.user?.displayName || pl.user?.handle || "playlist",
      artworkUrl: pl.tracks?.[0]?.artworkUrl || null,
      palette: paletteFromString(pl.id || pl.title),
      kind: "playlist",
      tracks,
    },
    user: toUserVM(pl.user),
    rating: 0,
    take: pl.description || undefined,
    body: undefined,
    notes: [],
    via: via ?? null,
    likeCount: pl.likeCount ?? 0,
    repostCount: pl.repostCount ?? 0,
    likedByMe: pl.likedByMe,
    repostedByMe: pl.repostedByMe,
    at: pl.createdAt,
  };
}
