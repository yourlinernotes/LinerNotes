import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://beta-linernotes.vercel.app/api";

/**
 * GET /api/search - Search for tracks or albums
 * Proxies to the NestJS backend music search endpoints
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "track"; // "track" or "album"
  const limit = searchParams.get("limit") || "20";

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Not authenticated", requiresAuth: true },
        { status: 401 }
      );
    }

    // Try backend first, fallback to iTunes API if backend not deployed yet
    const endpoint = type === "album" ? "albums" : "tracks";
    const backendUrl = `${API_BASE_URL}/music/search/${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`;

    let data;
    try {
      const response = await fetch(backendUrl);

      if (response.ok) {
        data = await response.json();
      } else {
        throw new Error(`Backend returned ${response.status}`);
      }
    } catch (backendError) {
      console.log("Backend search failed, falling back to iTunes API:", backendError);

      // Fallback to iTunes Search API directly
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${type === "album" ? "album" : "song"}&limit=${limit}`;
      const itunesResponse = await fetch(itunesUrl);

      if (!itunesResponse.ok) {
        throw new Error("Both backend and iTunes API failed");
      }

      const itunesData = await itunesResponse.json();

      // Transform iTunes format to backend format
      if (type === "album") {
        data = {
          results: (itunesData.results || []).map((r: any) => ({
            albumId: r.collectionId,
            name: r.collectionName,
            artist: r.artistName,
            artworkUrl: (r.artworkUrl100 || "").replace("100x100", "600x600"),
            releaseDate: r.releaseDate,
            totalTracks: r.trackCount,
          })),
        };
      } else {
        data = {
          results: (itunesData.results || []).map((r: any) => ({
            trackId: r.trackId,
            name: r.trackName,
            artist: r.artistName,
            album: r.collectionName,
            artworkUrl: (r.artworkUrl100 || "").replace("100x100", "600x600"),
            previewUrl: r.previewUrl,
          })),
        };
      }
    }

    // Backend returns { results: [...], count: N }
    // Transform to match web app format
    if (type === "album") {
      // Normalize field names to match Album type
      const albums = (data.results || []).map((album: any) => ({
        albumId: String(album.albumId ?? album.id ?? ""),
        name: album.name,
        artist: album.artist,
        artworkUrl: album.artworkUrl,
        releaseDate: album.releaseDate,
        totalTracks: album.totalTracks || album.trackCount,
      }));

      return NextResponse.json({ albums });
    } else {
      // Normalize field names to match Track type
      const tracks = (data.results || []).map((track: any) => ({
        trackId: String(track.trackId ?? track.id ?? ""),
        name: track.name,
        artist: track.artist,
        album: track.album,
        artworkUrl: track.artworkUrl,
        previewUrl: track.previewUrl,
      }));

      return NextResponse.json({ tracks });
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: `Failed to search ${type}s` },
      { status: 500 }
    );
  }
}
