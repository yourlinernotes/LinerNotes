import type { NowPlaying } from "./types";
import type { RecentPlay } from "./recent";

// ListenBrainz (MetaBrainz) — open, KEYLESS reads, returns MusicBrainz IDs.
// Docs: https://listenbrainz.readthedocs.io/en/latest/users/api/
// This adapter is fully implemented (verified live) — it's our durable layer.

function toNowPlaying(listen: any, isPlaying: boolean): NowPlaying {
  const m = listen?.track_metadata ?? {};
  return {
    track: m.track_name ?? "",
    artist: m.artist_name ?? "",
    album: m.release_name || undefined,
    mbid: m?.mbid_mapping?.recording_mbid ?? null,
    source: "listenbrainz",
    isPlaying,
    at: listen?.listened_at ?? undefined,
  };
}

/** Current play (playing-now) or, failing that, the most recent listen. */
export async function listenBrainzNowPlaying(username: string): Promise<NowPlaying | null> {
  const base = `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}`;
  try {
    const live = await fetch(`${base}/playing-now`, { cache: "no-store" });
    if (live.ok) {
      const l = (await live.json())?.payload?.listens?.[0];
      if (l) return toNowPlaying(l, true);
    }
    const recent = await fetch(`${base}/listens?count=1`, { cache: "no-store" });
    if (recent.ok) {
      const l = (await recent.json())?.payload?.listens?.[0];
      if (l) return toNowPlaying(l, false);
    }
  } catch {
    /* fail soft */
  }
  return null;
}

/**
 * The user's recent listens (newest first), normalised to RecentPlay.
 * Includes recording_mbid when present. Keyless read. Fails soft to [].
 */
export async function listenBrainzRecent(username: string, limit = 100): Promise<RecentPlay[]> {
  if (!username) return [];
  const base = `https://api.listenbrainz.org/1/user/${encodeURIComponent(username)}`;
  try {
    const r = await fetch(`${base}/listens?count=${limit}`, { cache: "no-store" });
    if (!r.ok) return [];
    const listens: any[] = (await r.json())?.payload?.listens || [];
    return listens
      .map((l): RecentPlay | null => {
        const m = l?.track_metadata ?? {};
        if (!m.track_name) return null;
        return {
          track: m.track_name,
          artist: m.artist_name ?? "",
          album: m.release_name || undefined,
          playedAt: l?.listened_at ? l.listened_at * 1000 : undefined,
          artworkUrl: null,
          mbid: m?.mbid_mapping?.recording_mbid ?? null,
        };
      })
      .filter((p): p is RecentPlay => p !== null);
  } catch {
    return [];
  }
}
