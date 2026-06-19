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

    // Proxy to the NestJS backend music search endpoints
    const endpoint = type === "album" ? "albums" : "tracks";
    const backendUrl = `${API_BASE_URL}/music/search/${endpoint}?q=${encodeURIComponent(query)}&limit=${limit}`;

    const response = await fetch(backendUrl);

    if (!response.ok) {
      throw new Error(`Backend search failed with status ${response.status}`);
    }

    const data = await response.json();

    // Backend returns { results: [...], count: N }
    // Transform to match web app format
    if (type === "album") {
      return NextResponse.json({
        albums: data.results || [],
      });
    } else {
      return NextResponse.json({
        tracks: data.results || [],
      });
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: `Failed to search ${type}s` },
      { status: 500 }
    );
  }
}
