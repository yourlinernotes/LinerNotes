import { NextResponse } from "next/server";
import { resolvePreview, type PreviewResult } from "@/lib/deezer";

/**
 * GET /api/preview?track=&artist=
 *
 * A browser-playable 30s preview for a track: Deezer MP3 first (iTunes previews
 * are `audio/x-m4p` and stall in-browser), iTunes as fallback. Returns
 * { preview: { previewUrl, durationSec, source, sourceUrl } | null }.
 *
 * Preview URLs are short-lived (Deezer signs them), so don't cache hard.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = (searchParams.get("track") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();

  const ok = (preview: PreviewResult | null) =>
    NextResponse.json({ preview }, { headers: { "Cache-Control": "public, max-age=1800" } });

  try {
    if (!track) return ok(null);
    return ok(await resolvePreview(track, artist));
  } catch (error) {
    console.error("[preview] error:", error);
    return ok(null);
  }
}
