import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { getAlbum, refreshAccessToken } from "@/lib/spotify";

/**
 * GET /api/albums/[id] - Get album details with full tracklist
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Get album details using Spotify API
    const album = await getAlbum(id, accessToken);

    return NextResponse.json({ album });
  } catch (error) {
    console.error("Get album error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album" },
      { status: 500 }
    );
  }
}
