import { NextResponse } from "next/server";
import { albumPreviews, type AlbumTrackPreview } from "@/lib/deezer";

/**
 * GET /api/album-previews?album=&artist=
 *
 * The real tracklist of a specific album with browser-playable previews (Deezer
 * MP3 first, iTunes fallback). Resolving the album once and matching tracks
 * within it is far more reliable than a global per-track search for obscure
 * records. Returns { album: { tracks: [{name, previewUrl, durationSec}], source } | null }.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const album = (searchParams.get("album") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();

  const ok = (data: { tracks: AlbumTrackPreview[]; source: string } | null) =>
    NextResponse.json({ album: data }, { headers: { "Cache-Control": "public, max-age=1800" } });

  try {
    if (!album) return ok(null);
    return ok(await albumPreviews(album, artist));
  } catch (error) {
    console.error("[album-previews] error:", error);
    return ok(null);
  }
}
