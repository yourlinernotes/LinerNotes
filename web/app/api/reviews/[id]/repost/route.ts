import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reviews/[id]/repost - Toggle repost on a review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reviewId } = await params;

    // Check if review exists
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Can't repost your own review
    if (review.userId === currentUserId) {
      return NextResponse.json(
        { error: "Cannot repost your own review" },
        { status: 400 }
      );
    }

    // Check if already reposted
    const existingRepost = await prisma.repost.findUnique({
      where: {
        userId_reviewId: {
          userId: currentUserId,
          reviewId,
        },
      },
    });

    if (existingRepost) {
      // Unrepost
      await prisma.repost.delete({
        where: { id: existingRepost.id },
      });

      const repostCount = await prisma.repost.count({
        where: { reviewId },
      });

      return NextResponse.json({
        reposted: false,
        repostCount,
      });
    } else {
      // Repost
      await prisma.repost.create({
        data: {
          userId: currentUserId,
          reviewId,
        },
      });

      const repostCount = await prisma.repost.count({
        where: { reviewId },
      });

      return NextResponse.json({
        reposted: true,
        repostCount,
      });
    }
  } catch (error) {
    console.error("Repost toggle error:", error);
    return NextResponse.json(
      { error: "Failed to toggle repost" },
      { status: 500 }
    );
  }
}
