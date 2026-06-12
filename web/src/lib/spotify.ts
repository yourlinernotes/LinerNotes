import { Track, Album } from "./types";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

interface SpotifyTrack {
  id: string;
  name: string;
  track_number?: number;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  preview_url: string | null;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string; height: number; width: number }[];
  release_date: string;
  total_tracks: number;
  tracks?: {
    items: SpotifyTrack[];
  };
}

interface SpotifySearchResponse {
  tracks?: {
    items: SpotifyTrack[];
  };
  albums?: {
    items: SpotifyAlbum[];
  };
}

/**
 * Convert Spotify track to our Track type
 */
function convertSpotifyTrack(spotifyTrack: SpotifyTrack): Track {
  return {
    trackId: spotifyTrack.id,
    name: spotifyTrack.name,
    artist: spotifyTrack.artists.map((a) => a.name).join(", "),
    album: spotifyTrack.album.name,
    artworkUrl: spotifyTrack.album.images[0]?.url || "",
    previewUrl: spotifyTrack.preview_url || undefined,
  };
}

/**
 * Convert Spotify album to our Album type
 */
function convertSpotifyAlbum(spotifyAlbum: SpotifyAlbum): Album {
  return {
    albumId: spotifyAlbum.id,
    name: spotifyAlbum.name,
    artist: spotifyAlbum.artists.map((a) => a.name).join(", "),
    artworkUrl: spotifyAlbum.images[0]?.url || "",
    releaseDate: spotifyAlbum.release_date,
    totalTracks: spotifyAlbum.total_tracks,
    tracks: spotifyAlbum.tracks
      ? spotifyAlbum.tracks.items.map((track, index) => ({
          trackId: track.id,
          name: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          album: spotifyAlbum.name,
          artworkUrl: spotifyAlbum.images[0]?.url || "",
          previewUrl: track.preview_url || undefined,
        }))
      : undefined,
  };
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  return response.json();
}

/**
 * Search for tracks on Spotify
 */
export async function searchTracks(
  query: string,
  accessToken: string
): Promise<Track[]> {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "10",
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data: SpotifySearchResponse = await response.json();
  return data.tracks!.items.map(convertSpotifyTrack);
}

/**
 * Search for albums on Spotify
 */
export async function searchAlbums(
  query: string,
  accessToken: string
): Promise<Album[]> {
  const params = new URLSearchParams({
    q: query,
    type: "album",
    limit: "10",
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data: SpotifySearchResponse = await response.json();
  return data.albums!.items.map(convertSpotifyAlbum);
}

/**
 * Get track details by ID
 */
export async function getTrack(
  trackId: string,
  accessToken: string
): Promise<Track> {
  const response = await fetch(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data: SpotifyTrack = await response.json();
  return convertSpotifyTrack(data);
}

/**
 * Get album details by ID (including full track listing)
 */
export async function getAlbum(
  albumId: string,
  accessToken: string
): Promise<Album> {
  const response = await fetch(`${SPOTIFY_API_BASE}/albums/${albumId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data: SpotifyAlbum = await response.json();
  return convertSpotifyAlbum(data);
}

/**
 * Get user's recently played tracks
 */
export async function getRecentlyPlayed(
  accessToken: string,
  limit = 20
): Promise<Track[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/player/recently-played?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items.map((item: { track: SpotifyTrack }) =>
    convertSpotifyTrack(item.track)
  );
}

/**
 * Get user's top tracks
 */
export async function getTopTracks(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit = 20
): Promise<Track[]> {
  const params = new URLSearchParams({
    time_range: timeRange,
    limit: limit.toString(),
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/me/top/tracks?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items.map(convertSpotifyTrack);
}

export { refreshAccessToken };
