import { NextResponse } from "next/server";
import { resolveLyrics, lyricsById, type LyricsResult } from "@/lib/lyrics";

/**
 * GET /api/lyrics?track=&artist=&album=&duration=&id=
 *
 * Time-synced lyrics for a track, via LRCLIB (free, keyless). Pass `id` to fetch
 * a previously-resolved LRCLIB row directly (no fuzzy match). Otherwise resolve
 * by track/artist(/album/duration). Returns the LyricsResult or { lyrics: null }
 * when nothing confident is found (caller degrades: synced → plain → none).
 *
 * Public + cacheable — lyrics don't change. See vault note "LRCLIB API".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = (searchParams.get("id") || "").trim();
  const track = (searchParams.get("track") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();
  const album = (searchParams.get("album") || "").trim() || undefined;
  const durationSec = Number(searchParams.get("duration")) || undefined;

  const ok = (lyrics: LyricsResult | null) =>
    NextResponse.json(
      { lyrics },
      {
        headers: {
          "Cache-Control": lyrics
            ? "public, max-age=86400, s-maxage=604800"
            : "no-store",
        },
      },
    );

  try {
    const id = Number(idParam);
    if (idParam && Number.isFinite(id)) return ok(await lyricsById(id));
    if (!track || !artist) return ok(null);
    return ok(await resolveLyrics({ track, artist, album, durationSec }));
  } catch (error) {
    console.error("[lyrics] error:", error);
    return ok(null);
  }
}
