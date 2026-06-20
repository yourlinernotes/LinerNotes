import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/music/upsert/album - Upsert album metadata into database
 * Called automatically when creating an album review to ensure album exists
 * Public endpoint (no auth required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, name, artist, artworkUrl, releaseDate, totalTracks, genre, source } = body;

    if (!id || !name || !artist) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, artist" },
        { status: 400 }
      );
    }

    // Upsert album (create if doesn't exist, update if it does)
    const album = await prisma.album.upsert({
      where: { id: String(id) },
      update: {
        // Update metadata in case iTunes/MusicBrainz data improved
        name,
        artist,
        artworkUrl: artworkUrl || "",
        releaseDate: releaseDate || null,
        totalTracks: totalTracks ? parseInt(String(totalTracks)) : null,
        genre: genre || null,
        source: source || "unknown",
      },
      create: {
        id: String(id),
        name,
        artist,
        artworkUrl: artworkUrl || "",
        releaseDate: releaseDate || null,
        totalTracks: totalTracks ? parseInt(String(totalTracks)) : null,
        genre: genre || null,
        source: source || "unknown",
      },
    });

    return NextResponse.json({ album });
  } catch (error) {
    console.error("Album upsert error:", error);
    return NextResponse.json(
      { error: "Failed to upsert album" },
      { status: 500 }
    );
  }
}
