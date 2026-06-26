/**
 * Display-oriented types for feed/profile cards and the Experience screen.
 *
 * These are the shapes the UI renders. Real API `Review`s are mapped into them
 * by `reviewToFeedReview` in ./feed-adapter.
 */

export interface Album {
  title: string;
  artist: string;
  year: number;
  kind?: 'playlist' | 'album';
  /** Source id (Spotify/iTunes/MB) — track id or album id — for deeplinking. */
  extId?: string;
  /** Real album artwork URL; palette is the gradient fallback / tint source. */
  artworkUrl?: string;
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
  tracks?: Array<{
    n: number;
    name: string;
    reaction: 'flame' | 'love' | 'skip' | null;
    review?: string;
    moments?: Array<{ sec: number; note: string }>;
  }>;
}

/** Display-oriented author shape for feed cards (a subset of User + tint). */
export type FeedAuthor = {
  id?: string;
  email?: string;
  handle: string;
  displayName?: string;
  name: string;
  avatarUrl?: string;
  tint: string;
};

export interface FeedReview {
  id: string;
  depth: 'full' | 'caption' | 'floor';
  user: FeedAuthor;
  album: Album;
  rating: number;
  at: string;
  take?: string;
  body?: string | null;
  notes?: Array<{ sec: number; label?: string; note: string }>;
  featured?: number | null;
  likeCount: number;
  repostCount: number;
  saved: boolean;
  via?: FeedAuthor;
}
