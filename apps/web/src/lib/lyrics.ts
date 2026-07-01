/**
 * LRCLIB lyrics client — free, keyless, time-synced `.lrc` lyrics.
 *
 * Resolution ladder (vault note "LRCLIB API"):
 *   1. GET /api/get with duration → the single best match (strict, 404 if unsure)
 *   2. on miss, GET /api/search → pick the candidate whose name matches and whose
 *      duration is closest, preferring one that actually has syncedLyrics.
 *
 * Degradation is expressed in the return: syncedLyrics → highlight, plainLyrics →
 * static block, instrumental → badge/hide. We only ever read, so no publish token.
 */

const LRCLIB_BASE = "https://lrclib.net";
// LRCLIB's docs ask for a descriptive User-Agent (app + repo). Good manners.
const UA = "LinerNotes (https://github.com/yourlinernotes/LinerNotes)";

export interface LyricsResult {
  /** LRCLIB row id — stable, cacheable; store to re-fetch by id later. */
  id: number | null;
  trackName: string;
  artistName: string;
  /** `[mm:ss.xx] line` time-synced lyrics, or null when only plain exists. */
  syncedLyrics: string | null;
  /** Unsynced fallback text, or null. */
  plainLyrics: string | null;
  instrumental: boolean;
  source: "lrclib";
}

interface LrclibRow {
  id: number;
  trackName: string;
  artistName: string;
  duration: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
    .replace(/[^a-z0-9]+/g, "");

function toResult(row: LrclibRow): LyricsResult {
  return {
    id: row.id ?? null,
    trackName: row.trackName,
    artistName: row.artistName,
    syncedLyrics: row.syncedLyrics || null,
    plainLyrics: row.plainLyrics || null,
    instrumental: !!row.instrumental,
    source: "lrclib",
  };
}

export interface ResolveLyricsArgs {
  track: string;
  artist: string;
  album?: string;
  /** Track duration in seconds — LRCLIB's tiebreaker between versions. */
  durationSec?: number;
}

/** Resolve lyrics for a track. Returns null when nothing confident is found. */
export async function resolveLyrics({
  track,
  artist,
  album,
  durationSec,
}: ResolveLyricsArgs): Promise<LyricsResult | null> {
  if (!track || !artist) return null;
  const headers = { "User-Agent": UA };

  // 1. Strict best-match.
  try {
    const q = new URLSearchParams({ artist_name: artist, track_name: track });
    if (album) q.set("album_name", album);
    if (durationSec) q.set("duration", String(Math.round(durationSec)));
    const r = await fetch(`${LRCLIB_BASE}/api/get?${q}`, { headers });
    if (r.ok) return toResult(await r.json());
    // 404 = no confident match → fall through to fuzzy search.
  } catch {
    /* fall through */
  }

  // 2. Fuzzy search, pick best by name match + duration closeness (synced first).
  try {
    const q = new URLSearchParams({ track_name: track, artist_name: artist });
    const r = await fetch(`${LRCLIB_BASE}/api/search?${q}`, { headers });
    if (!r.ok) return null;
    const list: LrclibRow[] = await r.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    const wantTitle = norm(track);
    const scored = list
      .map((row) => {
        const nameMatch = norm(row.trackName) === wantTitle ? 0 : 1;
        const durGap =
          durationSec && row.duration
            ? Math.abs(row.duration - durationSec)
            : Number.MAX_SAFE_INTEGER;
        const hasSynced = row.syncedLyrics ? 0 : 1;
        return { row, nameMatch, hasSynced, durGap };
      })
      // Prefer: exact name → has synced → closest duration.
      .sort(
        (a, b) =>
          a.nameMatch - b.nameMatch ||
          a.hasSynced - b.hasSynced ||
          a.durGap - b.durGap,
      );

    return toResult(scored[0].row);
  } catch {
    return null;
  }
}

/** Fetch by a previously-resolved LRCLIB id — no fuzzy matching, cache-friendly. */
export async function lyricsById(id: number): Promise<LyricsResult | null> {
  try {
    const r = await fetch(`${LRCLIB_BASE}/api/get/${id}`, {
      headers: { "User-Agent": UA },
    });
    if (!r.ok) return null;
    return toResult(await r.json());
  } catch {
    return null;
  }
}
