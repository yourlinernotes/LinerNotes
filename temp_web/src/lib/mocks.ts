// Mock data for development — until Abia's API is ready
import type { Review, FeedItem, User, Track } from "./types";

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

// Current logged-in user for demo
export const currentUser = mockUsers[0];

export const mockTracks: Track[] = [
  {
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
  {
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
  {
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
  {
    trackId: "1440857784",
    name: "Ocean Eyes",
    artist: "Billie Eilish",
    album: "dont smile at me",
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/aa/bb/cc/aabbccdd-1234-5678-9abc-def012345678/cover.jpg/400x400bb.jpg",
    genre: "Pop",
  },
  {
    trackId: "1440857785",
    name: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/dd/ee/ff/ddeeffgg-1234-5678-9abc-def012345678/cover.jpg/400x400bb.jpg",
    genre: "R&B",
  },
];

export const mockReviews: Review[] = [
  {
    id: "r1",
    userId: "1",
    user: mockUsers[0],
    track: mockTracks[0],
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
    track: mockTracks[1],
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
    track: mockTracks[2],
    rating: 5.0,
    take: "10 minutes of pure bliss",
    createdAt: "2026-06-10T22:00:00Z",
    likeCount: 45,
    repostCount: 12,
    likedByMe: false,
    repostedByMe: true,
  },
  {
    id: "r4",
    userId: "2",
    user: mockUsers[1],
    track: mockTracks[3],
    rating: 4.0,
    createdAt: "2026-06-10T18:30:00Z",
    likeCount: 8,
    repostCount: 1,
    likedByMe: false,
    repostedByMe: false,
  },
  {
    id: "r5",
    userId: "3",
    user: mockUsers[2],
    track: mockTracks[4],
    rating: 4.5,
    take: "Synthwave perfection",
    createdAt: "2026-06-10T14:00:00Z",
    likeCount: 19,
    repostCount: 4,
    likedByMe: true,
    repostedByMe: false,
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
  {
    kind: "review",
    review: mockReviews[4],
    at: mockReviews[4].createdAt,
  },
  {
    kind: "review",
    review: mockReviews[3],
    at: mockReviews[3].createdAt,
  },
];

// Mock API functions for development
export const mockAPI = {
  searchTracks: async (query: string): Promise<Track[]> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockTracks.filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase())
    );
  },

  submitReview: async (review: Partial<Review>): Promise<Review> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const newReview: Review = {
      id: `r${Date.now()}`,
      userId: currentUser.id,
      user: currentUser,
      track: review.track!,
      rating: review.rating!,
      take: review.take,
      moment: review.moment,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      repostCount: 0,
      likedByMe: false,
      repostedByMe: false,
    };
    return newReview;
  },

  getFeed: async (): Promise<FeedItem[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockFeedItems;
  },

  getUserReviews: async (userId: string): Promise<Review[]> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockReviews.filter((r) => r.userId === userId);
  },

  likeReview: async (reviewId: string): Promise<{ likeCount: number; likedByMe: boolean }> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const review = mockReviews.find((r) => r.id === reviewId);
    if (!review) throw new Error("Review not found");

    const wasLiked = review.likedByMe || false;
    review.likedByMe = !wasLiked;
    review.likeCount += wasLiked ? -1 : 1;

    return { likeCount: review.likeCount, likedByMe: review.likedByMe };
  },

  repostReview: async (reviewId: string): Promise<{ repostCount: number; repostedByMe: boolean }> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const review = mockReviews.find((r) => r.id === reviewId);
    if (!review) throw new Error("Review not found");

    const wasReposted = review.repostedByMe || false;
    review.repostedByMe = !wasReposted;
    review.repostCount += wasReposted ? -1 : 1;

    return { repostCount: review.repostCount, repostedByMe: review.repostedByMe };
  },
};
