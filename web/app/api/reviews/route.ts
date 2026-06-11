import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reviews - Get user's reviews or friends' feed
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const feedType = searchParams.get("feed"); // "friends" or null

    // Friends feed requires authentication
    if (feedType === "friends") {
      if (!session.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Get reviews from accepted friends
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: session.userId, status: "ACCEPTED" },
            { addresseeId: session.userId, status: "ACCEPTED" },
          ],
        },
      });

      const friendIds = friendships.map((f) =>
        f.requesterId === session.userId ? f.addresseeId : f.requesterId
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
        moment: review.momentSeconds ? {
          seconds: review.momentSeconds,
          label: review.momentLabel || undefined,
        } : undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Get specific user's reviews (public, no auth required if userId provided)
    if (userId) {
      const reviews = await prisma.review.findMany({
        where: { userId },
        include: {
          user: true,
          likes: true,
          reposts: true,
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
        moment: review.momentSeconds ? {
          seconds: review.momentSeconds,
          label: review.momentLabel || undefined,
        } : undefined,
        createdAt: review.createdAt.toISOString(),
        likeCount: review._count.likes,
        repostCount: review._count.reposts,
      }));

      return NextResponse.json({ reviews: transformedReviews });
    }

    // Get current user's reviews (requires auth)
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviews = await prisma.review.findMany({
      where: { userId: session.userId },
      include: {
        user: true,
        likes: true,
        reposts: true,
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
      moment: review.momentSeconds ? {
        seconds: review.momentSeconds,
        label: review.momentLabel || undefined,
      } : undefined,
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
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
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
      momentSeconds,
      momentLabel,
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

    const review = await prisma.review.create({
      data: {
        userId: session.userId,
        trackId,
        trackName,
        trackArtist,
        trackAlbum,
        artworkUrl,
        previewUrl,
        rating,
        take: take || null,
        momentSeconds: momentSeconds || null,
        momentLabel: momentLabel || null,
      },
      include: {
        user: true,
        _count: {
          select: { likes: true, reposts: true },
        },
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
