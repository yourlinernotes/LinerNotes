import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/connect/listenbrainz   { username: string }
 * GET  /api/connect/listenbrainz            → { connected, username }
 * DELETE /api/connect/listenbrainz
 *
 * ListenBrainz is keyless — connecting is just storing a validated username in
 * the listenbrainz MusicConnection. We verify the user exists via the public
 * API (listen-count 404s for unknown users) so we don't store typos. Then
 * /api/listening/now reads their now-playing/recent through it.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const raw = (await request.json().catch(() => ({}))) as { username?: string };
    const username = (raw.username || "").trim();
    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    // Verify the username against the public API before saving.
    let valid = false;
    try {
      const r = await fetch(
        `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}/listen-count`,
        { headers: { "User-Agent": "LinerNotes/1.0 (linernotes.app)" } },
      );
      valid = r.ok;
    } catch {
      /* network hiccup — treat as unverified */
    }
    if (!valid) {
      return NextResponse.json({ error: "ListenBrainz user not found" }, { status: 404 });
    }

    await prisma.musicConnection.upsert({
      where: { userId_service: { userId: user.id, service: "listenbrainz" } },
      create: { userId: user.id, service: "listenbrainz", serviceUsername: username },
      update: { serviceUsername: username, updatedAt: new Date() },
    });
    return NextResponse.json({ connected: true, username });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[connect/listenbrainz] error:", error);
    return NextResponse.json({ error: "Failed to connect" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireAuth();
    const conn = await prisma.musicConnection.findUnique({
      where: { userId_service: { userId: user.id, service: "listenbrainz" } },
    });
    return NextResponse.json({ connected: !!conn, username: conn?.serviceUsername ?? null });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth();
    await prisma.musicConnection
      .delete({ where: { userId_service: { userId: user.id, service: "listenbrainz" } } })
      .catch(() => {});
    return NextResponse.json({ connected: false });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
