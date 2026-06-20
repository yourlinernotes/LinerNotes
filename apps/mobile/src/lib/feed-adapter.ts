/**
 * Adapts the API `Review` shape into the display-oriented `FeedReview` shape
 * consumed by ReviewCard / ExperienceScreen.
 *
 * Accent stays gold everywhere; the per-album background palette is derived
 * deterministically from the album id for now.
 *
 * TODO: replace `paletteFromId` with real dominant-colour extraction from the
 * album artwork (track.artworkUrl) once a color-extraction step is wired in.
 */

import { tokens } from './tokens';
import type { Review } from './types';
import type { FeedReview, FeedAuthor } from './feed-types';

/** Background palettes (deep/mid/lo/glow vary per album; accent is always gold). */
const PALETTES = [
  { deep: '#23160a', mid: '#3a2a16', lo: '#1a1208', glow: '#7a5a2a' }, // amber
  { deep: '#07140e', mid: '#16322a', lo: '#06231a', glow: '#1f5f48' }, // green
  { deep: '#0a1620', mid: '#1c3850', lo: '#0a1a28', glow: '#2a5a78' }, // blue
  { deep: '#160c26', mid: '#2e1f50', lo: '#120a26', glow: '#4a3a80' }, // violet
  { deep: '#260c12', mid: '#50202a', lo: '#1c0a10', glow: '#80303f' }, // rose
  { deep: '#0c1a1c', mid: '#1a4044', lo: '#0a2024', glow: '#2a6a70' }, // teal
] as const;

/** Stable palette per album/track id, with the gold accent fixed across all. */
export function paletteFromId(id: string) {
  const seed = id || 'default';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const base = PALETTES[hash % PALETTES.length];
  return { ...base, accent: tokens.colors.gold };
}

/**
 * A `Review` as returned by list endpoints, which enrich it with the author
 * and social counts (not part of the canonical `Review` type).
 */
export type EnrichedReview = Review & {
  user?: FeedAuthor;
  likeCount?: number;
  repostCount?: number;
  saved?: boolean;
  via?: FeedAuthor;
};

/** Map an API review (+ a fallback author) into the card display shape. */
export function reviewToFeedReview(review: EnrichedReview, fallbackAuthor: FeedAuthor): FeedReview {
  const author = review.user ?? fallbackAuthor;
  const depth: FeedReview['depth'] = !review.take ? 'floor' : 'caption';

  // Backend endpoints are inconsistent: some return a nested `track` object
  // (keyed by `id` or `trackId`), reposts/saves return flat `trackName` fields.
  // Read defensively so the card never crashes on a missing `track`.
  const t: any = (review as any).track ?? review;
  const trackName = t.name ?? t.trackName ?? '';
  const trackArtist = t.artist ?? t.trackArtist ?? '';
  const trackAlbum = t.album ?? t.trackAlbum ?? '';
  const trackArtwork = t.artworkUrl ?? '';
  const trackId = t.id ?? t.trackId ?? review.id;

  return {
    id: review.id,
    depth,
    user: author,
    album: {
      title: trackName,
      artist: trackArtist,
      year: 0,
      artworkUrl: trackArtwork,
      palette: paletteFromId(trackAlbum || trackId),
    },
    rating: review.rating,
    at: review.createdAt,
    take: review.take,
    body: null,
    notes: review.notes?.map((m) => ({ sec: m.seconds, label: m.label, note: m.note })),
    featured: review.featuredNoteIdx ?? null,
    likeCount: review.likeCount ?? 0,
    repostCount: review.repostCount ?? 0,
    saved: review.saved ?? false,
    via: review.via,
  };
}

/**
 * Map an API album review (with nested trackReviews) into the card display
 * shape, so album reviews render as album cards (with a track strip).
 */
export function albumReviewToFeedReview(ar: any, fallbackAuthor: FeedAuthor): FeedReview {
  const u = ar?.user;
  const author: FeedAuthor = u
    ? {
        id: u.id,
        handle: u.handle ?? fallbackAuthor.handle,
        name: u.displayName || u.name || fallbackAuthor.name,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        tint: fallbackAuthor.tint,
      }
    : fallbackAuthor;

  const album = ar?.album ?? {};
  const albumName = album.name ?? album.title ?? '';
  const albumId = album.albumId ?? album.id ?? ar?.id ?? albumName;
  const trackReviews: any[] = Array.isArray(ar?.trackReviews) ? ar.trackReviews : [];

  const tracks = trackReviews.map((tr, i) => ({
    n: tr.trackNumber || i + 1,
    name: tr.track?.name ?? tr.trackName ?? '',
    reaction: (tr.reaction ?? null) as 'flame' | 'love' | 'skip' | null,
    review: tr.take,
    moments: (tr.notes ?? []).map((n: any) => ({ sec: n.seconds, note: n.note ?? n.label ?? '' })),
  }));

  // All per-track moments, for the card's moment line / experience read-along.
  const notes = trackReviews.flatMap((tr) =>
    (tr.notes ?? []).map((n: any) => ({ sec: n.seconds, label: n.label, note: n.note ?? '' }))
  );

  return {
    id: ar.id,
    depth: ar.take ? 'full' : 'caption',
    user: author,
    album: {
      title: albumName,
      artist: album.artist ?? '',
      year: 0,
      kind: 'album',
      artworkUrl: album.artworkUrl,
      palette: paletteFromId(String(albumId)),
      tracks,
    },
    rating: ar.overallRating ?? 0,
    at: ar.createdAt,
    take: ar.take,
    body: null,
    notes,
    featured: 0,
    likeCount: ar.likeCount ?? 0,
    repostCount: ar.repostCount ?? 0,
    saved: false,
  };
}

/**
 * Map a playlist (title + curated tracks, each with optional reaction/note)
 * into a FeedReview so it renders as a playlist card.
 */
export function playlistToFeedReview(pl: any, fallbackAuthor: FeedAuthor): FeedReview {
  const u = pl?.user;
  const author: FeedAuthor = u
    ? {
        id: u.id,
        handle: u.handle ?? fallbackAuthor.handle,
        name: u.displayName || u.name || fallbackAuthor.name,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        tint: fallbackAuthor.tint,
      }
    : fallbackAuthor;

  const plTracks: any[] = Array.isArray(pl?.tracks) ? pl.tracks : [];
  const tracks = plTracks.map((t, i) => ({
    n: (typeof t.order === 'number' ? t.order : i) + 1,
    name: t.name ?? '',
    reaction: (t.reaction ?? null) as 'flame' | 'love' | 'skip' | null,
    review: t.note,
    moments: [] as Array<{ sec: number; note: string }>,
  }));
  const firstArt = plTracks.find((t) => t.artworkUrl)?.artworkUrl;
  const count = plTracks.length;

  return {
    id: pl.id,
    depth: pl.description ? 'caption' : 'floor',
    user: author,
    album: {
      title: pl.title ?? 'Playlist',
      artist: `${count} track${count === 1 ? '' : 's'}`,
      year: 0,
      kind: 'playlist',
      artworkUrl: firstArt,
      palette: paletteFromId(String(pl.id ?? pl.title ?? 'playlist')),
      tracks,
    },
    rating: 0,
    at: pl.createdAt,
    take: pl.description || undefined,
    body: null,
    notes: [],
    featured: null,
    likeCount: pl.likeCount ?? 0,
    repostCount: pl.repostCount ?? 0,
    saved: false,
  };
}
