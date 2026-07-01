import type { NowPlaying } from "./types";

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
