import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * GET /api/search - Search for tracks or albums
 *
 * TODO: Implement open API stack (iTunes/Deezer/MusicBrainz)
 * Spotify OAuth is removed in favor of open APIs for beta
 */
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
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Not authenticated", requiresAuth: true },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Search not yet implemented - open API stack pending" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: `Failed to search ${type}s` },
      { status: 500 }
    );
  }
}
