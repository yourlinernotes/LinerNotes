import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { canViewPrivateUser } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/[handle] - Get user by handle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    const user = await prisma.user.findUnique({
      where: { handle },
      // Omit favourites from the main read so a missing column (migration not yet
      // applied) can't 500 the profile; it's fetched best-effort below.
      omit: { favourites: true },
      include: {
        _count: {
          select: {
            reviews: true,
            friendRequestsSent: {
              where: { status: "ACCEPTED" },
            },
            friendRequestsReceived: {
              where: { status: "ACCEPTED" },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate total friends (both directions)
    const friendCount =
      user._count.friendRequestsSent + user._count.friendRequestsReceived;

    // Privacy gate: a PRIVATE account is only fully visible to the owner or an
    // accepted friend. Everyone else gets a minimal "locked" profile (enough to
    // render the private state + a friend-request CTA) with no reviews/bio/favs.
    const session = await getAuthSession();
    const viewerId = session?.user?.id;
    const locked =
      user.visibility === "PRIVATE" &&
      !(await canViewPrivateUser(viewerId, user.id));

    if (locked) {
      return NextResponse.json({
        user: {
          id: user.id,
          handle: user.handle,
          displayName: user.displayName,
          name: user.name,
          avatarUrl: user.avatarUrl,
          image: user.image,
          visibility: user.visibility,
          friendCount,
          locked: true,
        },
      });
    }

    let favourites: string | null = null;
    try {
      const f = await prisma.user.findUnique({ where: { handle }, select: { favourites: true } });
      favourites = f?.favourites ?? null;
    } catch {
      /* favourites column may not exist yet */
    }

    return NextResponse.json({
      user: {
        ...user,
        favourites,
        friendCount,
        locked: false,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
