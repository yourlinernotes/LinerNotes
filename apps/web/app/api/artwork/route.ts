import { NextResponse } from "next/server";
import { resolveArtwork } from "@/lib/deezer";

/**
 * GET /api/artwork?track=&artist=
 *
 * The correct high-res album cover for a track, via strict iTunes/Deezer
 * matching. Asking-prompt art comes from Last.fm (often the wrong cover), so we
 * prefer this. Returns { artworkUrl: string | null }. Art is stable → cache hard.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = (searchParams.get("track") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();

  const ok = (artworkUrl: string | null) =>
    NextResponse.json(
      { artworkUrl },
      { headers: { "Cache-Control": artworkUrl ? "public, max-age=86400, s-maxage=604800" : "no-store" } },
    );

  try {
    if (!track) return ok(null);
    return ok(await resolveArtwork(track, artist));
  } catch (error) {
    console.error("[artwork] error:", error);
    return ok(null);
  }
}
