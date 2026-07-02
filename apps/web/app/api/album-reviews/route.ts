import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/album-reviews - Get album reviews
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const currentUserId = session?.user?.id;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const feed = searchParams.get("feed");

    // Feed: friends (legacy) | home (followed + own, backfilled) | discover (community)
    if (feed === "friends" || feed === "home" || feed === "discover") {
      if (!currentUserId && feed !== "discover") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const albumInclude = {
        user: true,
        trackReviews: {
          include: { notes: { orderBy: { createdAt: "asc" as const } } },
          orderBy: { trackNumber: "asc" as const },
        },
        likes: { where: { userId: currentUserId } },
        reposts: { include: { user: true } },
        _count: { select: { likes: true, reposts: true } },
      };

      let where: any;
      if (feed === "discover") {
        where = currentUserId ? { userId: { not: currentUserId } } : {};
      } else if (feed === "friends") {
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
        where = { userId: { in: [currentUserId, ...friendIds] } };
      } else {
        const follows = await prisma.follow.findMany({
          where: { followerId: currentUserId },
          select: { followingId: true },
        });
        where = { userId: { in: [currentUserId!, ...follows.map((f) => f.followingId)] } };
      }

      let albumReviews = await prisma.albumReview.findMany({
        where,
        include: albumInclude,
        orderBy: { createdAt: "desc" },
      });

      // Home backfill: top up a sparse home feed with recent community albums.
      if (feed === "home" && albumReviews.length < 6) {
        const have = new Set(albumReviews.map((a) => a.id));
        const extra = await prisma.albumReview.findMany({
          where: { id: { notIn: [...have] } },
          include: albumInclude,
          orderBy: { createdAt: "desc" },
          take: 12,
        });
        albumReviews = [...albumReviews, ...extra];
      }

      const transformedAlbumReviews = albumReviews.map((albumReview) => ({
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
        likedByMe: albumReview.likes.length > 0,
        repostedByMe: albumReview.reposts.some(r => r.userId === currentUserId),
        reposts: albumReview.reposts.map(r => ({
          id: r.id,
          user: r.user,
          createdAt: r.createdAt.toISOString(),
        })),
      }));

      return NextResponse.json({ albumReviews: transformedAlbumReviews });
    }

    // Get specific user's album reviews (public)
    if (userId) {
      const albumReviews = await prisma.albumReview.findMany({
        where: { userId },
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
        orderBy: { createdAt: "desc" },
      });

      // Transform to match expected types
      const transformedAlbumReviews = albumReviews.map((albumReview) => ({
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
      }));

      return NextResponse.json({ albumReviews: transformedAlbumReviews });
    }

    // Get current user's album reviews (requires auth)
    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const albumReviews = await prisma.albumReview.findMany({
      where: { userId: currentUserId },
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
      orderBy: { createdAt: "desc" },
    });

    // Transform (same as above)
    const transformedAlbumReviews = albumReviews.map((albumReview) => ({
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
    }));

    return NextResponse.json({ albumReviews: transformedAlbumReviews });
  } catch (error) {
    console.error("Get album reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album reviews" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/album-reviews - Create a new album review
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
      albumId,
      albumName,
      albumArtist,
      artworkUrl,
      releaseDate,
      totalTracks,
      overallRating,
      take,
      trackReviews, // Array of { trackId, trackName, trackArtist, artworkUrl, previewUrl, rating, take?, reaction?, trackNumber, notes? }
    } = body;

    // Validate required fields
    if (!albumId || !albumName || !albumArtist || !artworkUrl) {
      return NextResponse.json(
        { error: "Missing required album fields" },
        { status: 400 }
      );
    }

    // Validate overall rating if provided
    if (overallRating !== undefined && (overallRating < 0.5 || overallRating > 5.0)) {
      return NextResponse.json(
        { error: "Overall rating must be between 0.5 and 5.0" },
        { status: 400 }
      );
    }

    // Create album review with track reviews
    const albumReview = await prisma.albumReview.create({
      data: {
        userId: currentUserId,
        albumId,
        albumName,
        albumArtist,
        artworkUrl,
        releaseDate,
        totalTracks,
        overallRating: overallRating ?? null,
        take: take || null,
        trackReviews: trackReviews && trackReviews.length > 0 ? {
          create: trackReviews.map((tr: any) => ({
            userId: currentUserId,
            trackId: tr.trackId,
            trackName: tr.trackName,
            trackArtist: tr.trackArtist,
            trackAlbum: albumName,
            artworkUrl: tr.artworkUrl || artworkUrl,
            previewUrl: tr.previewUrl || null,
            rating: tr.rating,
            take: tr.take || null,
            reaction: tr.reaction || null,
            trackNumber: tr.trackNumber,
            notes: tr.notes && tr.notes.length > 0 ? {
              create: tr.notes.map((note: any) => ({
                seconds: note.seconds,
                label: note.label,
                note: note.note || null,
              })),
            } : undefined,
          })),
        } : undefined,
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

    // Auto-calculate overall rating if not provided and we have track reviews
    if (!overallRating && albumReview.trackReviews.length > 0) {
      const avgRating = albumReview.trackReviews.reduce((sum, tr) => sum + tr.rating, 0) / albumReview.trackReviews.length;
      await prisma.albumReview.update({
        where: { id: albumReview.id },
        data: { overallRating: Math.round(avgRating * 2) / 2 }, // Round to nearest 0.5
      });
    }

    // Set featured note for first track review if it has notes
    if (albumReview.trackReviews.length > 0) {
      for (const trackReview of albumReview.trackReviews) {
        if (trackReview.notes && trackReview.notes.length > 0 && !trackReview.featuredNoteId) {
          await prisma.review.update({
            where: { id: trackReview.id },
            data: { featuredNoteId: trackReview.notes[0].id },
          });
        }
      }
    }

    return NextResponse.json({ albumReview }, { status: 201 });
  } catch (error) {
    console.error("Create album review error:", error);
    return NextResponse.json(
      { error: "Failed to create album review" },
      { status: 500 }
    );
  }
}
