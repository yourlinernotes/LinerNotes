import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

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

    const { id } = await params;

    // Check if album review exists
    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await prisma.albumLike.findFirst({
      where: {
        albumReviewId: id,
        userId: currentUserId,
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.albumLike.delete({
        where: { id: existingLike.id },
      });

      // Get updated count
      const likeCount = await prisma.albumLike.count({
        where: { albumReviewId: id },
      });

      return NextResponse.json({ liked: false, likeCount });
    } else {
      // Like
      await prisma.albumLike.create({
        data: {
          albumReviewId: id,
          userId: currentUserId,
        },
      });

      // Get updated count
      const likeCount = await prisma.albumLike.count({
        where: { albumReviewId: id },
      });

      return NextResponse.json({ liked: true, likeCount });
    }
  } catch (error) {
    console.error("Failed to toggle album like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}
