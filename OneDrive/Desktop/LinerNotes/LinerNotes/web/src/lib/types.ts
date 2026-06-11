// THE DATA CONTRACT — everyone imports, only Abia edits

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

export type Review = {
  id: string;
  userId: string;
  user?: User;
  track: Track;
  rating: number; // 0.5–5.0 in 0.5 steps
  take?: string; // one short line
  moment?: Moment; // optional marked highlight
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

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted";
};
