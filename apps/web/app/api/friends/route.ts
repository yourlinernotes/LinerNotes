import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/friends - Get friends and friend requests
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type"); // "requests", "sent", or null (all friends)

    if (type === "requests") {
      // Get pending friend requests received
      const requests = await prisma.friendship.findMany({
        where: {
          addresseeId: user.id,
          status: "PENDING",
        },
        include: {
          requester: true,
        },
      });

      return NextResponse.json({ requests });
    }

    if (type === "sent") {
      // Get pending friend requests sent
      const requests = await prisma.friendship.findMany({
        where: {
          requesterId: user.id,
          status: "PENDING",
        },
        include: {
          addressee: true,
        },
      });

      return NextResponse.json({ requests });
    }

    // Get accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: user.id, status: "ACCEPTED" },
          { addresseeId: user.id, status: "ACCEPTED" },
        ],
      },
      include: {
        requester: true,
        addressee: true,
      },
    });

    const friends = friendships.map((f) =>
      f.requesterId === user.id ? f.addressee : f.requester
    );

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Get friends error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  }
}
