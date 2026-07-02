import { NextResponse } from "next/server";
import { searchSoundCloudAlbum, type SoundCloudAlbum } from "@/lib/soundcloud";

/**
 * GET /api/soundcloud-album?album=&artist=
 *
 * Auto-find an album's SoundCloud set (keyless internal search) → its ordered
 * tracks for full-song playback. Returns { album: { url, tracks } | null }.
 * Cache hard — the mapping is stable.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const album = (searchParams.get("album") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();

  const ok = (data: SoundCloudAlbum | null) =>
    NextResponse.json(
      { album: data },
      { headers: { "Cache-Control": data ? "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400" : "no-store" } },
    );

  try {
    if (!album) return ok(null);
    return ok(await searchSoundCloudAlbum(album, artist));
  } catch (error) {
    console.error("[soundcloud-album] error:", error);
    return ok(null);
  }
}
