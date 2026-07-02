import { NextResponse } from "next/server";
import { resolveYouTubeAudio } from "@/lib/youtube";

/**
 * GET /api/youtube-audio?track=&artist=&duration=
 *
 * Tier 2 of the playback ladder: find a clean full-song YouTube match for a
 * track SoundCloud couldn't stream. Keyless (InnerTube, no YouTube Data API).
 * Returns:
 *   { youtube: { videoId, durationSec, streamUrl: "/api/youtube-stream?v=<id>" } | null }
 *
 * The actual audio bytes are extracted fresh inside /api/youtube-stream (so the
 * googlevideo fetch + deciphering happen in one server invocation). A resolved
 * videoId is stable → cache hard; a miss → no-store.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = (searchParams.get("track") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();
  const durationRaw = Number(searchParams.get("duration"));
  const durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : undefined;

  const ok = (
    youtube: { videoId: string; durationSec: number; streamUrl: string } | null,
  ) =>
    NextResponse.json(
      { youtube },
      {
        headers: {
          "Cache-Control": youtube
            ? "public, max-age=86400, s-maxage=604800"
            : "no-store",
        },
      },
    );

  try {
    if (!track) return ok(null);
    const match = await resolveYouTubeAudio(track, artist, durationSec);
    if (!match) return ok(null);
    return ok({
      videoId: match.videoId,
      durationSec: match.durationSec,
      streamUrl: `/api/youtube-stream?v=${encodeURIComponent(match.videoId)}`,
    });
  } catch (error) {
    console.error("[youtube-audio] error:", error);
    return ok(null);
  }
}
