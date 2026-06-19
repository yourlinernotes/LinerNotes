import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/music/search/tracks - Multi-source track search
 * Uses MusicBrainz (comprehensive) + iTunes for artwork/previews
 * Public endpoint (no auth required for search)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const results = [];
    const seenTracks = new Set<string>(); // Dedupe by artist+track

    // 1. Search iTunes first (more popular/mainstream results)
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
      const itunesResponse = await fetch(itunesUrl);

      if (itunesResponse.ok) {
        const itunesData = await itunesResponse.json();

        for (const track of itunesData.results || []) {
          const key = `${track.artistName.toLowerCase()}-${track.trackName.toLowerCase()}`;
          if (!seenTracks.has(key)) {
            seenTracks.add(key);
            results.push({
              id: track.trackId,
              name: track.trackName,
              artist: track.artistName,
              album: track.collectionName,
              artworkUrl: (track.artworkUrl100 || "").replace("100x100", "600x600"),
              previewUrl: track.previewUrl,
              releaseDate: track.releaseDate,
              duration: track.trackTimeMillis,
              genre: track.primaryGenreName,
              source: "itunes",
              score: 100, // iTunes results get highest priority
            });
          }
        }
      }
    } catch (itunesError) {
      console.error("iTunes search failed:", itunesError);
    }

    // 2. Fill gaps with MusicBrainz (indie/underground)
    if (results.length < limit) {
      try{
      const mbUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
      const mbResponse = await fetch(mbUrl, {
        headers: { "User-Agent": "LinerNotes/1.0 (contact@linernotes.app)" },
      });

      if (mbResponse.ok) {
        const mbData = await mbResponse.json();
        const recordings = mbData.recordings || [];

        for (const rec of recordings) {
          if (rec["artist-credit"]?.[0]?.name) {
            const key = `${rec["artist-credit"][0].name.toLowerCase()}-${rec.title.toLowerCase()}`;
            if (!seenTracks.has(key)) {
              seenTracks.add(key);

              // Get album info from first release
              const release = rec.releases?.[0];
              const albumArtUrl = release?.id
                ? `https://coverartarchive.org/release/${release.id}/front-500`
                : null;

              results.push({
                id: rec.id,
                name: rec.title,
                artist: rec["artist-credit"][0].name,
                album: release?.title || "",
                artworkUrl: albumArtUrl,
                previewUrl: null,
                releaseDate: release?.date,
                duration: rec.length,
                genre: null,
                source: "musicbrainz",
                score: rec.score || 50, // MusicBrainz has relevance scores
              });
            }
          }
        }
      }
    } catch (mbError) {
      console.error("MusicBrainz search failed:", mbError);
    }
  }

    return NextResponse.json({
      results: results.slice(0, limit),
      count: results.length,
    });
  } catch (error) {
    console.error("Track search error:", error);
    return NextResponse.json(
      { error: "Failed to search tracks" },
      { status: 500 }
    );
  }
}
