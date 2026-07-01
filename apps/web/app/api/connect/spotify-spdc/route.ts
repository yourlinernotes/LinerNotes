import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/connect/spotify-spdc   { spDc: string }
 * DELETE /api/connect/spotify-spdc
 *
 * Store (or clear) the user's Spotify web-session cookie, captured via the
 * in-app WebView login, so /api/listening/now can read their now-playing
 * without the official API (experimental). The cookie lives in the spotify
 * MusicConnection's accessToken field. See vault "Listening History & Scrobbling".
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { spDc } = await request.json().catch(() => ({}));
    if (!spDc || typeof spDc !== "string") {
      return NextResponse.json({ error: "Missing sp_dc" }, { status: 400 });
    }
    await prisma.musicConnection.upsert({
      where: { userId_service: { userId: user.id, service: "spotify" } },
      create: { userId: user.id, service: "spotify", accessToken: spDc },
      update: { accessToken: spDc, updatedAt: new Date() },
    });
    return NextResponse.json({ connected: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[connect/spotify-spdc] error:", error);
    return NextResponse.json({ error: "Failed to connect" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth();
    await prisma.musicConnection
      .delete({ where: { userId_service: { userId: user.id, service: "spotify" } } })
      .catch(() => {});
    return NextResponse.json({ connected: false });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
