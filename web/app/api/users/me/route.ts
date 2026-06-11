import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/me - Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/me - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, bio, avatarUrl } = body;

    // Validate input
    if (displayName !== undefined && (typeof displayName !== "string" || displayName.trim().length === 0)) {
      return NextResponse.json(
        { error: "Display name must be a non-empty string" },
        { status: 400 }
      );
    }

    if (bio !== undefined && typeof bio !== "string") {
      return NextResponse.json(
        { error: "Bio must be a string" },
        { status: 400 }
      );
    }

    if (avatarUrl !== undefined && typeof avatarUrl !== "string") {
      return NextResponse.json(
        { error: "Avatar URL must be a string" },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(displayName !== undefined && { displayName: displayName.trim() }),
        ...(bio !== undefined && { bio: bio.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl.trim() || null }),
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        email: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
