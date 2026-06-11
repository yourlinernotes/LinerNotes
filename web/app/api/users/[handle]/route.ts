import { NextRequest, NextResponse } from "next/server";
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

    return NextResponse.json({
      user: {
        ...user,
        friendCount,
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
