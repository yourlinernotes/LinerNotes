/**
 * iTunes Search — keyless lookup for a track's 30s preview + duration.
 *
 * One call gives us everything the Experience screen needs for a single track:
 *   - `previewUrl`  → the fallback in-app audio (expo-audio)
 *   - `durationSec` → LRCLIB's version tiebreaker for accurate lyric matching
 *   - `itunesUrl`   → a source URL Odesli can resolve to SoundCloud
 *
 * Broad catalogue, no key, no CORS on native. See vault "Audio Sourcing".
 */

export interface ItunesTrack {
  trackName: string;
  artistName: string;
  previewUrl: string | null;
  durationSec: number | null;
  itunesTrackId: string | null;
  /** Canonical track view URL — feed to Odesli for cross-platform resolution. */
  itunesUrl: string | null;
}

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/[^a-z0-9]+/g, '');

/** Look up a track by name + artist. Returns null on no match / network error. */
export async function lookupTrack(
  track: string,
  artist: string,
): Promise<ItunesTrack | null> {
  if (!track) return null;
  const term = encodeURIComponent(`${artist} ${track}`.trim());
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=song&limit=5`,
    );
    if (!res.ok) return null;
    const { results } = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    // Prefer an exact-ish title match, else the first result.
    const want = norm(track);
    const hit =
      results.find((r: any) => norm(r.trackName) === want) ?? results[0];

    return {
      trackName: hit.trackName,
      artistName: hit.artistName,
      previewUrl: hit.previewUrl ?? null,
      durationSec: hit.trackTimeMillis
        ? Math.round(hit.trackTimeMillis / 1000)
        : null,
      itunesTrackId: hit.trackId ? String(hit.trackId) : null,
      itunesUrl: hit.trackViewUrl ?? null,
    };
  } catch {
    return null;
  }
}
