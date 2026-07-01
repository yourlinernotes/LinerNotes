/**
 * Preview resolution — Deezer first, iTunes fallback.
 *
 * Why Deezer: iTunes 30s previews are served as `audio/x-m4p`, which browsers
 * frequently can't decode in a plain <audio> (they stall at readyState 0 → the
 * play button looks active but no sound). Deezer previews are plain **MP3
 * (audio/mpeg)**, which every browser plays. So for the web player we resolve
 * Deezer first and only fall back to iTunes when Deezer has no match.
 *
 * Matching is STRICT — for an obscure artist a fuzzy search returns other
 * artists' songs and remixes. We require the artist to match and the wanted
 * title's words to be present, and we reject remix/live/edit variants unless the
 * review itself asked for one. If nothing is confident we return null (the
 * caller shows "unavailable") rather than play the wrong song.
 */

export interface PreviewResult {
  previewUrl: string;
  durationSec: number | null;
  source: "deezer" | "itunes";
  /** A canonical track URL Odesli can resolve to SoundCloud, when known. */
  sourceUrl?: string | null;
}

/** A provider result normalised for matching. */
interface Candidate {
  title: string;
  artist: string;
  previewUrl: string | null;
  durationSec: number | null;
  sourceUrl: string | null;
}

const VARIANT =
  /\b(remix|live|edit|version|instrumental|acoustic|demo|cover|karaoke|remaster(ed)?|reprise|extended|radio|sped|slowed|mix)\b/i;

/** Word tokens of a string (lowercased, punctuation → spaces). */
function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Artist match: every word of the wanted artist appears in the candidate's. */
function artistOk(candidateArtist: string, wantArtist: string): boolean {
  const w = tokens(wantArtist);
  if (!w.length) return true; // no artist to check against
  const c = new Set(tokens(candidateArtist));
  return w.every((t) => c.has(t));
}

/**
 * Pick the best candidate for `wantTitle`/`wantArtist`, or null.
 * Scoring: artist must match; the wanted title's words must all be present;
 * fewer *extra* words wins (so an exact title beats a longer variant); a
 * remix/live/etc. candidate is rejected unless the wanted title is itself one.
 */
function pickBest(cands: Candidate[], wantTitle: string, wantArtist: string): Candidate | null {
  const wt = tokens(wantTitle);
  const wtSet = new Set(wt);
  const wantVariant = VARIANT.test(wantTitle);
  let best: Candidate | null = null;
  let bestScore = -1;

  for (const c of cands) {
    if (!c.previewUrl) continue;
    if (!artistOk(c.artist, wantArtist)) continue;

    const ct = tokens(c.title);
    const ctSet = new Set(ct);
    // The wanted title's words must all be present.
    if (!wt.every((t) => ctSet.has(t))) continue;
    // Reject remixes/live/etc. unless the review asked for that variant.
    if (VARIANT.test(c.title) && !wantVariant) continue;

    const extra = ct.filter((t) => !wtSet.has(t)).length;
    const score = 100 - extra * 10; // exact title (no extra words) scores highest
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

async function deezerCandidates(track: string, artist: string): Promise<Candidate[]> {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(`${track} ${artist}`.trim())}&limit=25`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const rows: any[] = (await r.json())?.data || [];
  return rows.map((x) => ({
    title: x.title,
    artist: x.artist?.name || "",
    previewUrl: x.preview || null,
    durationSec: x.duration ?? null,
    sourceUrl: x.link ?? null,
  }));
}

async function itunesCandidates(track: string, artist: string): Promise<Candidate[]> {
  const term = encodeURIComponent(`${artist} ${track}`.trim());
  const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=25`);
  if (!r.ok) return [];
  const rows: any[] = (await r.json())?.results || [];
  return rows.map((x) => ({
    title: x.trackName,
    artist: x.artistName || "",
    previewUrl: x.previewUrl || null,
    durationSec: x.trackTimeMillis ? Math.round(x.trackTimeMillis / 1000) : null,
    sourceUrl: x.trackViewUrl ?? null,
  }));
}

async function resolveFrom(
  fetcher: (t: string, a: string) => Promise<Candidate[]>,
  source: "deezer" | "itunes",
  track: string,
  artist: string,
): Promise<PreviewResult | null> {
  try {
    const best = pickBest(await fetcher(track, artist), track, artist);
    if (!best || !best.previewUrl) return null;
    return { previewUrl: best.previewUrl, durationSec: best.durationSec, source, sourceUrl: best.sourceUrl };
  } catch {
    return null;
  }
}

/** Resolve a browser-playable preview: Deezer (MP3) first, iTunes fallback. */
export async function resolvePreview(track: string, artist: string): Promise<PreviewResult | null> {
  if (!track) return null;
  return (
    (await resolveFrom(deezerCandidates, "deezer", track, artist)) ||
    (await resolveFrom(itunesCandidates, "itunes", track, artist))
  );
}
