import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/albums/[id] - Get album details with full tracklist
 * Supports both MusicBrainz (UUID) and iTunes (numeric) IDs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params;

  if (!albumId) {
    return NextResponse.json(
      { error: "Album ID is required" },
      { status: 400 }
    );
  }

  // Determine if ID is MusicBrainz (UUID format) or iTunes (numeric)
  const isMusicBrainz = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(albumId);

  try {
    if (isMusicBrainz) {
      // Fetch from MusicBrainz
      // Step 1: Get release-group to find the primary release
      const rgUrl = `https://musicbrainz.org/ws/2/release-group/${albumId}?inc=releases&fmt=json`;
      const rgResponse = await fetch(rgUrl, {
        headers: { "User-Agent": "LinerNotes/1.0 (contact@linernotes.app)" },
      });

      if (!rgResponse.ok) {
        throw new Error(`MusicBrainz API returned ${rgResponse.status}`);
      }

      const rgData = await rgResponse.json();

      // Get the first official release
      const release = rgData.releases?.find((r: any) => r.status === "Official") || rgData.releases?.[0];

      if (!release) {
        throw new Error("No releases found for this album");
      }

      // Step 2: Get full release details with recordings
      const releaseUrl = `https://musicbrainz.org/ws/2/release/${release.id}?inc=recordings+artist-credits&fmt=json`;
      const releaseResponse = await fetch(releaseUrl, {
        headers: { "User-Agent": "LinerNotes/1.0 (contact@linernotes.app)" },
      });

      if (!releaseResponse.ok) {
        throw new Error(`MusicBrainz release API returned ${releaseResponse.status}`);
      }

      const releaseData = await releaseResponse.json();

      // Extract tracks from all media
      const allTracks: any[] = [];
      let trackNumber = 1;

      for (const media of releaseData.media || []) {
        for (const track of media.tracks || []) {
          allTracks.push({
            trackId: track.recording.id,
            trackNumber: trackNumber++,
            title: track.recording.title || track.title,
            artist: track.recording["artist-credit"]?.[0]?.name ||
                   releaseData["artist-credit"]?.[0]?.name ||
                   "Unknown Artist",
            duration: track.recording.length || track.length, // in milliseconds
            previewUrl: null, // MusicBrainz doesn't provide preview URLs
          });
        }
      }

      return NextResponse.json({
        album: {
          albumId: albumId,
          name: rgData.title,
          artist: releaseData["artist-credit"]?.[0]?.name || "Unknown Artist",
          artworkUrl: `https://coverartarchive.org/release-group/${albumId}/front-500`,
          releaseDate: rgData["first-release-date"],
          totalTracks: allTracks.length,
          tracks: allTracks.map((track: any) => ({
            trackId: track.trackId,
            name: track.title,
            artist: track.artist,
            album: rgData.title,
            artworkUrl: `https://coverartarchive.org/release-group/${albumId}/front-500`,
            previewUrl: track.previewUrl,
          })),
        },
      });
    } else {
      // Fetch from iTunes
      const itunesUrl = `https://itunes.apple.com/lookup?id=${albumId}&entity=song`;
      const response = await fetch(itunesUrl);

      if (!response.ok) {
        throw new Error(`iTunes API returned ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      // First result is the album itself, rest are tracks
      const albumData = results[0];
      const tracks = results.slice(1);

      return NextResponse.json({
        album: {
          albumId: albumData.collectionId,
          name: albumData.collectionName,
          artist: albumData.artistName,
          artworkUrl: (albumData.artworkUrl100 || "").replace("100x100", "600x600"),
          releaseDate: albumData.releaseDate,
          totalTracks: albumData.trackCount,
          tracks: tracks.map((track: any, index: number) => ({
            trackId: track.trackId,
            name: track.trackName,
            artist: track.artistName,
            album: albumData.collectionName,
            artworkUrl: (albumData.artworkUrl100 || "").replace("100x100", "600x600"),
            previewUrl: track.previewUrl,
          })),
        },
      });
    }
  } catch (error) {
    console.error("Album tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album tracks" },
      { status: 500 }
    );
  }
}
