// THE DATA CONTRACT — everyone imports, only Abia edits

export type Note = {
  id: string;
  seconds: number;
  label: string;
  note?: string; // Optional longer commentary
  createdAt: string;
};

export type Moment = {
  seconds: number;
  label?: string;
};

export type User = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
};

export type Track = {
  trackId: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl?: string;
  genre?: string;
};

export type Album = {
  albumId: string;
  name: string;
  artist: string;
  artworkUrl: string;
  releaseDate?: string;
  totalTracks?: number;
  tracks?: Track[]; // Full track listing if available
};

export type Reaction = "flame" | "love" | "skip";

export type Review = {
  id: string;
  userId: string;
  user?: User;
  track: Track;
  rating: number; // 0.5–5.0 in 0.5 steps
  take?: string; // one short line
  moment?: Moment; // DEPRECATED: Use notes[0] or featuredNote instead
  notes?: Note[]; // Multiple timestamped notes
  featuredNoteId?: string; // Which note to show on share card
  // Album review fields (when part of an album review)
  albumReviewId?: string;
  trackNumber?: number;
  reaction?: Reaction; // For mobile sharing (flame/love/skip)
  createdAt: string; // ISO
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
};

export type AlbumReview = {
  id: string;
  userId: string;
  user?: User;
  album: Album;
  overallRating?: number; // Manual or auto-calculated
  take?: string; // Review of album as a whole
  trackReviews?: Review[]; // Individual track reviews
  createdAt: string; // ISO
  likeCount: number;
  repostCount: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
};

export type FeedItem = {
  kind: "review" | "repost";
  review: Review;
  repostedBy?: User;
  at: string;
};

export type AlbumFeedItem = {
  kind: "album_review" | "album_repost";
  albumReview: AlbumReview;
  repostedBy?: User;
  at: string;
};

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted";
};
