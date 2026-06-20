import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reviews - Get user's reviews or friends' feed
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const feedType = searchParams.get("feed"); // "friends" or null
    const reviewType = searchParams.get("type"); // "reposts" or "saved" or null

    // Friends feed requires authentication
    if (feedType === "friends") {
      if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Get reviews from accepted friends
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: currentUserId, status: "ACCEPTED" },
            { addresseeId: currentUserId, status: "ACCEPTED" },
          ],
        },
      });

      const friendIds = friendships.map((f) =>
        f.requesterId === currentUserId ? f.addresseeId : f.requesterId
      );

      const reviews = await prisma.review.findMany({
        where: {
          userId: { in: friendIds },
          albumReviewId: null, // exclude per-track reviews that belong to an album
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
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Reposts - reviews the current user has reposted
    if (reviewType === "reposts") {
      if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const reposts = await prisma.repost.findMany({
        where: { userId: currentUserId },
        include: {
          review: {
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
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const transformedReviews = reposts.map(({ review }) => ({
        id: review.id,
        userId: review.userId,
        user: review.user,
        trackId: review.trackId,
        trackName: review.trackName,
        trackArtist: review.trackArtist,
        trackAlbum: review.trackAlbum,
        artworkUrl: review.artworkUrl,
        previewUrl: review.previewUrl || undefined,
        rating: review.rating,
        take: review.take || undefined,
        momentSeconds: review.momentSeconds || undefined,
        momentLabel: review.momentLabel || undefined,
        notes: review.notes.map((note) => ({
          seconds: note.seconds,
          label: note.label,
          note: note.note || undefined,
        })),
        featuredNoteId: review.featuredNoteId || undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Saved reviews - reviews the current user has saved
    if (reviewType === "saved") {
      if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // For now, return empty array as Save model doesn't exist in schema yet
      // TODO: Add Save model to Prisma schema
      console.log("Saved reviews requested but Save model not implemented yet");
      return NextResponse.json({ reviews: [] });
    }

    // Get specific user's reviews (public, no auth required if userId provided)
    if (userId) {
      const reviews = await prisma.review.findMany({
        where: { userId, albumReviewId: null }, // exclude per-track reviews within an album
        include: {
          user: true,
          likes: true,
          reposts: true,
          notes: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { likes: true, reposts: true },
          },
        },
        orderBy: { createdAt: "desc" },
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
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Get current user's reviews (requires auth)
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviews = await prisma.review.findMany({
      where: { userId: currentUserId, albumReviewId: null }, // exclude per-track reviews within an album
      include: {
        user: true,
        likes: true,
        reposts: true,
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { likes: true, reposts: true },
        },
      },
      orderBy: { createdAt: "desc" },
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
    }));

    return NextResponse.json({ reviews: transformedReviews });
  } catch (error) {
    console.error("Get reviews error:", error);
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
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      trackId,
      trackName,
      trackArtist,
      trackAlbum,
      artworkUrl,
      previewUrl,
      rating,
      take,
      momentSeconds, // DEPRECATED: for backward compatibility
      momentLabel,   // DEPRECATED: for backward compatibility
      notes,         // Array of { seconds, label, note? }
    } = body;

    // Validate required fields
    if (
      !trackId ||
      !trackName ||
      !trackArtist ||
      !trackAlbum ||
      !artworkUrl ||
      rating === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 0.5 || rating > 5.0) {
      return NextResponse.json(
        { error: "Rating must be between 0.5 and 5.0" },
        { status: 400 }
      );
    }

    // Create review with notes
    const review = await prisma.review.create({
      data: {
        userId: currentUserId,
        trackId,
        trackName,
        trackArtist,
        trackAlbum,
        artworkUrl,
        previewUrl,
        rating,
        take: take || null,
        // Keep deprecated fields for backward compatibility
        momentSeconds: momentSeconds ?? null,
        momentLabel: momentLabel ?? null,
        // Create notes if provided
        notes: notes && notes.length > 0 ? {
          create: notes.map((note: any) => ({
            seconds: note.seconds,
            label: note.label,
            note: note.note || null,
          })),
        } : undefined,
      },
      include: {
        user: true,
        notes: true,
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    // If notes were created, set the first one as featured by default
    if (review.notes && review.notes.length > 0 && !review.featuredNoteId) {
      await prisma.review.update({
        where: { id: review.id },
        data: { featuredNoteId: review.notes[0].id },
      });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
