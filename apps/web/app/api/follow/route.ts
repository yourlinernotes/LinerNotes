import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * Asymmetric follow (no approval), distinct from mutual Friendship.
 *
 * POST   /api/follow   { userId }  → current user follows userId
 * DELETE /api/follow   { userId }  → unfollow
 * GET    /api/follow?userId=<id>   → { isFollowing, followerCount, followingCount }
 */
export async function POST(request: Request) {
  try {
    const me = await requireAuth();
    const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (userId === me.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: userId } },
      create: { followerId: me.id, followingId: userId },
      update: {},
    });
    return NextResponse.json({ isFollowing: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[follow] POST error:", error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const me = await requireAuth();
    const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    await prisma.follow
      .delete({ where: { followerId_followingId: { followerId: me.id, followingId: userId } } })
      .catch(() => {});
    return NextResponse.json({ isFollowing: false });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[follow] DELETE error:", error);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = (searchParams.get("userId") || "").trim();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    // Whether the current viewer (if any) follows this user.
    let isFollowing = false;
    try {
      const me = await requireAuth();
      if (me.id !== userId) {
        isFollowing = !!(await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: me.id, followingId: userId } },
        }));
      }
    } catch {
      /* logged-out viewer — isFollowing stays false */
    }

    return NextResponse.json({ isFollowing, followerCount, followingCount });
  } catch (error) {
    console.error("[follow] GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
