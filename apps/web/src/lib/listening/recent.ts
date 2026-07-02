// Provider-agnostic listening-prompt generator.
//
// The Last.fm prompts route (app/api/lastfm/prompts/route.ts) hand-rolls its
// prompt logic against Last.fm's payloads. This module lifts the SAME logic —
// heavy-rotation ("on repeat"), recent-unique ("just played"), and full-album
// cluster ("album listen") prompts, with the same copy and dedup rules — but
// works from a normalised RecentPlay[], so Spotify (sp_dc) and ListenBrainz can
// feed the exact same feed. Output matches the Prompt shape the web PromptShelf
// consumes.

import { paletteFromString, type Palette } from "@/lib/palette";
import { extractPaletteFromUrl } from "@/lib/extractPaletteServer";
import { resolveArtwork } from "@/lib/deezer";

/** A single play, normalised across providers. */
export interface RecentPlay {
  track: string;
  artist: string;
  album?: string;
  /** unix ms of the play, when known. */
  playedAt?: number;
  /** provider-supplied cover (Spotify gives this free), else null. */
  artworkUrl?: string | null;
  /** MusicBrainz recording id, when known. */
  mbid?: string | null;
}

/** The prompt object the web feed consumes (must match exactly). */
export interface Prompt {
  id: string;
  type: string;
  track: string;
  artist: string;
  album: string;
  playCount?: number;
  prompt: string;
  tag: string;
  artworkUrl?: string;
  palette: Palette;
}

// Normalise artist+title into a comparison key that tolerates naming
// differences (case, punctuation, "(feat …)", "(Remastered)"). Same as the
// Last.fm route so dedup sets line up across providers.
function normKey(artist: string, title: string): string {
  const clean = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/\s*[([][^)\]]*[)\]]/g, "")
      .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "")
      .replace(/[^a-z0-9]+/g, "");
  return `${clean(artist)}::${clean(title)}`;
}

// Prompt copy — kept identical to the Last.fm route's tone.
const repeatPrompts = [
  (pc: number) => pc >= 15
    ? `You've played this ${pc} times this week. What's pulling you back?`
    : pc >= 10
    ? `${pc} plays. This track is clearly doing something for you.`
    : pc >= 5
    ? `You keep coming back to this one. What's the moment that hits?`
    : `On rotation. Worth logging?`,
  (pc: number) => pc >= 15
    ? `${pc} spins this week. It's got you hooked—what is it?`
    : pc >= 10
    ? `This one's on lock. ${pc} plays and counting.`
    : pc >= 5
    ? `Can't get enough of this. What keeps you here?`
    : `Back in rotation. Ready to capture it?`,
  (pc: number) => pc >= 15
    ? `Heavy rotation alert. ${pc} plays—what's the story?`
    : pc >= 10
    ? `${pc} plays later, still hitting. Worth documenting?`
    : pc >= 5
    ? `This track owns you right now. What's it doing?`
    : `Spinning this one a lot lately.`,
];

const recentPrompts = [
  "Fresh in your queue. Anything worth saving?",
  "Just played. What stood out?",
  "Still thinking about this one?",
  "Catch this while it's fresh.",
  "You just heard this. What hit?",
  "Fresh play. Worth a note?",
];

const albumPrompts = [
  (pc: number) => pc >= 20
    ? `You've spun this album ${pc} times. What keeps pulling you back in?`
    : pc >= 10
    ? `${pc} plays this week. This album's got you. What's the hook?`
    : `You stayed with this one. What's still with you?`,
  (pc: number) => pc >= 20
    ? `${pc} album plays. It's clearly doing something for you.`
    : pc >= 10
    ? `This album keeps finding its way back. What is it about this one?`
    : `You finished it. Worth documenting?`,
  (pc: number) => pc >= 20
    ? `Heavy album rotation. ${pc} plays—what's the draw?`
    : pc >= 10
    ? `Can't seem to leave this album alone. What keeps you here?`
    : `Gave this the full listen. Anything stick?`,
];

/** Resolve the best cover: the play's own art first, else Deezer/iTunes search. */
async function resolveArt(play: { track: string; artist: string; artworkUrl?: string | null }): Promise<string> {
  if (play.artworkUrl) return play.artworkUrl;
  return (await resolveArtwork(play.track, play.artist)) || "";
}

/** Palette from artwork when we have a URL, else a seeded fallback. */
async function paletteFor(artworkUrl: string, seed: string): Promise<Palette> {
  return (artworkUrl ? await extractPaletteFromUrl(artworkUrl) : null) || paletteFromString(seed);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build feed prompts from normalised recent plays.
 * `plays` is newest-first. `top` (optional, e.g. Spotify short-term top tracks)
 * boosts heavy-rotation detection when the recent window is thin.
 */
export async function generatePrompts(
  plays: RecentPlay[],
  opts: { reviewedTracks: Set<string>; reviewedAlbums: Set<string>; top?: RecentPlay[] },
): Promise<Prompt[]> {
  const { reviewedTracks, reviewedAlbums, top = [] } = opts;
  if (!plays.length) return [];

  // Frequency of each track within the recent window (our play-count proxy).
  const freq = new Map<string, { play: RecentPlay; count: number }>();
  for (const p of plays) {
    if (!p.track || !p.artist) continue;
    const key = `${p.artist}::${p.track}`;
    const cur = freq.get(key);
    if (cur) cur.count += 1;
    else freq.set(key, { play: p, count: 1 });
  }

  // Fold in top tracks — count them as repeat signal even if the recent window
  // only shows them once (matches the Last.fm route surfacing weekly top tracks).
  for (const t of top) {
    if (!t.track || !t.artist) continue;
    const key = `${t.artist}::${t.track}`;
    const cur = freq.get(key);
    if (cur) cur.count = Math.max(cur.count, 3);
    else freq.set(key, { play: { ...t }, count: 3 });
  }

  const seenTracks = new Set<string>();
  const seenAlbums = new Set<string>();
  const albumsInPrompts = new Set<string>(); // one prompt per album in the carousel

  const repeatCandidates: Prompt[] = [];
  const recentCandidates: Prompt[] = [];
  const albumCandidates: Prompt[] = [];

  // Priority 1: heavy rotation — tracks most-repeated in the window (count >= 2),
  // up to 7. Shuffle within the eligible set for carousel variety.
  const heavy = shuffle(
    [...freq.values()].filter((e) => e.count >= 2).sort((a, b) => b.count - a.count),
  ).slice(0, 20);
  for (const { play, count } of heavy) {
    const trackKey = `${play.artist}::${play.track}`;
    if (reviewedTracks.has(normKey(play.artist, play.track))) continue;
    if (seenTracks.has(trackKey)) continue;
    seenTracks.add(trackKey);

    const artworkUrl = await resolveArt(play);
    const albumName = play.album || "";
    const albumDedupKey = `${play.artist}::${albumName}`.toLowerCase();
    if (albumName && albumsInPrompts.has(albumDedupKey)) continue;
    if (albumName) albumsInPrompts.add(albumDedupKey);

    const palette = await paletteFor(artworkUrl, albumName || play.track);
    const promptVariation = repeatPrompts[repeatCandidates.length % repeatPrompts.length];

    repeatCandidates.push({
      id: `repeat-${trackKey}`,
      type: "repeat",
      track: play.track,
      artist: play.artist,
      album: albumName,
      playCount: count,
      prompt: promptVariation(count),
      tag: count >= 15 ? `HEAVY ROTATION ×${count}` : count >= 10 ? `ON HEAVY PLAY ×${count}` : `ON REPEAT ×${count}`,
      artworkUrl,
      palette,
    });

    if (repeatCandidates.length >= 7) break;
  }

  // Priority 2: recently-played unique tracks — up to 2. Skip index 0 (likely
  // still playing) so "JUST PLAYED" means it actually just finished.
  const recentSample = plays.slice(1, 30);
  for (const play of recentSample) {
    if (!play.track || !play.artist) continue;
    const trackKey = `${play.artist}::${play.track}`;
    if (reviewedTracks.has(normKey(play.artist, play.track))) continue;
    if (seenTracks.has(trackKey)) continue;
    seenTracks.add(trackKey);

    const artworkUrl = await resolveArt(play);
    const albumName = play.album || "";
    const albumDedupKey = `${play.artist}::${albumName}`.toLowerCase();
    if (albumName && albumsInPrompts.has(albumDedupKey)) continue;
    if (albumName) albumsInPrompts.add(albumDedupKey);

    const palette = await paletteFor(artworkUrl, albumName || play.track);
    const promptText = recentPrompts[recentCandidates.length % recentPrompts.length];

    recentCandidates.push({
      id: `recent-${trackKey}`,
      type: "recent",
      track: play.track,
      artist: play.artist,
      album: albumName,
      prompt: promptText,
      tag: "JUST PLAYED",
      artworkUrl,
      palette,
    });

    if (recentCandidates.length >= 2) break;
  }

  // Priority 3: album clusters — 3+ distinct tracks from the same album within
  // ~10 consecutive plays (a real album listen).
  const albumPlayMap = new Map<
    string,
    { artist: string; album: string; tracks: Set<string>; lastIndex: number; artworkUrl?: string | null }
  >();
  plays.forEach((play, index) => {
    if (!play.album || !play.artist) return;
    const albumKey = `${play.artist}::${play.album}`;
    const existing = albumPlayMap.get(albumKey);
    if (!existing || index - existing.lastIndex <= 10) {
      albumPlayMap.set(albumKey, {
        artist: play.artist,
        album: play.album,
        tracks: existing?.tracks ? new Set([...existing.tracks, play.track]) : new Set([play.track]),
        lastIndex: index,
        artworkUrl: existing?.artworkUrl || play.artworkUrl,
      });
    }
  });

  const albumClusters = [...albumPlayMap.values()]
    .filter((d) => d.tracks.size >= 3)
    .sort((a, b) => b.tracks.size - a.tracks.size);

  for (const cluster of albumClusters.slice(0, 10)) {
    const albumKey = `${cluster.artist}::${cluster.album}`;
    if (reviewedAlbums.has(normKey(cluster.artist, cluster.album))) continue;
    if (seenAlbums.has(albumKey)) continue;
    seenAlbums.add(albumKey);

    const sampleTrack = [...cluster.tracks][0] || "";
    const artworkUrl = cluster.artworkUrl || (await resolveArtwork(sampleTrack, cluster.artist)) || "";
    const palette = await paletteFor(artworkUrl, cluster.album);
    const trackCount = cluster.tracks.size;
    const promptVariation = albumPrompts[albumCandidates.length % albumPrompts.length];

    albumCandidates.push({
      id: `album-${albumKey}`,
      type: "album",
      track: "",
      artist: cluster.artist,
      album: cluster.album,
      playCount: trackCount,
      prompt: promptVariation(trackCount),
      tag: trackCount >= 8 ? `FULL ALBUM LISTEN · ${trackCount} TRACKS` : trackCount >= 5 ? `ALBUM SESSION · ${trackCount} TRACKS` : `ALBUM SPIN · ${trackCount} TRACKS`,
      artworkUrl,
      palette,
    });

    if (albumCandidates.length >= 3) break;
  }

  // Intersperse repeat, album, and recent prompts (same weave as Last.fm route).
  const r = shuffle(repeatCandidates);
  const a = shuffle(albumCandidates);
  const c = shuffle(recentCandidates);
  const prompts: Prompt[] = [];
  const maxLength = Math.max(r.length, a.length, c.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < r.length) prompts.push(r[i]);
    if (i < a.length) prompts.push(a[i]);
    if (i < c.length) prompts.push(c[i]);
  }
  return prompts;
}
