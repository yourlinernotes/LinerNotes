import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lastfm/now-playing - the viewer's currently-playing Last.fm track,
 * or { nowPlaying: null } when nothing is playing / not connected. Last.fm's
 * recenttracks returns the last-played track even when stopped, so we gate on
 * the @attr.nowplaying === "true" flag — only a live scrobble counts.
 *
 * Fails soft: any error returns { nowPlaying: null } so the UI just hides the
 * badge rather than surfacing an error.
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const connection = await prisma.musicConnection.findFirst({
      where: { userId: user.id, service: "lastfm" },
    });
    const apiKey = process.env.LASTFM_API_KEY;
    if (!connection?.serviceUsername || !apiKey) {
      return NextResponse.json({ nowPlaying: null });
    }

    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ nowPlaying: null });

    const data = await res.json();
    const track = data.recenttracks?.track?.[0];
    const isPlaying = track?.["@attr"]?.nowplaying === "true";
    if (!track || !isPlaying) return NextResponse.json({ nowPlaying: null });

    const artist = typeof track.artist === "string" ? track.artist : track.artist?.["#text"] || track.artist?.name || "";
    const album = typeof track.album === "string" ? track.album : track.album?.["#text"] || track.album?.title || "";

    return NextResponse.json(
      { nowPlaying: { name: track.name, artist, album } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ nowPlaying: null });
    }
    console.error("[Last.fm now-playing] error:", error);
    return NextResponse.json({ nowPlaying: null });
  }
}
