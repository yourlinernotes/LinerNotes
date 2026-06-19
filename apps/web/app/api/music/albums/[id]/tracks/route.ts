import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/music/albums/[id]/tracks - Get tracks for an album
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
    const album = results[0];
    const tracks = results.slice(1);

    return NextResponse.json({
      album: {
        id: album.collectionId,
        name: album.collectionName,
        artist: album.artistName,
        artworkUrl: (album.artworkUrl100 || "").replace("100x100", "600x600"),
        releaseDate: album.releaseDate,
        trackCount: album.trackCount,
      },
      tracks: tracks.map((track: any, index: number) => ({
        id: track.trackId,
        trackNumber: track.trackNumber || index + 1,
        name: track.trackName,
        artist: track.artistName,
        duration: track.trackTimeMillis,
        previewUrl: track.previewUrl,
      })),
    });
  } catch (error) {
    console.error("Album tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album tracks" },
      { status: 500 }
    );
  }
}
