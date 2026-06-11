import type { Track } from "./types";

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
      // Redirect to login if not authenticated
      window.location.href = "/api/auth/spotify/login";
      throw new Error("Authentication required");
    }
    throw new Error(data.error || "Search failed");
  }

  const data = await response.json();
  return data.tracks;
}

/**
 * Check if user is authenticated
 */
export async function checkAuth(): Promise<{
  authenticated: boolean;
  hasRefreshToken?: boolean;
  isExpired?: boolean;
}> {
  const response = await fetch("/api/auth/me");
  return response.json();
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  await fetch("/api/auth/me", { method: "DELETE" });
  window.location.href = "/";
}
