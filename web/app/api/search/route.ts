import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTracks, searchAlbums, refreshAccessToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const type = searchParams.get("type") || "track"; // "track" or "album"

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    // Check if user is authenticated
    if (!session?.spotifyAccessToken) {
      return NextResponse.json(
        { error: "Not authenticated", requiresAuth: true },
        { status: 401 }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = session.spotifyAccessToken;
    if (session.spotifyExpiresAt && Date.now() >= session.spotifyExpiresAt) {
      if (!session.spotifyRefreshToken) {
        return NextResponse.json(
          { error: "Session expired", requiresAuth: true },
          { status: 401 }
        );
      }

      const tokenData = await refreshAccessToken(session.spotifyRefreshToken);
      accessToken = tokenData.access_token;
      // Note: NextAuth session update would need to be implemented differently
      // This is a simplified version - actual implementation may need session update logic
    }

    // Search using Spotify API
    if (type === "album") {
      const albums = await searchAlbums(query, accessToken);
      return NextResponse.json({ albums });
    } else {
      const tracks = await searchTracks(query, accessToken);
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
