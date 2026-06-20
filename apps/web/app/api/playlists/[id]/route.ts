import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/playlists/[id] - Get a specific playlist
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const playlistId = params.id;

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
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
    });

    if (!playlist) {
      return NextResponse.json(
        { error: "Playlist not found" },
        { status: 404 }
      );
    }

    // Check if current user liked/reposted
    let likedByMe = false;
    let repostedByMe = false;

    if (session?.user?.id) {
      const [like, repost] = await Promise.all([
        prisma.playlistLike.findUnique({
          where: {
            userId_playlistId: {
              userId: session.user.id,
              playlistId: playlist.id,
            },
          },
        }),
        prisma.playlistRepost.findUnique({
          where: {
            userId_playlistId: {
              userId: session.user.id,
              playlistId: playlist.id,
            },
          },
        }),
      ]);

      likedByMe = !!like;
      repostedByMe = !!repost;
    }

    const formattedPlaylist = {
      id: playlist.id,
      userId: playlist.userId,
      title: playlist.title,
      description: playlist.description,
      user: playlist.user,
      tracks: playlist.tracks,
      likeCount: playlist._count.likes,
      repostCount: playlist._count.reposts,
      likedByMe,
      repostedByMe,
      createdAt: playlist.createdAt.toISOString(),
    };

    return NextResponse.json({ playlist: formattedPlaylist });
  } catch (error) {
    console.error("Failed to fetch playlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlist" },
      { status: 500 }
    );
  }
}
