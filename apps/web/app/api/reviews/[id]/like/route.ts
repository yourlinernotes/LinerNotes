import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reviews/[id]/like - Toggle like on a review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
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

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_reviewId: {
          userId: currentUserId,
          reviewId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id },
      });

      const likeCount = await prisma.like.count({
        where: { reviewId },
      });

      return NextResponse.json({
        liked: false,
        likeCount,
      });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId: currentUserId,
          reviewId,
        },
      });

      const likeCount = await prisma.like.count({
        where: { reviewId },
      });

      return NextResponse.json({
        liked: true,
        likeCount,
      });
    }
  } catch (error) {
    console.error("Like toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
