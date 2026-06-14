import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/friends/[userId] - Send friend request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: addresseeId } = await params;

    // Can't friend yourself
    if (addresseeId === currentUserId) {
      return NextResponse.json(
        { error: "Cannot send friend request to yourself" },
        { status: 400 }
      );
    }

    // Check if user exists
    const addressee = await prisma.user.findUnique({
      where: { id: addresseeId },
    });

    if (!addressee) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if friendship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId },
          { requesterId: addresseeId, addresseeId: currentUserId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Friendship already exists or pending" },
        { status: 400 }
      );
    }

    // Create friend request
    const friendship = await prisma.friendship.create({
      data: {
        requesterId: currentUserId,
        addresseeId,
        status: "PENDING",
      },
      include: {
        addressee: true,
      },
    });

    return NextResponse.json({ friendship }, { status: 201 });
  } catch (error) {
    console.error("Send friend request error:", error);
    return NextResponse.json(
      { error: "Failed to send friend request" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/friends/[userId] - Accept/reject friend request
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: requesterId } = await params;
    const body = await request.json();
    const { action } = body; // "accept" or "reject"

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Find the friend request
    const friendship = await prisma.friendship.findFirst({
      where: {
        requesterId,
        addresseeId: currentUserId,
        status: "PENDING",
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Update status
    const updated = await prisma.friendship.update({
      where: { id: friendship.id },
      data: {
        status: action === "accept" ? "ACCEPTED" : "REJECTED",
      },
      include: {
        requester: true,
      },
    });

    return NextResponse.json({ friendship: updated });
  } catch (error) {
    console.error("Update friend request error:", error);
    return NextResponse.json(
      { error: "Failed to update friend request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/friends/[userId] - Remove friend
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: friendId } = await params;

    // Find the friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: currentUserId },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    // Delete friendship
    await prisma.friendship.delete({
      where: { id: friendship.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove friend error:", error);
    return NextResponse.json(
      { error: "Failed to remove friend" },
      { status: 500 }
    );
  }
}
