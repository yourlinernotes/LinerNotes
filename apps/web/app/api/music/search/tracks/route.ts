import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/music/search/tracks - Search for tracks using iTunes API
 * Public endpoint (no auth required for search)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = searchParams.get("limit") || "20";

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    // Use iTunes Search API
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
    const response = await fetch(itunesUrl);

    if (!response.ok) {
      throw new Error(`iTunes API returned ${response.status}`);
    }

    const data = await response.json();

    // Transform to backend format
    const results = (data.results || []).map((track: any) => ({
      id: track.trackId,
      name: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      artworkUrl: (track.artworkUrl100 || "").replace("100x100", "600x600"),
      previewUrl: track.previewUrl,
      releaseDate: track.releaseDate,
      duration: track.trackTimeMillis,
      genre: track.primaryGenreName,
      isrc: track.isrc,
    }));

    return NextResponse.json({
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("Track search error:", error);
    return NextResponse.json(
      { error: "Failed to search tracks" },
      { status: 500 }
    );
  }
}
