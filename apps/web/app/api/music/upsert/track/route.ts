import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/music/upsert/track - Upsert track metadata into database
 * Called automatically when creating a review to ensure track exists
 * Public endpoint (no auth required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, name, artist, album, artworkUrl, previewUrl, duration, releaseDate, genre, source } = body;

    if (!id || !name || !artist) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, artist" },
        { status: 400 }
      );
    }

    // Upsert track (create if doesn't exist, update if it does)
    const track = await prisma.track.upsert({
      where: { id: String(id) },
      update: {
        // Update metadata in case iTunes/MusicBrainz data improved
        name,
        artist,
        album: album || "",
        artworkUrl: artworkUrl || "",
        previewUrl: previewUrl || null,
        duration: duration ? parseInt(String(duration)) : null,
        releaseDate: releaseDate || null,
        genre: genre || null,
        source: source || "unknown",
      },
      create: {
        id: String(id),
        name,
        artist,
        album: album || "",
        artworkUrl: artworkUrl || "",
        previewUrl: previewUrl || null,
        duration: duration ? parseInt(String(duration)) : null,
        releaseDate: releaseDate || null,
        genre: genre || null,
        source: source || "unknown",
      },
    });

    return NextResponse.json({ track });
  } catch (error) {
    console.error("Track upsert error:", error);
    return NextResponse.json(
      { error: "Failed to upsert track" },
      { status: 500 }
    );
  }
}
