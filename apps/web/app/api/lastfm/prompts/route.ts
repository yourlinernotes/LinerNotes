import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { paletteFromString } from "@/lib/palette";

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

interface LastFmTrack {
  name: string;
  artist: { "#text": string };
  album: { "#text": string };
  image: Array<{ "#text": string; size: string }>;
  playcount?: string;
  mbid?: string;
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
 * GET /api/lastfm/prompts - Get "worth a note" prompts from Last.fm listening history
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Check if user has Last.fm connected
    const connection = await prisma.musicConnection.findUnique({
      where: {
        userId_service: {
          userId: user.id,
          service: "lastfm",
        },
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

    // Fetch recent tracks from Last.fm
    const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${connection.serviceUsername}&api_key=${apiKey}&format=json&limit=50`;

    const recentResponse = await fetch(recentTracksUrl);
    if (!recentResponse.ok) {
      throw new Error("Failed to fetch Last.fm recent tracks");
    }

    const recentData = await recentResponse.json();
    const tracks: LastFmTrack[] = recentData.recenttracks?.track || [];

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
    }

    // Generate prompts from top tracks (heavy repeat listens)
    const prompts: Prompt[] = [];
    const seenTracks = new Set<string>();

    // Priority 1: Tracks on heavy repeat (from top tracks of the week)
    for (const track of topTracks.slice(0, 10)) {
      const trackKey = `${track.artist["#text"]}::${track.name}`;
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const playCount = track.playcount ? parseInt(track.playcount) : 0;
      if (playCount < 3) continue; // Only show if played 3+ times

      const artworkUrl = track.image?.find((img) => img.size === "large" || img.size === "extralarge")?.["#text"] || "";
      const palette = paletteFromString(track.album?.["#text"] || track.name);

      prompts.push({
        id: `repeat-${trackKey}`,
        type: "repeat",
        track: track.name,
        artist: track.artist["#text"],
        album: track.album?.["#text"] || "",
        playCount,
        prompt: playCount >= 10
          ? `You've been playing this ${playCount} times.`
          : `On repeat this week.`,
        tag: playCount >= 10 ? "HEAVY ROTATION" : "ON REPEAT",
        artworkUrl,
        palette,
      });

      if (prompts.length >= 6) break; // Limit to 6 prompts
    }

    // Priority 2: Recently played unique tracks
    if (prompts.length < 6) {
      for (const track of tracks.slice(0, 20)) {
        const trackKey = `${track.artist["#text"]}::${track.name}`;
        if (seenTracks.has(trackKey)) continue;
        seenTracks.add(trackKey);

        const artworkUrl = track.image?.find((img) => img.size === "large" || img.size === "extralarge")?.["#text"] || "";
        const palette = paletteFromString(track.album?.["#text"] || track.name);

        prompts.push({
          id: `recent-${trackKey}`,
          type: "recent",
          track: track.name,
          artist: track.artist["#text"],
          album: track.album?.["#text"] || "",
          prompt: "You were just listening to this.",
          tag: "RECENT",
          artworkUrl,
          palette,
        });

        if (prompts.length >= 6) break;
      }
    }

    return NextResponse.json({ prompts });
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
