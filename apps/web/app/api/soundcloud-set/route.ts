import { NextResponse } from "next/server";
import { resolveSoundCloudSet } from "@/lib/soundcloud";

// SSRF guard: this endpoint only reads SoundCloud set/track links.
function isSoundCloudUrl(value: string): boolean {
  try {
    const h = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return h === "soundcloud.com" || h.endsWith(".soundcloud.com");
  } catch {
    return false;
  }
}

/**
 * GET /api/soundcloud-set?url=<soundcloud set or track url>
 *
 * Read a pasted SoundCloud album/playlist link → its ordered tracks
 * ({ id, title }[]) for full-song playback. Reliable where auto-resolution
 * can't find the artist's handle. Returns { tracks } or { tracks: null }.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = (searchParams.get("url") || "").trim();

  const ok = (tracks: { id: string; title: string | null }[] | null) =>
    NextResponse.json(
      { tracks },
      { headers: { "Cache-Control": tracks ? "public, max-age=86400, s-maxage=604800" : "no-store" } },
    );

  try {
    if (!url || !isSoundCloudUrl(url)) return ok(null);
    return ok(await resolveSoundCloudSet(url));
  } catch (error) {
    console.error("[soundcloud-set] error:", error);
    return ok(null);
  }
}
