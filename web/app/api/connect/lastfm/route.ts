import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import crypto from "crypto";

const LASTFM_AUTH_URL = "https://www.last.fm/api/auth";

/**
 * Generate Last.fm API signature
 */
function generateSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return crypto.createHash("md5").update(sorted + secret).digest("hex");
}

/**
 * POST /api/connect/lastfm - Initiate Last.fm connection
 */
export async function POST() {
  try {
    const user = await requireAuth();

    const apiKey = process.env.LASTFM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Last.fm API not configured" },
        { status: 500 }
      );
    }

    // Last.fm auth URL
    // User will approve, then we get a token via callback
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/connect/lastfm/callback?userId=${user.id}`;

    const authUrl = `${LASTFM_AUTH_URL}/?api_key=${apiKey}&cb=${encodeURIComponent(callbackUrl)}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Last.fm connect error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to initiate Last.fm connection" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/connect/lastfm - Get Last.fm connection status
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const { prisma } = await import("@/lib/prisma");

    const connection = await prisma.musicConnection.findUnique({
      where: {
        userId_service: {
          userId: user.id,
          service: "lastfm",
        },
      },
      select: {
        id: true,
        serviceUsername: true,
        connectedAt: true,
      },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      username: connection.serviceUsername,
      connectedAt: connection.connectedAt,
    });
  } catch (error) {
    console.error("Get Last.fm connection error:", error);
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
 * DELETE /api/connect/lastfm - Disconnect Last.fm
 */
export async function DELETE() {
  try {
    const user = await requireAuth();

    const { prisma } = await import("@/lib/prisma");

    await prisma.musicConnection.delete({
      where: {
        userId_service: {
          userId: user.id,
          service: "lastfm",
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect Last.fm error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to disconnect Last.fm" },
      { status: 500 }
    );
  }
}
