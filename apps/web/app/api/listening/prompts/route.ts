import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { spotifySpDcRecent, spotifySpDcTopTracks } from "@/lib/listening/spotify-spdc";
import { listenBrainzRecent } from "@/lib/listening/listenbrainz";
import { generatePrompts, type RecentPlay } from "@/lib/listening/recent";
import { GET as lastfmPromptsGET } from "../../lastfm/prompts/route";

/**
 * GET /api/listening/prompts
 *
 * Provider-agnostic "worth a note" prompts for the feed. Same Prompt shape and
 * copy as /api/lastfm/prompts, but works for whichever listening source the user
 * connected. Source priority mirrors /api/listening/now:
 *   Spotify sp_dc (experimental) → ListenBrainz → Last.fm.
 *
 * Spotify/ListenBrainz run through the shared generator (src/lib/listening/recent).
 * A Last.fm-only user is proxied to the existing Last.fm route so its rich
 * artwork-resolution path is preserved. Fails soft to { prompts: [] } — never a
 * 500 that breaks the feed.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const conns = await prisma.musicConnection.findMany({ where: { userId: user.id } });
    const byService = (s: string) => conns.find((c) => c.service === s);

    const sp = byService("spotify");
    const lb = byService("listenbrainz");
    const lf = byService("lastfm");

    // Last.fm-only (no Spotify sp_dc, no ListenBrainz): proxy to the existing
    // Last.fm handler so nothing regresses for those users.
    const hasSpotify = !!sp?.accessToken;
    const hasListenBrainz = !!lb?.serviceUsername;
    if (!hasSpotify && !hasListenBrainz) {
      if (lf?.serviceUsername) return lastfmPromptsGET();
      return NextResponse.json({ prompts: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    // Build the dedup sets from the user's existing reviews (same query + normKey
    // approach as the Last.fm route). The generator applies normKey internally.
    const existingReviews = await prisma.review.findMany({
      where: { userId: user.id },
      select: { trackName: true, trackArtist: true, trackAlbum: true },
    });
    const existingAlbumReviews = await prisma.albumReview.findMany({
      where: { userId: user.id },
      select: { albumName: true, albumArtist: true },
    });

    const normKey = (artist: string, title: string): string => {
      const clean = (s: string) =>
        (s || "")
          .toLowerCase()
          .replace(/\s*[([][^)\]]*[)\]]/g, "")
          .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
          .replace(/[^a-z0-9]+/g, "");
      return `${clean(artist)}::${clean(title)}`;
    };
    const reviewedTracks = new Set(existingReviews.map((r) => normKey(r.trackArtist, r.trackName)));
    const reviewedAlbums = new Set(existingAlbumReviews.map((r) => normKey(r.albumArtist, r.albumName)));

    let plays: RecentPlay[] = [];
    let top: RecentPlay[] = [];

    if (hasSpotify) {
      [plays, top] = await Promise.all([
        spotifySpDcRecent(sp!.accessToken!, 50),
        spotifySpDcTopTracks(sp!.accessToken!, 20),
      ]);
    } else if (hasListenBrainz) {
      plays = await listenBrainzRecent(lb!.serviceUsername!, 100);
    }

    const prompts = await generatePrompts(plays, { reviewedTracks, reviewedAlbums, top });

    return NextResponse.json({ prompts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[listening/prompts] error:", error);
    return NextResponse.json({ prompts: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
