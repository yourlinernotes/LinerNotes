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
 * GET /api/connect/lastfm - Initiate Last.fm connection or get status
 * If callbackUrl query param is present, initiate OAuth flow
 * Otherwise, return connection status
 */
export async function GET(request: Request) {
  console.log("[Last.fm GET] START");

  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get("callbackUrl");

  try {
    console.log("[Last.fm GET] Request received, callbackUrl:", callbackUrl);

    // Get session without throwing
    let session;
    try {
      const { getAuthSession } = await import("@/lib/auth-helpers");
      session = await getAuthSession();
      console.log("[Last.fm GET] Session:", session ? "exists" : "null", session?.user?.id);
    } catch (sessionError) {
      console.error("[Last.fm GET] Session error:", sessionError);
      // Return not connected instead of crashing
      if (!callbackUrl) {
        return NextResponse.json({ connected: false });
      }
      return NextResponse.json({ error: "Session error" }, { status: 500 });
    }

    if (!session?.user) {
      // Not authenticated - return not connected for status checks
      console.log("[Last.fm GET] No session, returning connected: false");
      if (!callbackUrl) {
        return NextResponse.json({ connected: false });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    console.log("[Last.fm GET] Authenticated user:", user.id);

    // If callbackUrl is provided, initiate OAuth flow
    if (callbackUrl) {
      const apiKey = process.env.LASTFM_API_KEY;

      if (!apiKey) {
        const redirectUrl = `${process.env.NEXTAUTH_URL}${callbackUrl}?error=lastfm_api_not_configured`;
        return NextResponse.redirect(redirectUrl);
      }

      // Last.fm auth URL - user will approve, then we get a token via callback
      const oauthCallback = `${process.env.NEXTAUTH_URL}/api/connect/lastfm/callback?userId=${user.id}&returnTo=${encodeURIComponent(callbackUrl)}`;

      const authUrl = `${LASTFM_AUTH_URL}/?api_key=${apiKey}&cb=${encodeURIComponent(oauthCallback)}`;

      return NextResponse.redirect(authUrl);
    }

    // Otherwise, return connection status
    let connection;
    try {
      const { prisma } = await import("@/lib/prisma");
      console.log("[Last.fm GET] Querying Prisma for connection...");

      connection = await prisma.musicConnection.findFirst({
        where: {
          userId: user.id,
          service: "lastfm",
        },
        select: {
          id: true,
          serviceUsername: true,
          connectedAt: true,
        },
      });

      console.log("[Last.fm GET] Connection found:", connection ? "yes" : "no", connection?.id);
    } catch (prismaError) {
      console.error("[Last.fm GET] Prisma error:", prismaError);
      return NextResponse.json(
        { error: `Database error: ${prismaError instanceof Error ? prismaError.message : String(prismaError)}` },
        { status: 500 }
      );
    }

    if (!connection) {
      console.log("[Last.fm GET] No connection, returning connected: false");
      return NextResponse.json({
        connected: false,
      });
    }

    console.log("[Last.fm GET] Returning connected: true");
    return NextResponse.json({
      connected: true,
      username: connection.serviceUsername,
      connectedAt: connection.connectedAt,
    });
  } catch (error) {
    console.error("[Last.fm GET] ERROR:", error);
    console.error("[Last.fm GET] Error stack:", error instanceof Error ? error.stack : "N/A");

    // If this is a status check (no callbackUrl), return not connected instead of error
    if (!callbackUrl) {
      console.log("[Last.fm GET] Error during status check, returning connected: false");
      return NextResponse.json({
        connected: false,
      });
    }

    // For OAuth flow, return proper error
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: `Failed to get connection status: ${error instanceof Error ? error.message : String(error)}` },
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

    const connection = await prisma.musicConnection.findFirst({
      where: {
        userId: user.id,
        service: "lastfm",
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
