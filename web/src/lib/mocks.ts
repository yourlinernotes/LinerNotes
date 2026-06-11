import { FeedItem, Review, Track, User } from './types';

const now = () => new Date().toISOString();

export const users: User[] = [
  { id: 'u1', handle: 'abia', displayName: 'Abia', avatarUrl: '' },
  { id: 'u2', handle: 'sam', displayName: 'Sam Friend', avatarUrl: '' },
  { id: 'u3', handle: 'maya', displayName: 'Maya Friend', avatarUrl: '' },
];

export const tracks: Track[] = [
  {
    trackId: 't1',
    name: 'Golden Hour',
    artist: 'Artist One',
    album: 'Album A',
    artworkUrl: 'https://via.placeholder.com/600',
    previewUrl: undefined,
    genre: 'Indie',
  },
  {
    trackId: 't2',
    name: 'Night Drive',
    artist: 'Artist Two',
    album: 'Album B',
    artworkUrl: 'https://via.placeholder.com/600',
    previewUrl: undefined,
    genre: 'Electronic',
  },
];

export const reviews: Review[] = [
  {
    id: 'r1',
    userId: 'u1',
    user: users[0],
    track: tracks[0],
    rating: 4.5,
    take: "Lovely, sunlit production",
    moment: { seconds: 42, label: 'chorus' },
    createdAt: now(),
    likeCount: 3,
    repostCount: 1,
    likedByMe: false,
    repostedByMe: false,
  },
  {
    id: 'r2',
    userId: 'u2',
    user: users[1],
    track: tracks[1],
    rating: 5.0,
    take: "Perfect late-night vibe",
    createdAt: now(),
    likeCount: 5,
    repostCount: 2,
    likedByMe: false,
    repostedByMe: false,
  },
];

export const feed: FeedItem[] = [
  { kind: 'review', review: reviews[1], at: now() },
  { kind: 'repost', review: reviews[0], repostedBy: users[1], at: now() },
];

export const getMockCurrentUser = () => users[0];

export default { users, tracks, reviews, feed };
