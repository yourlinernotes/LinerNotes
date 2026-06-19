import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/albums/[id] - Get album details with full tracklist
 * Uses iTunes Lookup API for track listings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params;

  if (!albumId) {
    return NextResponse.json(
      { error: "Album ID is required" },
      { status: 400 }
    );
  }

  try {
    // Use iTunes Lookup API to get album tracks
    const itunesUrl = `https://itunes.apple.com/lookup?id=${albumId}&entity=song`;
    const response = await fetch(itunesUrl);

    if (!response.ok) {
      throw new Error(`iTunes API returned ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    // First result is the album itself, rest are tracks
    const albumData = results[0];
    const tracks = results.slice(1);

    return NextResponse.json({
      album: {
        albumId: albumData.collectionId,
        title: albumData.collectionName,
        artist: albumData.artistName,
        artworkUrl: (albumData.artworkUrl100 || "").replace("100x100", "600x600"),
        releaseDate: albumData.releaseDate,
        trackCount: albumData.trackCount,
        tracks: tracks.map((track: any, index: number) => ({
          trackId: track.trackId,
          trackNumber: track.trackNumber || index + 1,
          title: track.trackName,
          artist: track.artistName,
          duration: track.trackTimeMillis,
          previewUrl: track.previewUrl,
        })),
      },
    });
  } catch (error) {
    console.error("Album tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album tracks" },
      { status: 500 }
    );
  }
}
