import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reviews/[id] - Get a single review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        likes: true,
        reposts: {
          include: { user: true },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Transform to match expected types
    const transformedReview = {
      id: review.id,
      userId: review.userId,
      user: review.user,
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
      moment: review.momentSeconds !== null && review.momentSeconds !== undefined ? {
        seconds: review.momentSeconds,
        label: review.momentLabel || undefined,
      } : undefined,
      notes: review.notes.map(note => ({
        id: note.id,
        seconds: note.seconds,
        label: note.label,
        note: note.note || undefined,
        createdAt: note.createdAt.toISOString(),
      })),
      featuredNoteId: review.featuredNoteId || undefined,
      createdAt: review.createdAt.toISOString(),
      likeCount: review._count.likes,
      repostCount: review._count.reposts,
    };

    return NextResponse.json({ review: transformedReview });
  } catch (error) {
    console.error("Get review error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reviews/[id] - Update a review (e.g., set featured note)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { featuredNoteId } = body;

    // Check if review exists and belongs to user
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        notes: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate that the note belongs to this review
    if (featuredNoteId !== null && featuredNoteId !== undefined) {
      const noteExists = review.notes.some(n => n.id === featuredNoteId);
      if (!noteExists) {
        return NextResponse.json(
          { error: "Note not found in this review" },
          { status: 400 }
        );
      }
    }

    // Update review
    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        featuredNoteId: featuredNoteId || null,
      },
      include: {
        user: true,
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    // Transform to match expected types
    const transformedReview = {
      id: updatedReview.id,
      userId: updatedReview.userId,
      user: updatedReview.user,
      track: {
        trackId: updatedReview.trackId,
        name: updatedReview.trackName,
        artist: updatedReview.trackArtist,
        album: updatedReview.trackAlbum,
        artworkUrl: updatedReview.artworkUrl,
        previewUrl: updatedReview.previewUrl || undefined,
      },
      rating: updatedReview.rating,
      take: updatedReview.take || undefined,
      notes: updatedReview.notes.map(note => ({
        id: note.id,
        seconds: note.seconds,
        label: note.label,
        note: note.note || undefined,
        createdAt: note.createdAt.toISOString(),
      })),
      featuredNoteId: updatedReview.featuredNoteId || undefined,
      createdAt: updatedReview.createdAt.toISOString(),
      likeCount: updatedReview._count.likes,
      repostCount: updatedReview._count.reposts,
    };

    return NextResponse.json({ review: transformedReview });
  } catch (error) {
    console.error("Update review error:", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews/[id] - Delete a review
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if review exists and belongs to user
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete review (likes and reposts will cascade)
    await prisma.review.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete review error:", error);
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 }
    );
  }
}
