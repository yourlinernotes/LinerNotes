import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listenBrainzNowPlaying } from "@/lib/listening/listenbrainz";
import { lastfmNowPlaying } from "@/lib/listening/lastfm";
import { spotifySpDcNowPlaying } from "@/lib/listening/spotify-spdc"; // experimental
import type { NowPlaying } from "@/lib/listening/types";

/**
 * GET /api/listening/now
 *
 * The user's current/last play, normalised across sources. Drives the
 * low-friction rating floor (pre-fill the track being played) and the asking
 * engine. Source priority: Spotify sp_dc (experimental) → ListenBrainz → Last.fm.
 * Returns { nowPlaying: NowPlaying | null }; fails soft to null.
 *
 * See vault note "Listening History & Scrobbling" for the full design.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const conns = await prisma.musicConnection.findMany({ where: { userId: user.id } });
    const byService = (s: string) => conns.find((c) => c.service === s);

    let np: NowPlaying | null = null;

    // Experimental, opt-in: Spotify via the user's sp_dc cookie — highest
    // priority when present (real-time, no 5-user cap). The cookie is stored in
    // the spotify connection's accessToken field. Fails soft to null (the TOTP
    // secret may be unconfigured/stale — never let it gate the rating floor).
    const sp = byService("spotify");
    if (!np && sp?.accessToken) np = await spotifySpDcNowPlaying(sp.accessToken);

    const lb = byService("listenbrainz");
    if (!np && lb?.serviceUsername) np = await listenBrainzNowPlaying(lb.serviceUsername);

    const lf = byService("lastfm");
    if (!np && lf?.serviceUsername) np = await lastfmNowPlaying(lf.serviceUsername);

    // TODO: persist each resolved play to our own DB keyed by MBID → the taste-graph asset.

    return NextResponse.json({ nowPlaying: np }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ nowPlaying: null });
    }
    console.error("[listening/now] error:", error);
    return NextResponse.json({ nowPlaying: null });
  }
}
