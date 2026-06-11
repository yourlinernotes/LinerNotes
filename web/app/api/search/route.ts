import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { searchTracks, refreshAccessToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    // Check if user is authenticated
    if (!session.spotifyAccessToken) {
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
      session.spotifyAccessToken = tokenData.access_token;
      session.spotifyExpiresAt = Date.now() + tokenData.expires_in * 1000;
      await session.save();
    }

    // Search tracks using Spotify API
    const tracks = await searchTracks(query, accessToken);

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search tracks" },
      { status: 500 }
    );
  }
}
