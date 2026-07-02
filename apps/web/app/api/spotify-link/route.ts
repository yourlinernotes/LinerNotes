import { NextResponse } from "next/server";
import { getSpotifyAppToken, searchTracks, searchAlbums } from "@/lib/spotify";

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const ODESLI = "https://api.song.link/v1-alpha.1/links";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// Loose title compare so "Chun-Li" matches "Chun-Li (feat. …)" etc.
const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
    .replace(/[^a-z0-9]+/g, "");

/**
 * GET /api/spotify-link?id=&kind=track|album&title=&artist=&sourceUrl=
 *
 * Resolution ladder (no Spotify creds needed for the first two):
 *   1. id is already a 22-char Spotify base62 → build URL directly.
 *   2. sourceUrl provided (Deezer / iTunes / etc.) → Odesli cross-platform
 *      lookup → Spotify URL.
 *   3. title+artist → Spotify Client Credentials search (needs SPOTIFY_CLIENT_ID
 *      / SECRET; returns null when creds are missing, caller falls back to search).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  const kind = searchParams.get("kind") === "album" ? "album" : "track";
  const title = (searchParams.get("title") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();
  const sourceUrl = (searchParams.get("sourceUrl") || "").trim();

  const ok = (url: string | null) =>
    NextResponse.json(
      { url },
      { headers: { "Cache-Control": url ? "public, max-age=86400, s-maxage=604800" : "no-store" } },
    );

  // 1. Already a Spotify id.
  if (SPOTIFY_ID.test(id)) return ok(`https://open.spotify.com/${kind}/${id}`);

  // 2. Cross-platform resolution via Odesli (free, no key, works for any
  //    Deezer/iTunes/Apple Music/YouTube URL).
  if (sourceUrl) {
    try {
      const q = new URLSearchParams({ url: sourceUrl, userCountry: "US" });
      const r = await fetch(`${ODESLI}?${q}`, { headers: { "User-Agent": UA } });
      if (r.ok) {
        const j = await r.json();
        const spUrl = j?.linksByPlatform?.spotify?.url ?? null;
        if (spUrl) return ok(spUrl);
      }
    } catch { /* fall through to Spotify search */ }
  }

  if (!title) return ok(null);

  // 3. Spotify Client Credentials search (needs env vars; optional).
  const token = await getSpotifyAppToken();
  if (!token) return ok(null);

  try {
    const q = `${title} ${artist}`.trim();
    if (kind === "album") {
      const res = await searchAlbums(q, token);
      const hit = res.find((a) => norm(a.name) === norm(title)) || res[0];
      return ok(hit?.albumId ? `https://open.spotify.com/album/${hit.albumId}` : null);
    }
    const res = await searchTracks(q, token);
    const hit = res.find((t) => norm(t.name) === norm(title)) || res[0];
    return ok(hit?.trackId ? `https://open.spotify.com/track/${hit.trackId}` : null);
  } catch {
    return ok(null);
  }
}
