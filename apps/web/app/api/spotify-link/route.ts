import { NextResponse } from "next/server";
import { getSpotifyAppToken, searchTracks, searchAlbums } from "@/lib/spotify";

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

// Loose title compare so "Chun-Li" matches "Chun-Li (feat. …)" etc.
const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
    .replace(/[^a-z0-9]+/g, "");

/**
 * GET /api/spotify-link?id=&kind=track|album&title=&artist=
 *
 * Resolves a review to a real open.spotify.com deeplink. If `id` is already a
 * Spotify id (22-char base62) we build the URL with no API call. Otherwise we
 * resolve the exact track/album via Spotify Search (Client Credentials — no user
 * auth, so the dev-mode user allowlist doesn't apply). Returns { url } or
 * { url: null } when nothing matches / creds are missing (caller falls back).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  const kind = searchParams.get("kind") === "album" ? "album" : "track";
  const title = (searchParams.get("title") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();

  const ok = (url: string | null) =>
    NextResponse.json(
      { url },
      // A track's Spotify id is stable — let it cache hard to avoid re-resolving.
      { headers: { "Cache-Control": url ? "public, max-age=86400, s-maxage=604800" : "no-store" } },
    );

  // Already a Spotify id — no lookup needed.
  if (SPOTIFY_ID.test(id)) return ok(`https://open.spotify.com/${kind}/${id}`);

  if (!title) return ok(null);

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
