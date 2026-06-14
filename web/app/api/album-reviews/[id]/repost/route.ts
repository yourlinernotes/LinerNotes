import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const { id } = await params;

    // Check if album review exists
    const albumReview = await prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      return NextResponse.json({ error: "Album review not found" }, { status: 404 });
    }

    // Check if already reposted
    const existingRepost = await prisma.albumRepost.findFirst({
      where: {
        albumReviewId: id,
        userId: currentUserId,
      },
    });

    if (existingRepost) {
      // Un-repost
      await prisma.albumRepost.delete({
        where: { id: existingRepost.id },
      });

      // Get updated count
      const repostCount = await prisma.albumRepost.count({
        where: { albumReviewId: id },
      });

      return NextResponse.json({ reposted: false, repostCount });
    } else {
      // Repost
      await prisma.albumRepost.create({
        data: {
          albumReviewId: id,
          userId: currentUserId,
        },
      });

      // Get updated count
      const repostCount = await prisma.albumRepost.count({
        where: { albumReviewId: id },
      });

      return NextResponse.json({ reposted: true, repostCount });
    }
  } catch (error) {
    console.error("Failed to toggle album repost:", error);
    return NextResponse.json(
      { error: "Failed to toggle repost" },
      { status: 500 }
    );
  }
}
