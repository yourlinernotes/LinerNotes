import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reviews/[id]/save - Toggle save on a review
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

    // Check if already saved
    const existingSave = await prisma.save.findUnique({
      where: {
        userId_reviewId: {
          userId: currentUserId,
          reviewId,
        },
      },
    });

    if (existingSave) {
      // Unsave
      await prisma.save.delete({
        where: { id: existingSave.id },
      });

      const saveCount = await prisma.save.count({
        where: { reviewId },
      });

      return NextResponse.json({
        saved: false,
        saveCount,
      });
    } else {
      // Save
      await prisma.save.create({
        data: {
          userId: currentUserId,
          reviewId,
        },
      });

      const saveCount = await prisma.save.count({
        where: { reviewId },
      });

      return NextResponse.json({
        saved: true,
        saveCount,
      });
    }
  } catch (error) {
    console.error("Save toggle error:", error);
    return NextResponse.json({ error: "Failed to toggle save" }, { status: 500 });
  }
}
