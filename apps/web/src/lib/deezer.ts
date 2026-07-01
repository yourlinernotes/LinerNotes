/**
 * Preview resolution — Deezer first, iTunes fallback.
 *
 * Why Deezer: iTunes 30s previews are served as `audio/x-m4p`, which browsers
 * frequently can't decode in a plain <audio> (they stall at readyState 0 → the
 * play button appears active but no sound). Deezer previews are plain **MP3
 * (audio/mpeg)**, which every browser plays. So for the web player we resolve
 * Deezer first and only fall back to iTunes when Deezer has no match.
 *
 * Deezer's API has no CORS headers, so this must run server-side; the preview
 * MP3 URLs themselves (cdnt-preview.dzcdn.net) are cross-origin playable.
 */

export interface PreviewResult {
  previewUrl: string;
  durationSec: number | null;
  source: "deezer" | "itunes";
  /** A canonical track URL Odesli can resolve to SoundCloud, when known. */
  sourceUrl?: string | null;
}

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
    .replace(/[^a-z0-9]+/g, "");

/** Deezer search → best browser-playable MP3 preview for track+artist. */
export async function deezerPreview(track: string, artist: string): Promise<PreviewResult | null> {
  if (!track) return null;
  try {
    const q = encodeURIComponent(`track:"${track}" artist:"${artist}"`);
    let r = await fetch(`https://api.deezer.com/search?q=${q}&limit=8`);
    let data = r.ok ? await r.json() : null;
    // Deezer's strict field search can miss; retry with a loose query.
    if (!data?.data?.length) {
      r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&limit=8`);
      data = r.ok ? await r.json() : null;
    }
    const rows: any[] = data?.data || [];
    const withPreview = rows.filter((x) => x.preview);
    if (!withPreview.length) return null;

    const nT = norm(track);
    const nA = norm(artist);
    const best =
      withPreview.find((x) => norm(x.title) === nT && norm(x.artist?.name) === nA) ||
      withPreview.find((x) => norm(x.title) === nT) ||
      withPreview[0];

    return {
      previewUrl: best.preview,
      durationSec: best.duration ?? null,
      source: "deezer",
      sourceUrl: best.link ?? null,
    };
  } catch {
    return null;
  }
}

/** iTunes search → 30s preview (m4p) + duration. Fallback only. */
export async function itunesPreview(track: string, artist: string): Promise<PreviewResult | null> {
  if (!track) return null;
  try {
    const term = encodeURIComponent(`${artist} ${track}`.trim());
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=8`);
    if (!r.ok) return null;
    const { results } = await r.json();
    const withPreview = (results || []).filter((x: any) => x.previewUrl);
    if (!withPreview.length) return null;
    const nT = norm(track);
    const best = withPreview.find((x: any) => norm(x.trackName) === nT) || withPreview[0];
    return {
      previewUrl: best.previewUrl,
      durationSec: best.trackTimeMillis ? Math.round(best.trackTimeMillis / 1000) : null,
      source: "itunes",
      sourceUrl: best.trackViewUrl ?? null,
    };
  } catch {
    return null;
  }
}

/** Resolve a browser-playable preview: Deezer (MP3) first, iTunes fallback. */
export async function resolvePreview(track: string, artist: string): Promise<PreviewResult | null> {
  return (await deezerPreview(track, artist)) || (await itunesPreview(track, artist));
}
