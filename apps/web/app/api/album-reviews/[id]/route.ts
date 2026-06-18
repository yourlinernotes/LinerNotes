import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/album-reviews/[id] - Get a single album review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
      include: {
        user: true,
        trackReviews: {
          include: {
            notes: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { trackNumber: 'asc' },
        },
        likes: true,
        reposts: true,
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    // Transform to match expected types
    const transformedAlbumReview = {
      id: albumReview.id,
      userId: albumReview.userId,
      user: albumReview.user,
      album: {
        albumId: albumReview.albumId,
        name: albumReview.albumName,
        artist: albumReview.albumArtist,
        artworkUrl: albumReview.artworkUrl,
        releaseDate: albumReview.releaseDate || undefined,
        totalTracks: albumReview.totalTracks || undefined,
      },
      overallRating: albumReview.overallRating || undefined,
      take: albumReview.take || undefined,
      trackReviews: albumReview.trackReviews.map(review => ({
        id: review.id,
        userId: review.userId,
        track: {
          trackId: review.trackId,
          name: review.trackName,
          artist: review.trackArtist,
          album: review.trackAlbum,
          artworkUrl: review.artworkUrl,
          previewUrl: review.previewUrl || undefined,
        },
        rating: review.rating,
        take: review.take || undefined,
        reaction: review.reaction || undefined,
        trackNumber: review.trackNumber || undefined,
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
      })),
      createdAt: albumReview.createdAt.toISOString(),
      likeCount: albumReview._count.likes,
      repostCount: albumReview._count.reposts,
    };

    return NextResponse.json({ albumReview: transformedAlbumReview });
  } catch (error) {
    console.error("Get album review error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album review" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/album-reviews/[id] - Update an album review
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { overallRating, take } = body;

    // Check if album review exists and belongs to user
    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    if (albumReview.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate overall rating if provided
    if (overallRating !== undefined && overallRating !== null && (overallRating < 0.5 || overallRating > 5.0)) {
      return NextResponse.json(
        { error: "Overall rating must be between 0.5 and 5.0" },
        { status: 400 }
      );
    }

    // Update album review
    const updatedAlbumReview = await prisma.albumReview.update({
      where: { id },
      data: {
        overallRating: overallRating ?? albumReview.overallRating,
        take: take !== undefined ? take : albumReview.take,
      },
      include: {
        user: true,
        trackReviews: {
          include: {
            notes: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { trackNumber: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    // Transform to match expected types
    const transformedAlbumReview = {
      id: updatedAlbumReview.id,
      userId: updatedAlbumReview.userId,
      user: updatedAlbumReview.user,
      album: {
        albumId: updatedAlbumReview.albumId,
        name: updatedAlbumReview.albumName,
        artist: updatedAlbumReview.albumArtist,
        artworkUrl: updatedAlbumReview.artworkUrl,
        releaseDate: updatedAlbumReview.releaseDate || undefined,
        totalTracks: updatedAlbumReview.totalTracks || undefined,
      },
      overallRating: updatedAlbumReview.overallRating || undefined,
      take: updatedAlbumReview.take || undefined,
      trackReviews: updatedAlbumReview.trackReviews.map(review => ({
        id: review.id,
        userId: review.userId,
        track: {
          trackId: review.trackId,
          name: review.trackName,
          artist: review.trackArtist,
          album: review.trackAlbum,
          artworkUrl: review.artworkUrl,
          previewUrl: review.previewUrl || undefined,
        },
        rating: review.rating,
        take: review.take || undefined,
        reaction: review.reaction || undefined,
        trackNumber: review.trackNumber || undefined,
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
          createdAt: note.createdAt.toISOString(),
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
      })),
      createdAt: updatedAlbumReview.createdAt.toISOString(),
      likeCount: updatedAlbumReview._count.likes,
      repostCount: updatedAlbumReview._count.reposts,
    };

    return NextResponse.json({ albumReview: transformedAlbumReview });
  } catch (error) {
    console.error("Update album review error:", error);
    return NextResponse.json(
      { error: "Failed to update album review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/album-reviews/[id] - Delete an album review
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if album review exists and belongs to user
    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    if (albumReview.userId !== currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete album review (track reviews, likes, and reposts will cascade)
    await prisma.albumReview.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete album review error:", error);
    return NextResponse.json(
      { error: "Failed to delete album review" },
      { status: 500 }
    );
  }
}
