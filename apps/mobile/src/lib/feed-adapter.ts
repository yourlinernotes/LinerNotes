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
