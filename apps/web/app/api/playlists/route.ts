import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playlists - Get user's playlists or all public playlists
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const where = userId ? { userId } : {};

    const playlists = await prisma.playlist.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        tracks: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            likes: true,
            reposts: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Format response
    const formattedPlaylists = playlists.map((p) => ({
      id: p.id,
      userId: p.userId,
      title: p.title,
      description: p.description,
      user: p.user,
      tracks: p.tracks,
      likeCount: p._count.likes,
      repostCount: p._count.reposts,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ playlists: formattedPlaylists });
  } catch (error) {
    console.error("Failed to fetch playlists:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playlists - Create a new playlist
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { title, description, tracks } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "At least one track is required" },
        { status: 400 }
      );
    }

    // Create playlist with tracks
    const playlist = await prisma.playlist.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        tracks: {
          create: tracks.map((track: any, index: number) => ({
            trackId: track.trackId,
            name: track.name,
            artist: track.artist,
            album: track.album || null,
            artworkUrl: track.artworkUrl || null,
            note: track.note?.trim() || null,
            order: index,
          })),
        },
      },
      include: {
        tracks: {
          orderBy: { order: "asc" },
        },
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ playlist }, { status: 201 });
  } catch (error) {
    console.error("Failed to create playlist:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
