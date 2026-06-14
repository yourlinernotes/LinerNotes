/**
 * @linernotes/core/types
 *
 * Single source of truth for all data shapes.
 * Used by both apps/mobile and apps/web.
 */

// ============================================================================
// CORE OBJECTS
// ============================================================================

/**
 * Timestamped moment - the atomic unit of LinerNotes
 * Stored as INTEGER seconds; formatted to m:ss only at display
 */
export interface Moment {
  /** Timestamp in integer seconds */
  seconds: number;
  /** Label for the moment (e.g., "best bit", "intro", "strings come in") */
  label?: string;
  /** Optional longer note/commentary about this moment */
  note: string;
}

/**
 * Per-track reaction within an album
 */
export type ReactionType = 'flame' | 'love' | 'skip' | null;

export interface TrackReaction {
  trackId: string;
  trackName: string;
  trackNumber: number;
  /** Quick reaction: flame (standout) / love / skip / null */
  reaction: ReactionType;
  /** Optional timestamped moment for this track */
  moment?: Moment;
}

/**
 * Album review with per-track reactions and overall rating
 */
export interface AlbumReview {
  id: string;
  userId: string;

  // Album metadata
  album: {
    id: string;
    name: string;
    artist: string;
    artworkUrl: string;
    releaseDate?: string;
    totalTracks?: number;
  };

  /** Overall rating (0.5-5.0), can be manual or auto-calculated */
  overallRating?: number;
  /** Optional review body for the album as a whole */
  body?: string;

  /** Per-track reactions */
  tracks: TrackReaction[];
  /** Additional timestamped notes (not tied to specific tracks) */
  notes: Moment[];
  /** Index of the note to feature on share card (default: 0) */
  featuredNoteIdx: number;

  createdAt: string;
  updatedAt: string;
}

/**
 * Single track review (standalone, not part of album)
 */
export interface Review {
  id: string;
  userId: string;

  // Track metadata
  track: {
    id: string;
    name: string;
    artist: string;
    album: string;
    artworkUrl: string;
    previewUrl?: string;
  };

  /** Rating (0.5-5.0) */
  rating: number;
  /** Optional quick reaction */
  reaction?: ReactionType;
  /** Optional longer review text */
  take?: string;

  /** Timestamped notes on this track */
  notes: Moment[];
  /** Which note to feature on the share card */
  featuredNoteIdx: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// USER & PROFILE
// ============================================================================

/**
 * Top 4 tracks/albums - permanent identity
 */
export interface Top4 {
  tracks?: Array<{ id: string; name: string; artist: string; artworkUrl: string }>;
  albums?: Array<{ id: string; name: string; artist: string; artworkUrl: string }>;
}

/**
 * Weekly 4 - rotating, auto-filled from Last.fm/in-app data
 */
export interface WeeklyFour {
  tracks: Array<{ id: string; name: string; artist: string; artworkUrl: string; playCount: number }>;
  lastUpdated: string;
}

export interface User {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;

  /** Permanent top 4 (user-curated) */
  favourites?: Top4;
  /** Auto-generated weekly top 4 */
  thisWeek?: WeeklyFour;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SOCIAL ACTIONS
// ============================================================================

/**
 * Three distinct actions:
 * - repost: Amplify to feed (public)
 * - save: Private bookmark
 * - like: Lightweight signal
 */
export type ReviewActionType = 'repost' | 'save' | 'like';

export interface ReviewAction {
  id: string;
  reviewId: string;
  userId: string;
  type: ReviewActionType;
  createdAt: string;
}

// ============================================================================
// FRIENDSHIP
// ============================================================================

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// MUSIC CONNECTIONS
// ============================================================================

export type MusicServiceType = 'spotify' | 'lastfm' | 'in-app';

export interface MusicConnection {
  id: string;
  userId: string;
  service: MusicServiceType;

  // Service-specific identifiers
  serviceUserId?: string;
  serviceUsername?: string;

  // API tokens (encrypted at rest)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;

  // Last.fm specific
  sessionKey?: string;

  connectedAt: string;
  updatedAt: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format integer seconds to m:ss display format
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse m:ss string to integer seconds
 */
export function parseTimestamp(timestamp: string): number {
  const [mins, secs] = timestamp.split(':').map(Number);
  return mins * 60 + secs;
}
