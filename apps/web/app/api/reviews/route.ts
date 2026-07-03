import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const FEED_INCLUDE = {
  user: true,
  likes: true,
  reposts: { include: { user: true } },
  notes: { orderBy: { createdAt: "asc" as const } },
  _count: { select: { likes: true, reposts: true } },
} as const;

/** Serialize a review row (with FEED_INCLUDE) into the client Review shape. */
function transformReview(review: any) {
  return {
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
    moment:
      review.momentSeconds !== null && review.momentSeconds !== undefined
        ? { seconds: review.momentSeconds, label: review.momentLabel || undefined }
        : undefined,
    notes: review.notes.map((note: any) => ({
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
}

/**
 * GET /api/reviews - Get a user's reviews or a feed.
 *
 * feed=discover  → community: everyone's recent (excludes your own) — never empty.
 * feed=home      → people you follow + your own, backfilled with community when sparse.
 * feed=friends   → legacy mutual-friends feed (kept for back-compat).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const feedType = searchParams.get("feed"); // friends | home | discover
    const reviewType = searchParams.get("type"); // "reposts" or "saved" or null

    if (feedType === "friends" || feedType === "home" || feedType === "discover") {
      // Discover is public; friends/home need a logged-in user.
      if (!currentUserId && feedType !== "discover") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const base = { albumReviewId: null as null }; // exclude per-track album rows
      let where: any;

      if (feedType === "discover") {
        where = { ...base, ...(currentUserId ? { userId: { not: currentUserId } } : {}) };
      } else if (feedType === "friends") {
        const friendships = await prisma.friendship.findMany({
          where: {
            OR: [
              { requesterId: currentUserId, status: "ACCEPTED" },
              { addresseeId: currentUserId, status: "ACCEPTED" },
            ],
          },
        });
        const friendIds = friendships.map((f) =>
          f.requesterId === currentUserId ? f.addresseeId : f.requesterId,
        );
        where = { ...base, userId: { in: friendIds } };
      } else {
        // home: people you follow + your own
        const follows = await prisma.follow.findMany({
          where: { followerId: currentUserId },
          select: { followingId: true },
        });
        const authorIds = [...follows.map((f) => f.followingId), currentUserId!];
        where = { ...base, userId: { in: authorIds } };
      }

      let reviews = await prisma.review.findMany({
        where,
        include: FEED_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Home backfill: a new user follows few people, so top up a sparse home
      // feed with recent community posts (deduped) — never an empty feed.
      if (feedType === "home" && reviews.length < 12) {
        const have = new Set(reviews.map((r) => r.id));
        const extra = await prisma.review.findMany({
          where: { albumReviewId: null, id: { notIn: [...have] } },
          include: FEED_INCLUDE,
          orderBy: { createdAt: "desc" },
          take: 24,
        });
        reviews = [...reviews, ...extra];
      }

      return NextResponse.json({ reviews: reviews.map(transformReview) });
    }

    // Reposts - reviews the current user has reposted
    if (reviewType === "reposts") {
      // ?userId=<them> → that user's reposts (public, shown on their profile).
      // No userId → the current user's own reposts (requires auth).
      const targetUserId = userId || currentUserId;
      if (!targetUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const reposts = await prisma.repost.findMany({
        where: { userId: targetUserId },
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

      const saves = await prisma.save.findMany({
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

      const transformedReviews = saves.map(({ review }) => ({
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

    // Validate required fields. Album + artwork are optional — singles/remixes
    // often have neither, and search sources (esp. MusicBrainz) may omit them.
    if (
      !trackId ||
      !trackName ||
      !trackArtist ||
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
        // Columns are non-null; default to '' when album/artwork are absent.
        trackAlbum: trackAlbum || '',
        artworkUrl: artworkUrl || '',
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
