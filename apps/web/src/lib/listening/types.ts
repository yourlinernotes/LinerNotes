// Listening-history layer — see vault note "Listening History & Scrobbling".
// Normalised shape for "what is this user playing", across sources, keyed on
// MusicBrainz IDs (the canonical cross-service key that fixes our matching pain).

export type ListenSource = "spotify" | "listenbrainz" | "lastfm";

export interface NowPlaying {
  track: string;
  artist: string;
  album?: string;
  /** MusicBrainz recording id — canonical key (ListenBrainz gives this free). */
  mbid?: string | null;
  source: ListenSource;
  /** true = live scrobble right now; false = most-recent play. */
  isPlaying: boolean;
  /** unix seconds of the listen, when known. */
  at?: number;
}

/** Each source implements this so the route can dispatch uniformly. */
export interface ListenAdapter {
  getNowPlaying(opts: { username?: string; token?: string }): Promise<NowPlaying | null>;
}
