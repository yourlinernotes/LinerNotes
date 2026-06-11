import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/friends - Get friends and friend requests
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type"); // "requests", "sent", or null (all friends)

    if (type === "requests") {
      // Get pending friend requests received
      const requests = await prisma.friendship.findMany({
        where: {
          addresseeId: session.userId,
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
          requesterId: session.userId,
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
          { requesterId: session.userId, status: "ACCEPTED" },
          { addresseeId: session.userId, status: "ACCEPTED" },
        ],
      },
      include: {
        requester: true,
        addressee: true,
      },
    });

    const friends = friendships.map((f) =>
      f.requesterId === session.userId ? f.addressee : f.requester
    );

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Get friends error:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  }
}
