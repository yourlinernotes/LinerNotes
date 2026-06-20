import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
].join(" ");

/**
 * POST /api/connect/spotify - Initiate Spotify connection (post-login)
 */
export async function POST() {
  try {
    const user = await requireAuth();

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Spotify OAuth not configured" },
        { status: 500 }
      );
    }

    // Use user ID as state for CSRF protection
    const state = user.id;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES,
      state: state,
    });

    const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Spotify connect error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to initiate Spotify connection" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/connect/spotify - Get Spotify connection status
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const { prisma } = await import("@/lib/prisma");

    const connection = await prisma.musicConnection.findFirst({
      where: {
        userId: user.id,
        service: "spotify",
      },
      select: {
        id: true,
        serviceUsername: true,
        connectedAt: true,
        expiresAt: true,
      },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
      });
    }

    const isExpired = connection.expiresAt && new Date() >= connection.expiresAt;

    return NextResponse.json({
      connected: true,
      username: connection.serviceUsername,
      connectedAt: connection.connectedAt,
      isExpired,
    });
  } catch (error) {
    console.error("Get Spotify connection error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get connection status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connect/spotify - Disconnect Spotify
 */
export async function DELETE() {
  try {
    const user = await requireAuth();

    const { prisma } = await import("@/lib/prisma");

    const connection = await prisma.musicConnection.findFirst({
      where: {
        userId: user.id,
        service: "spotify",
      },
    });

    if (connection) {
      await prisma.musicConnection.delete({
        where: {
          id: connection.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect Spotify error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to disconnect Spotify" },
      { status: 500 }
    );
  }
}
