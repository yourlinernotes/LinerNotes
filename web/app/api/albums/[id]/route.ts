import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/albums/[id] - Get album details with full tracklist
 *
 * TODO: Implement open API stack (iTunes/Deezer/MusicBrainz)
 * Spotify OAuth is removed in favor of open APIs for beta
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json(
        { error: "Not authenticated", requiresAuth: true },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Album lookup not yet implemented - open API stack pending" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Get album error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album" },
      { status: 500 }
    );
  }
}
