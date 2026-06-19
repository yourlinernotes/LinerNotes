import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/music/search/albums - Multi-source album search
 * Uses MusicBrainz (comprehensive) + Cover Art Archive + iTunes fallback
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
    const seenAlbums = new Set<string>(); // Dedupe by artist+album

    // 1. Search MusicBrainz first (comprehensive, indie/underground coverage)
    try {
      const mbUrl = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
      const mbResponse = await fetch(mbUrl, {
        headers: { "User-Agent": "LinerNotes/1.0 (contact@linernotes.app)" },
      });

      if (mbResponse.ok) {
        const mbData = await mbResponse.json();
        const releaseGroups = mbData["release-groups"] || [];

        for (const rg of releaseGroups) {
          if (rg["primary-type"] === "Album" && rg["artist-credit"]?.[0]?.name) {
            const key = `${rg["artist-credit"][0].name.toLowerCase()}-${rg.title.toLowerCase()}`;
            if (!seenAlbums.has(key)) {
              seenAlbums.add(key);
              results.push({
                id: rg.id,
                name: rg.title,
                artist: rg["artist-credit"][0].name,
                artworkUrl: `https://coverartarchive.org/release-group/${rg.id}/front-500`,
                releaseDate: rg["first-release-date"],
                trackCount: null,
                genre: null,
                source: "musicbrainz",
                score: rg.score || 100, // MusicBrainz results get highest priority
              });
            }
          }
        }
      }
    } catch (mbError) {
      console.error("MusicBrainz search failed:", mbError);
    }

    // 2. Fill gaps with iTunes (mainstream/popular)
    if (results.length < limit) {
      try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=${limit}`;
        const itunesResponse = await fetch(itunesUrl);

        if (itunesResponse.ok) {
          const itunesData = await itunesResponse.json();

          for (const album of itunesData.results || []) {
            const key = `${album.artistName.toLowerCase()}-${album.collectionName.toLowerCase()}`;
            if (!seenAlbums.has(key)) {
              seenAlbums.add(key);
              results.push({
                id: album.collectionId,
                name: album.collectionName,
                artist: album.artistName,
                artworkUrl: (album.artworkUrl100 || "").replace("100x100", "600x600"),
                releaseDate: album.releaseDate,
                trackCount: album.trackCount,
                genre: album.primaryGenreName,
                source: "itunes",
                score: 50, // iTunes results as fallback
              });
            }
          }
        }
      } catch (itunesError) {
        console.error("iTunes search failed:", itunesError);
      }
    }

    return NextResponse.json({
      results: results.slice(0, limit),
      count: results.length,
    });
  } catch (error) {
    console.error("Album search error:", error);
    return NextResponse.json(
      { error: "Failed to search albums" },
      { status: 500 }
    );
  }
}
