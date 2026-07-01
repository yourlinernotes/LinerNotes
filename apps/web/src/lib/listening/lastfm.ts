import type { NowPlaying } from "./types";

// Last.fm now-playing (web-side). Needs LASTFM_API_KEY (already in prod env).
// Covers users who already scrobble to Last.fm.

export async function lastfmNowPlaying(username: string): Promise<NowPlaying | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(username)}&api_key=${key}&format=json&limit=1`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const t = (await r.json())?.recenttracks?.track?.[0];
    if (!t) return null;
    return {
      track: t.name,
      artist: typeof t.artist === "string" ? t.artist : t.artist?.["#text"] ?? "",
      album: (typeof t.album === "string" ? t.album : t.album?.["#text"]) || undefined,
      mbid: t.mbid || null,
      source: "lastfm",
      isPlaying: t?.["@attr"]?.nowplaying === "true",
    };
  } catch {
    return null;
  }
}
