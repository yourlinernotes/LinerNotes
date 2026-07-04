import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/suggestions?limit=8
 *
 * People worth following — active reviewers ordered by followers, excluding
 * yourself and anyone you already follow. Powers the onboarding follow step and
 * the low-follow rail in the feed (the cold-start fix: a fresh account should
 * always have people to follow so the feed fills).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 8));

    const session = await getAuthSession();
    const meId = session?.user?.id;

    let excludeIds: string[] = [];
    if (meId) {
      const following = await prisma.follow.findMany({
        where: { followerId: meId },
        select: { followingId: true },
      });
      excludeIds = [meId, ...following.map((f) => f.followingId)];
    }

    const users = await prisma.user.findMany({
      where: {
        id: excludeIds.length ? { notIn: excludeIds } : undefined,
        handle: { not: null },
        visibility: "PUBLIC", // never suggest PRIVATE accounts
        reviews: { some: {} }, // only people who've actually posted
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        _count: { select: { followers: true, reviews: true } },
      },
      orderBy: [{ followers: { _count: "desc" } }, { reviews: { _count: "desc" } }],
      take: limit,
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        followerCount: u._count.followers,
        reviewCount: u._count.reviews,
      })),
    });
  } catch (error) {
    console.error("[users/suggestions] error:", error);
    return NextResponse.json({ users: [] });
  }
}
