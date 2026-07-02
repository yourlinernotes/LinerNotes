import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/connect/status
 *
 * Which listening providers the current user has connected, for the shared
 * "how do you listen?" chooser (onboarding + settings). Keyless-agnostic.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const conns = await prisma.musicConnection.findMany({ where: { userId: user.id } });
    const by = (s: string) => conns.find((c) => c.service === s);

    const lastfm = by("lastfm");
    const spotify = by("spotify");
    const listenbrainz = by("listenbrainz");

    return NextResponse.json({
      lastfm: { connected: !!(lastfm?.sessionKey || lastfm?.serviceUsername), username: lastfm?.serviceUsername ?? null },
      spotify: { connected: !!spotify?.accessToken },
      listenbrainz: { connected: !!listenbrainz?.serviceUsername, username: listenbrainz?.serviceUsername ?? null },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
