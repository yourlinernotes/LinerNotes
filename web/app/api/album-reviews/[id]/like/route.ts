import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
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
        userId: session.userId,
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
          userId: session.userId,
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
