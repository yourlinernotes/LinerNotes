import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { paletteFromString } from "@/lib/palette";
import { extractPaletteFromUrl } from "@/lib/extractPaletteServer";

const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f"; // Last.fm's grey-star default

/**
 * Generate Last.fm API signature
 */
function generateSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return crypto.createHash("md5").update(sorted + secret).digest("hex");
}

// Highest-quality non-placeholder Last.fm image, or "".
function lastFmImage(images: Array<{ "#text": string; size: string }> | undefined): string {
  const u =
    images?.find((i) => i.size === "mega")?.["#text"] ||
    images?.find((i) => i.size === "extralarge")?.["#text"] ||
    images?.find((i) => i.size === "large")?.["#text"] ||
    images?.find((i) => i.size === "medium")?.["#text"] || "";
  return u && !u.includes(LASTFM_PLACEHOLDER) ? u : "";
}

interface LastFmTrack {
  name: string;
  artist: { "#text": string } | string;
  album: { "#text": string } | string;
  image: Array<{ "#text": string; size: string }>;
  playcount?: string;
  mbid?: string;
}

/**
 * Extract artist name from Last.fm track data (handles both string and object formats)
 */
function getArtistName(artist: any): string {
  if (!artist) return "";
  if (typeof artist === "string") return artist;
  if (artist.name) return artist.name; // For user.getTopTracks format
  if (artist["#text"]) return artist["#text"]; // For user.getRecentTracks format
  if (artist.mbid) return ""; // Has MBID but no name - shouldn't happen but return empty to skip
  return "";
}

/**
 * Extract album name from Last.fm track data (handles both string and object formats)
 */
function getAlbumName(album: any): string {
  if (!album) return "";
  if (typeof album === "string") return album;
  if (album.title) return album.title; // track.getinfo uses this
  if (album.name) return album.name; // Some API responses use this
  if (album["#text"]) return album["#text"]; // Most common format
  return "";
}

interface Prompt {
  id: string;
  type: string;
  track: string;
  artist: string;
  album: string;
  playCount?: number;
  prompt: string;
  tag: string;
  artworkUrl?: string;
  palette: {
    deep: string;
    mid: string;
    lo: string;
    accent: string;
    glow: string;
  };
}

/**
 * Fetch track info from Last.fm to get better artwork and album name
 */
async function fetchLastFmTrackInfo(track: string, artist: string, apiKey: string): Promise<{ artwork: string; album: string }> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const albumName = data.track?.album?.title || data.track?.album?.["#text"] || "";
      const artwork = lastFmImage(data.track?.album?.image);
      return { artwork, album: albumName };
    }
  } catch (error) {
    console.error("[Last.fm Prompts] track.getinfo error:", error);
  }
  return { artwork: "", album: "" };
}

/**
 * Fetch album info from Last.fm to get better artwork
 */
async function fetchLastFmAlbumInfo(album: string, artist: string, apiKey: string): Promise<string> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return lastFmImage(data.album?.image);
    }
  } catch (error) {
    console.error("[Last.fm Prompts] album.getinfo error:", error);
  }
  return "";
}

/**
 * Fetch album artwork from our music search (iTunes/MusicBrainz) when Last.fm
 * doesn't have it. NOTE: /api/music/search returns { results: [...] }.
 */
async function fetchFallbackArtwork(track: string, artist: string, album: string): Promise<string> {
  try {
    if (album) {
      const searchUrl = `${process.env.NEXTAUTH_URL}/api/music/search/albums?q=${encodeURIComponent(`${album} ${artist}`)}&limit=1`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]?.artworkUrl) return data.results[0].artworkUrl;
      }
    }

    if (track) {
      const trackSearchUrl = `${process.env.NEXTAUTH_URL}/api/music/search/tracks?q=${encodeURIComponent(`${track} ${artist}`)}&limit=1`;
      const res = await fetch(trackSearchUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]?.artworkUrl) return data.results[0].artworkUrl;
      }
    }
  } catch (error) {
    console.error("[Last.fm Prompts] Fallback artwork fetch error:", error);
  }

  return "";
}

/**
 * Resolve the best available cover for a track — Last.fm first, then our
 * iTunes/MusicBrainz search. (Deliberately no Spotify; its API is unusable.)
 * Mutates nothing; returns { artworkUrl, album } where album may be enriched
 * from track.getinfo when Last.fm's recent/top payload omitted it.
 */
async function resolveTrackArtwork(
  track: LastFmTrack,
  artistName: string,
  albumName: string,
  apiKey: string,
): Promise<{ artworkUrl: string; album: string }> {
  let artworkUrl = lastFmImage(track.image);
  let album = albumName;
  if (!artworkUrl || !album) {
    const info = await fetchLastFmTrackInfo(track.name, artistName, apiKey);
    if (!artworkUrl && info.artwork) artworkUrl = info.artwork;
    if (!album && info.album) album = info.album;
  }
  if (!artworkUrl && album) artworkUrl = await fetchLastFmAlbumInfo(album, artistName, apiKey);
  if (!artworkUrl) artworkUrl = await fetchFallbackArtwork(track.name, artistName, album);
  return { artworkUrl, album };
}

async function resolveAlbumArtwork(
  album: string,
  artistName: string,
  image: Array<{ "#text": string; size: string }> | undefined,
  apiKey: string,
): Promise<string> {
  let artworkUrl = lastFmImage(image);
  if (!artworkUrl) artworkUrl = await fetchLastFmAlbumInfo(album, artistName, apiKey);
  if (!artworkUrl) artworkUrl = await fetchFallbackArtwork("", artistName, album);
  return artworkUrl;
}

/**
 * GET /api/lastfm/prompts - Get "worth a note" prompts from Last.fm listening history
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Check if user has Last.fm connected
    const connection = await prisma.musicConnection.findFirst({
      where: {
        userId: user.id,
        service: "lastfm",
      },
    });

    if (!connection || !connection.sessionKey || !connection.serviceUsername) {
      return NextResponse.json({ prompts: [] });
    }

    const apiKey = process.env.LASTFM_API_KEY;
    const apiSecret = process.env.LASTFM_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Last.fm API not configured" },
        { status: 500 }
      );
    }

    // Fetch recent tracks from Last.fm (200 for more variety + album-listen detection)
    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=200`;

    const recentResponse = await fetch(recentTracksUrl);
    if (!recentResponse.ok) {
      throw new Error("Failed to fetch Last.fm recent tracks");
    }

    const recentData = await recentResponse.json();
    const tracks: LastFmTrack[] = recentData.recenttracks?.track || [];

    console.log("[Last.fm Prompts] Recent tracks count:", tracks.length);

    // Fetch user's existing reviews to filter out already-logged tracks/albums
    const existingReviews = await prisma.review.findMany({
      where: { userId: user.id },
      select: { trackName: true, trackArtist: true, trackAlbum: true },
    });
    const existingAlbumReviews = await prisma.albumReview.findMany({
      where: { userId: user.id },
      select: { albumName: true, albumArtist: true },
    });

    // Normalize artist+title into a comparison key that tolerates Last.fm vs
    // search naming differences (case, punctuation, "(feat …)", "(Remastered)").
    const normKey = (artist: string, title: string): string => {
      const clean = (s: string) =>
        (s || "")
          .toLowerCase()
          .replace(/\s*[([][^)\]]*[)\]]/g, "")              // drop (...) and [...]
          .replace(/\s+(feat|ft|featuring|with)\.?\s.*$/i, "") // drop "feat …" to end
          .replace(/[^a-z0-9]+/g, "");                       // strip remaining punctuation/space
      return `${clean(artist)}::${clean(title)}`;
    };

    const reviewedTracks = new Set(existingReviews.map((r) => normKey(r.trackArtist, r.trackName)));
    const reviewedAlbums = new Set(existingAlbumReviews.map((r) => normKey(r.albumArtist, r.albumName)));

    console.log("[Last.fm Prompts] Already reviewed:", reviewedTracks.size, "tracks,", reviewedAlbums.size, "albums");

    if (tracks.length === 0) {
      return NextResponse.json({ prompts: [] });
    }

    // Fetch top tracks to identify repeat listens
    const topTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=20&period=7day`;

    const topResponse = await fetch(topTracksUrl);
    let topTracks: LastFmTrack[] = [];
    if (topResponse.ok) {
      const topData = await topResponse.json();
      topTracks = topData.toptracks?.track || [];
      console.log("[Last.fm Prompts] Top tracks count:", topTracks.length);
    }

    // Detect recent album plays (consecutive tracks from same album = intentional album listen)
    const recentAlbumPlays: Array<{ album: string; artist: string; trackCount: number; image?: Array<{ "#text": string; size: string }> }> = [];
    const albumPlayMap = new Map<string, { artist: string; tracks: Set<string>; lastIndex: number; image?: Array<{ "#text": string; size: string }> }>();

    tracks.forEach((track, index) => {
      const albumName = getAlbumName(track.album);
      const artistName = getArtistName(track.artist);
      if (!albumName || !artistName) return;

      const albumKey = `${artistName}::${albumName}`;
      const existing = albumPlayMap.get(albumKey);

      // Count as album play if: (1) new album OR (2) within 10 tracks of last play (consecutive-ish)
      if (!existing || index - existing.lastIndex <= 10) {
        albumPlayMap.set(albumKey, {
          artist: artistName,
          tracks: existing?.tracks ? new Set([...existing.tracks, track.name]) : new Set([track.name]),
          lastIndex: index,
          image: track.image || existing?.image,
        });
      }
    });

    // Filter for albums with 3+ distinct tracks played (indicates a real album listen)
    albumPlayMap.forEach((data, albumKey) => {
      if (data.tracks.size >= 3) {
        const [, album] = albumKey.split("::");
        recentAlbumPlays.push({ album, artist: data.artist, trackCount: data.tracks.size, image: data.image });
      }
    });
    recentAlbumPlays.sort((a, b) => b.trackCount - a.trackCount);
    console.log("[Last.fm Prompts] Recent album plays detected:", recentAlbumPlays.length);

    // Fetch top albums for heavily-played albums (separate from recent plays)
    const topAlbumsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=20&period=7day`;

    const albumsResponse = await fetch(topAlbumsUrl);
    let topAlbums: Array<{ name: string; artist: { "#text": string } | string; playcount: string; image: Array<{ "#text": string; size: string }> }> = [];
    if (albumsResponse.ok) {
      const albumsData = await albumsResponse.json();
      topAlbums = albumsData.topalbums?.album || [];
      topAlbums.sort(() => Math.random() - 0.5); // shuffle for variety
      console.log("[Last.fm Prompts] Top albums count:", topAlbums.length);
    }

    // Prompt variations for variety
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

    const repeatCandidates: Prompt[] = [];
    const recentCandidates: Prompt[] = [];
    const albumCandidates: Prompt[] = [];
    const seenTracks = new Set<string>();
    const seenAlbums = new Set<string>();
    const albumsInPrompts = new Set<string>(); // one prompt per album in the carousel

    // Priority 1: Tracks on heavy repeat (from top tracks of the week) - up to 7.
    // Shuffle so the carousel varies instead of always showing the same top tracks.
    const shuffledTopTracks = [...topTracks].sort(() => Math.random() - 0.5);
    for (const track of shuffledTopTracks.slice(0, 20)) {
      const artistName = getArtistName(track.artist);

      if (!track.name || !artistName || track.name.trim() === "" || artistName.trim() === "") continue;

      const trackKey = `${artistName}::${track.name}`;
      if (reviewedTracks.has(normKey(artistName, track.name))) continue; // skip already-logged
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const playCount = track.playcount ? parseInt(track.playcount) : 0;
      if (playCount < 3) continue; // Only show if played 3+ times

      const { artworkUrl, album: albumName } = await resolveTrackArtwork(track, artistName, getAlbumName(track.album), apiKey);

      // One prompt per album in the carousel
      const albumDedupKey = `${artistName}::${albumName}`.toLowerCase();
      if (albumName && albumsInPrompts.has(albumDedupKey)) continue;
      if (albumName) albumsInPrompts.add(albumDedupKey);

      // Real colors from artwork (server-side, no CORS); fall back to seeded palette.
      const palette = (artworkUrl ? await extractPaletteFromUrl(artworkUrl) : null) || paletteFromString(albumName || track.name);

      const promptVariation = repeatPrompts[repeatCandidates.length % repeatPrompts.length];

      repeatCandidates.push({
        id: `repeat-${trackKey}`,
        type: "repeat",
        track: track.name,
        artist: artistName,
        album: albumName,
        playCount,
        prompt: promptVariation(playCount),
        tag: playCount >= 15 ? `HEAVY ROTATION ×${playCount}` : playCount >= 10 ? `ON HEAVY PLAY ×${playCount}` : `ON REPEAT ×${playCount}`,
        artworkUrl,
        palette,
      });

      if (repeatCandidates.length >= 7) break;
    }

    // Priority 2: Recently played unique tracks - up to 2 (one-offs carry less weight).
    // Last.fm returns recent newest-first; skip a now-playing entry so "JUST PLAYED" means it.
    const recentSample = tracks.filter((t) => !(t as { "@attr"?: { nowplaying?: string } })["@attr"]?.nowplaying).slice(0, 30);
    for (const track of recentSample) {
      const artistName = getArtistName(track.artist);

      if (!track.name || !artistName || track.name.trim() === "" || artistName.trim() === "") continue;

      const trackKey = `${artistName}::${track.name}`;
      if (reviewedTracks.has(normKey(artistName, track.name))) continue;
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const { artworkUrl, album: albumName } = await resolveTrackArtwork(track, artistName, getAlbumName(track.album), apiKey);

      const albumDedupKey = `${artistName}::${albumName}`.toLowerCase();
      if (albumName && albumsInPrompts.has(albumDedupKey)) continue;
      if (albumName) albumsInPrompts.add(albumDedupKey);

      const palette = (artworkUrl ? await extractPaletteFromUrl(artworkUrl) : null) || paletteFromString(albumName || track.name);

      const promptText = recentPrompts[recentCandidates.length % recentPrompts.length];

      recentCandidates.push({
        id: `recent-${trackKey}`,
        type: "recent",
        track: track.name,
        artist: artistName,
        album: albumName,
        prompt: promptText,
        tag: "JUST PLAYED",
        artworkUrl,
        palette,
      });

      if (recentCandidates.length >= 2) break;
    }

    // Priority 3: Top albums (heavily played) - 1, with a play-count tag.
    for (const album of topAlbums) {
      const artistName = getArtistName(album.artist);
      if (!album.name || !artistName || album.name.trim() === "" || artistName.trim() === "") continue;

      const albumKey = `${artistName}::${album.name}`;
      if (reviewedAlbums.has(normKey(artistName, album.name))) continue;
      if (seenAlbums.has(albumKey)) continue;
      seenAlbums.add(albumKey);

      const playCount = parseInt(album.playcount) || 0;
      if (playCount < 15) continue; // Only heavily-played albums

      const artworkUrl = await resolveAlbumArtwork(album.name, artistName, album.image, apiKey);
      const palette = (artworkUrl ? await extractPaletteFromUrl(artworkUrl) : null) || paletteFromString(album.name);

      albumCandidates.push({
        id: `album-top-${albumKey}`,
        type: "album",
        track: "",
        artist: artistName,
        album: album.name,
        playCount,
        prompt: albumPrompts[0](playCount),
        tag: `HEAVY ROTATION · ${playCount} PLAYS`,
        artworkUrl,
        palette,
      });

      break; // Only 1 top album
    }

    // Priority 4: Recent album plays (full-album listens) - up to 2 more.
    for (const albumPlay of recentAlbumPlays.slice(0, 10)) {
      const albumKey = `${albumPlay.artist}::${albumPlay.album}`;
      if (reviewedAlbums.has(normKey(albumPlay.artist, albumPlay.album))) continue;
      if (seenAlbums.has(albumKey)) continue;
      seenAlbums.add(albumKey);

      const artworkUrl = await resolveAlbumArtwork(albumPlay.album, albumPlay.artist, albumPlay.image, apiKey);
      const palette = (artworkUrl ? await extractPaletteFromUrl(artworkUrl) : null) || paletteFromString(albumPlay.album);

      const promptVariation = albumPrompts[albumCandidates.length % albumPrompts.length];

      albumCandidates.push({
        id: `album-${albumKey}`,
        type: "album",
        track: "",
        artist: albumPlay.artist,
        album: albumPlay.album,
        playCount: albumPlay.trackCount, // track count, not total plays
        prompt: promptVariation(albumPlay.trackCount),
        tag: albumPlay.trackCount >= 8 ? `FULL ALBUM LISTEN · ${albumPlay.trackCount} TRACKS` : albumPlay.trackCount >= 5 ? `ALBUM SESSION · ${albumPlay.trackCount} TRACKS` : `ALBUM SPIN · ${albumPlay.trackCount} TRACKS`,
        artworkUrl,
        palette,
      });

      if (albumCandidates.length >= 3) break; // 1 top album + up to 2 album-listens
    }

    // Shuffle each category so a refresh reorders within type
    const shuffleArray = <T,>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledRepeat = shuffleArray(repeatCandidates);
    const shuffledRecent = shuffleArray(recentCandidates);
    const shuffledAlbum = shuffleArray(albumCandidates);

    // Intersperse repeat, album, and recent prompts
    const prompts: Prompt[] = [];
    const maxLength = Math.max(shuffledRepeat.length, shuffledRecent.length, shuffledAlbum.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < shuffledRepeat.length) prompts.push(shuffledRepeat[i]);
      if (i < shuffledAlbum.length) prompts.push(shuffledAlbum[i]);
      if (i < shuffledRecent.length) prompts.push(shuffledRecent[i]);
    }

    console.log("[Last.fm Prompts] Final prompts count:", prompts.length);

    return NextResponse.json({ prompts }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Last.fm prompts error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}
