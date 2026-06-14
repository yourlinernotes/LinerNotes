import type { Track, Review } from "./types";

/**
 * Client-side API helper for Spotify search
 */
export async function searchTracks(query: string): Promise<Track[]> {
  const response = await fetch(
    `/api/search?${new URLSearchParams({ q: query })}`
  );

  if (!response.ok) {
    const data = await response.json();
    if (data.requiresAuth) {
      window.location.href = "/login";
      throw new Error("Authentication required");
    }
    throw new Error(data.error || "Search failed");
  }

  const data = await response.json();
  return data.tracks;
}

/**
 * Create a review
 */
export async function createReview(reviewData: {
  trackId: string;
  trackName: string;
  trackArtist: string;
  trackAlbum: string;
  artworkUrl: string;
  previewUrl?: string;
  rating: number;
  take?: string;
  momentSeconds?: number;
  momentLabel?: string;
}): Promise<Review> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewData),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to create review");
  }

  const data = await response.json();
  return data.review;
}

/**
 * Get reviews (user's or friends feed)
 */
export async function getReviews(options?: {
  userId?: string;
  feed?: "friends";
}): Promise<Review[]> {
  const params = new URLSearchParams();
  if (options?.userId) params.set("userId", options.userId);
  if (options?.feed) params.set("feed", options.feed);

  const response = await fetch(`/api/reviews?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch reviews");
  }

  const data = await response.json();
  return data.reviews;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<void> {
  const response = await fetch(`/api/reviews/${reviewId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to delete review");
  }
}

/**
 * Toggle like on a review
 */
export async function toggleLike(reviewId: string): Promise<{
  liked: boolean;
  likeCount: number;
}> {
  const response = await fetch(`/api/reviews/${reviewId}/like`, {
    method: "POST",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to toggle like");
  }

  return response.json();
}

/**
 * Toggle repost on a review
 */
export async function toggleRepost(reviewId: string): Promise<{
  reposted: boolean;
  repostCount: number;
}> {
  const response = await fetch(`/api/reviews/${reviewId}/repost`, {
    method: "POST",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to toggle repost");
  }

  return response.json();
}

/**
 * Get friends
 */
export async function getFriends(type?: "requests" | "sent") {
  const params = type ? new URLSearchParams({ type }) : "";
  const response = await fetch(`/api/friends?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch friends");
  }

  return response.json();
}

/**
 * Send friend request
 */
export async function sendFriendRequest(userId: string) {
  const response = await fetch(`/api/friends/${userId}`, {
    method: "POST",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to send friend request");
  }

  return response.json();
}

/**
 * Accept/reject friend request
 */
export async function updateFriendRequest(
  userId: string,
  action: "accept" | "reject"
) {
  const response = await fetch(`/api/friends/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to update friend request");
  }

  return response.json();
}

/**
 * Remove friend
 */
export async function removeFriend(userId: string) {
  const response = await fetch(`/api/friends/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to remove friend");
  }

  return response.json();
}
