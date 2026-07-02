import { NextResponse } from "next/server";
import { resolveSoundCloud, type SoundCloudResult } from "@/lib/soundcloud";
import { resolvePreview } from "@/lib/deezer";

/**
 * GET /api/soundcloud-link?url=&id=&platform=&type=
 *
 * Best-effort resolution of a track to a SoundCloud `{ url, trackId }` playable by
 * the HTML5 Widget. Pass a `url` (any streaming platform) or an `id`+`platform`
 * that Odesli understands. Returns `{ soundcloud: null }` when the track isn't on
 * SoundCloud or the id can't be scraped — the caller falls back to a 30s preview.
 *
 * A resolved id is stable → cache hard. See vault "SoundCloud Widget API".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceUrl = (searchParams.get("url") || "").trim() || undefined;
  const id = (searchParams.get("id") || "").trim() || undefined;
  const platform = (searchParams.get("platform") || "").trim() || undefined;
  const type = searchParams.get("type") === "album" ? "album" : "song";
  const track = (searchParams.get("track") || "").trim() || undefined;
  const artist = (searchParams.get("artist") || "").trim() || undefined;
  const durationRaw = Number(searchParams.get("duration"));
  let durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : undefined;

  const ok = (soundcloud: SoundCloudResult | null) =>
    NextResponse.json(
      { soundcloud },
      {
        headers: {
          // Short browser cache so a resolution that later proves wrong (matching
          // is still evolving) self-heals in minutes, not a day — the CDN
          // (s-maxage, purged on each deploy) carries the perf. Nulls: no-store.
          "Cache-Control": soundcloud
            ? "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400"
            : "no-store",
        },
      },
    );

  try {
    if (!sourceUrl && !(id && platform) && !track) return ok(null);
    // The duration gate (reject wrong-length copies that break sync) only fires
    // when we know the real length. Clients don't always send it (e.g. album
    // tracks that skip the preview fetch), so resolve it server-side via Deezer
    // when absent — makes the gate reliable for every caller.
    if (!durationSec && track) {
      try {
        const p = await resolvePreview(track, artist || "");
        if (p?.durationSec) durationSec = p.durationSec;
      } catch { /* fall through — gate just won't apply */ }
    }
    return ok(await resolveSoundCloud({ sourceUrl, id, platform, type, track, artist, durationSec }));
  } catch (error) {
    console.error("[soundcloud-link] error:", error);
    return ok(null);
  }
}
