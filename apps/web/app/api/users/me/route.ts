import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/me - Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        favourites: true,
        email: true,
        createdAt: true,
      },
    });

    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: fullUser });
  } catch (error) {
    console.error("Get current user error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const user = await requireAuth();

    const body = await request.json();
    const { displayName, bio, avatarUrl, handle, favourites } = body;

    // Favourites: self-contained album/track metadata (NOT review references),
    // so picks made before anything is rated — e.g. the mobile onboarding Top-4
    // chosen from search — persist and display. Shared shape with mobile, which
    // sends `{ albums: [{ id, name, artist, artworkUrl }] }`.
    // Stored as JSON: { albums: Meta[], tracks: Meta[] } (≤4 each).
    let favouritesJson: string | undefined;
    if (favourites !== undefined) {
      const sanitize = (arr: unknown) =>
        (Array.isArray(arr) ? arr : [])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((x) => ({
            id: String(x.id ?? ""),
            name: String(x.name ?? x.title ?? ""),
            artist: String(x.artist ?? ""),
            artworkUrl: x.artworkUrl ? String(x.artworkUrl) : "",
          }))
          .filter((m) => m.name)
          .slice(0, 4);
      const f = (favourites ?? {}) as { albums?: unknown; tracks?: unknown };
      favouritesJson = JSON.stringify({ albums: sanitize(f.albums), tracks: sanitize(f.tracks) });
    }

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

    if (handle !== undefined) {
      if (typeof handle !== "string" || handle.trim().length === 0) {
        return NextResponse.json(
          { error: "Handle must be a non-empty string" },
          { status: 400 }
        );
      }

      const trimmedHandle = handle.trim().toLowerCase();

      // Validate handle format (alphanumeric + underscores only, 3-20 chars)
      const handleRegex = /^[a-z0-9_]{3,20}$/;
      if (!handleRegex.test(trimmedHandle)) {
        return NextResponse.json(
          { error: "Handle must be 3-20 characters, lowercase letters, numbers, and underscores only" },
          { status: 400 }
        );
      }

      // Check if handle is already taken (by someone else)
      const existingUser = await prisma.user.findUnique({
        where: { handle: trimmedHandle },
      });

      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: "Handle is already taken" },
          { status: 400 }
        );
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(displayName !== undefined && { displayName: displayName.trim() }),
        ...(bio !== undefined && { bio: bio.trim() || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl.trim() || null }),
        ...(handle !== undefined && { handle: handle.trim().toLowerCase() }),
        ...(favouritesJson !== undefined && { favourites: favouritesJson }),
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        favourites: true,
        email: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Update user error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
