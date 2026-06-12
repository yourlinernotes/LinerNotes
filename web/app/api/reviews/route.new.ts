import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * Example of updated API route using NextAuth session
 * Replace the old route.ts with this pattern
 */

/**
 * GET /api/reviews - Get user's reviews or friends' feed
 */
export async function GET(request: NextRequest) {
  try {
    // NEW: Get session using NextAuth
    const session = await getSession();

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const feedType = searchParams.get("feed"); // "friends" or null

    // Friends feed requires authentication
    if (feedType === "friends") {
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Get reviews from accepted friends
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: session.user.id, status: "ACCEPTED" },
            { addresseeId: session.user.id, status: "ACCEPTED" },
          ],
        },
      });

      const friendIds = friendships.map((f) =>
        f.requesterId === session.user.id ? f.addresseeId : f.requesterId
      );

      const reviews = await prisma.review.findMany({
        where: {
          userId: { in: friendIds },
        },
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
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Transform to match expected types
      const transformedReviews = reviews.map((review) => ({
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
        notes: review.notes.map(note => ({
          id: note.id,
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        reaction: review.reaction || undefined,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        _count: review._count,
        // Check if current user liked/reposted
        isLiked: session ? review.likes.some(like => like.userId === session.user.id) : false,
        isReposted: session ? review.reposts.some(repost => repost.userId === session.user.id) : false,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // ... rest of the function remains the same
    return NextResponse.json({ reviews: [] });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews - Create a new review
 */
export async function POST(request: NextRequest) {
  try {
    // NEW: Get session and require auth
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      track,
      rating,
      take,
      notes,
      featuredNoteId,
      reaction,
      albumReviewId,
    } = body;

    // Validate required fields
    if (!track || !rating) {
      return NextResponse.json(
        { error: "Track and rating are required" },
        { status: 400 }
      );
    }

    // Create review with notes
    const review = await prisma.review.create({
      data: {
        userId: session.user.id, // NEW: Use session.user.id
        trackId: track.trackId,
        trackName: track.name,
        trackArtist: track.artist,
        trackAlbum: track.album,
        artworkUrl: track.artworkUrl,
        previewUrl: track.previewUrl,
        rating,
        take,
        reaction,
        featuredNoteId,
        albumReviewId,
        notes: notes ? {
          create: notes.map((note: any) => ({
            seconds: note.seconds,
            label: note.label,
            note: note.note,
          })),
        } : undefined,
      },
      include: {
        user: true,
        notes: true,
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
