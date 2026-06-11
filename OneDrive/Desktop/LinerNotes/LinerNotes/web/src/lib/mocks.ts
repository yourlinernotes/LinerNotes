// Mock data for development — Abia will push real version
import type { Review, FeedItem, User } from "./types";

export const mockUsers: User[] = [
  {
    id: "1",
    handle: "anusha",
    displayName: "Anusha",
    avatarUrl: "https://i.pravatar.cc/150?img=1",
  },
  {
    id: "2",
    handle: "abia",
    displayName: "Abia",
    avatarUrl: "https://i.pravatar.cc/150?img=2",
  },
  {
    id: "3",
    handle: "ira",
    displayName: "Ira",
    avatarUrl: "https://i.pravatar.cc/150?img=3",
  },
];

export const mockReviews: Review[] = [
  {
    id: "r1",
    userId: "1",
    user: mockUsers[0],
    track: {
      trackId: "1440857781",
      name: "Language",
      artist: "Porter Robinson",
      album: "Worlds",
      artworkUrl:
        "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/68/0f/3d/680f3d6f-43a8-7d8f-0900-1d993128e66e/14UMGIM18668.rgb.jpg/400x400bb.jpg",
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/f7/c0/1f/f7c01f2a-8d0a-3b7e-a0e0-5c4f6f5e5b5e/mzaf_123456789.plus.aac.p.m4a",
      genre: "Electronic",
    },
    rating: 5.0,
    take: "This drop still gives me chills after a thousand listens",
    moment: { seconds: 151, label: "best bit" },
    createdAt: "2026-06-11T10:30:00Z",
    likeCount: 23,
    repostCount: 5,
    likedByMe: false,
    repostedByMe: false,
  },
  {
    id: "r2",
    userId: "2",
    user: mockUsers[1],
    track: {
      trackId: "1440857782",
      name: "Clarity",
      artist: "Zedd",
      album: "Clarity",
      artworkUrl:
        "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5b/9e/5e/5b9e5e0a-3b0a-3b7e-a0e0-5c4f6f5e5b5e/12UMGIM12345.rgb.jpg/400x400bb.jpg",
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/a1/b2/c3/a1b2c3d4-1234-5678-9abc-def012345678/mzaf_987654321.plus.aac.p.m4a",
      genre: "Electronic",
    },
    rating: 4.5,
    take: "Perfect driving music at 2am",
    createdAt: "2026-06-11T09:15:00Z",
    likeCount: 12,
    repostCount: 2,
    likedByMe: true,
    repostedByMe: false,
  },
  {
    id: "r3",
    userId: "3",
    user: mockUsers[2],
    track: {
      trackId: "1440857783",
      name: "Strobe",
      artist: "deadmau5",
      album: "For Lack of a Better Name",
      artworkUrl:
        "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1a/2b/3c/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d/cover.jpg/400x400bb.jpg",
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/d1/e2/f3/d1e2f3a4-b5c6-d7e8-f9a0-b1c2d3e4f5a6/mzaf_111222333.plus.aac.p.m4a",
      genre: "Electronic",
    },
    rating: 5.0,
    createdAt: "2026-06-10T22:00:00Z",
    likeCount: 45,
    repostCount: 12,
    likedByMe: false,
    repostedByMe: true,
  },
];

export const mockFeedItems: FeedItem[] = [
  {
    kind: "review",
    review: mockReviews[0],
    at: mockReviews[0].createdAt,
  },
  {
    kind: "repost",
    review: mockReviews[2],
    repostedBy: mockUsers[0],
    at: "2026-06-11T08:00:00Z",
  },
  {
    kind: "review",
    review: mockReviews[1],
    at: mockReviews[1].createdAt,
  },
];
