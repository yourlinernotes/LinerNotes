/**
 * SoundCloud resolution — keyless / open (no API key, no user setup).
 *
 * SoundCloud's paid Data API is Artist-Pro gated, so like the open-source tools
 * (yt-dlp, spotdl) we use the *public* pieces:
 *
 *   1. `searchSoundCloudAlbum` — SoundCloud's own internal search (`api-v2`),
 *      authed with the public `client_id` the web player serves to every visitor
 *      (we fetch + cache + auto-refresh it). Finds the album's set even when the
 *      artist's handle is unguessable. Unofficial endpoint → fails soft.
 *   2. Odesli / song.link resolves a track we have an id/URL for → its SoundCloud
 *      URL, when one exists.
 *   3. A public track/set page carries track ids in its hydration payload.
 *
 * Every failure returns null and the caller falls back to a 30s preview. See
 * vault "SoundCloud Widget API".
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/605.1";
const ODESLI = "https://api.song.link/v1-alpha.1/links";

export interface SoundCloudResult {
  /** Canonical soundcloud.com/artist/track URL. */
  url: string;
  /** Numeric track id for the HTML5 Widget embed (`api.soundcloud.com/tracks/<id>`). */
  trackId: string;
}

export interface ResolveSoundCloudArgs {
  /** A source URL on any platform (spotify/itunes/etc.) — preferred input. */
  sourceUrl?: string;
  /** Or an id + platform Odesli understands (e.g. platform="spotify", id=<22char>). */
  id?: string;
  platform?: string;
  type?: "song" | "album";
  /** Track name + artist — used as a direct api-v2 search fallback when Odesli has no SC link. */
  track?: string;
  artist?: string;
  /** Known track duration (sec) — disambiguates short names in the search fallback. */
  durationSec?: number;
}

/** Ask Odesli for a track's SoundCloud URL, when it has one. */
async function odesliSoundCloudUrl(
  args: ResolveSoundCloudArgs,
): Promise<string | null> {
  const q = new URLSearchParams({ userCountry: "US" });
  if (args.sourceUrl) q.set("url", args.sourceUrl);
  else if (args.id && args.platform) {
    q.set("id", args.id);
    q.set("platform", args.platform);
    q.set("type", args.type ?? "song");
  } else {
    return null;
  }
  try {
    const r = await fetch(`${ODESLI}?${q}`, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.linksByPlatform?.soundcloud?.url ?? null;
  } catch {
    return null;
  }
}

/** Scrape the numeric track id from a public SoundCloud track page. */
async function scrapeTrackId(scUrl: string): Promise<string | null> {
  try {
    const r = await fetch(scUrl, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const html = await r.text();
    // App-link meta tags expose `sounds:<numeric id>`.
    const m = html.match(/sounds:(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export interface SoundCloudSetTrack {
  id: string;
  title: string | null;
}

/**
 * Read a SoundCloud set (album/playlist) URL → its ordered tracks. This is how
 * we get full-song playback for records auto-resolution can't find (the artist's
 * handle is unguessable): the author pastes the set link, we read the tracklist
 * from the page's hydration payload. A single track URL returns one track.
 */
export async function resolveSoundCloudSet(url: string): Promise<SoundCloudSetTrack[] | null> {
  if (!/soundcloud\.com\//.test(url)) return null;
  try {
    const r = await fetch(url.split("?")[0], { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
    if (m) {
      const hy = JSON.parse(m[1]);
      const playlist = hy.find((x: any) => x.hydratable === "playlist");
      if (playlist?.data?.tracks?.length) {
        return playlist.data.tracks.map((t: any) => ({
          id: String(t.id),
          title: t.title ?? null,
        }));
      }
      const single = hy.find((x: any) => x.hydratable === "sound");
      if (single?.data?.id) return [{ id: String(single.data.id), title: single.data.title ?? null }];
    }
    // Fallback: a lone track page exposes `sounds:<id>`.
    const one = html.match(/sounds:(\d+)/);
    return one ? [{ id: one[1], title: null }] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Keyless internal search (api-v2) — find an album's set from name + artist.
// ---------------------------------------------------------------------------

let cachedClientId: { id: string; at: number } | null = null;
const CLIENT_ID_TTL = 6 * 60 * 60 * 1000; // 6h

/**
 * The public `client_id` the SoundCloud web player uses. We read it from the
 * scripts SoundCloud serves to every visitor (same as yt-dlp), cache it, and
 * refresh when it stops working. Null if it can't be found.
 */
async function getClientId(force = false): Promise<string | null> {
  if (!force && cachedClientId && Date.now() - cachedClientId.at < CLIENT_ID_TTL) {
    return cachedClientId.id;
  }
  try {
    const home = await fetch("https://soundcloud.com/discover", { headers: { "User-Agent": UA } });
    const html = await home.text();
    const assets = [...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[\w-]+\.js/g)].map((m) => m[0]);
    // The id lives in one of the app bundles; check the last few (most likely).
    for (const url of assets.reverse()) {
      const js = await fetch(url, { headers: { "User-Agent": UA } }).then((r) => r.text());
      const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{28,})"/) || js.match(/\?client_id=([a-zA-Z0-9]{28,})/);
      if (m) {
        cachedClientId = { id: m[1], at: Date.now() };
        return m[1];
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** Strip "feat. ..." / "(feat ...)" before comparing track titles — SC formats features differently. */
const normTrack = (s: string) =>
  norm((s || "").replace(/\s*[\[(]?(feat\.?|ft\.?|with|x)\s[\s\S]*?([\])]|$)/i, "").trim());

const VARIANT = /\b(remix|live|edit|version|instrumental|acoustic|demo|cover|karaoke|remaster(ed)?|reprise|extended|sped|slowed)\b/i;

/**
 * Find a single track on SoundCloud by name + artist via api-v2 /search/tracks.
 * Used as the fallback when Odesli has no SoundCloud link for a track.
 *
 * Short names (title "3", artist "XO") can't be disambiguated by string matching
 * alone — but the track's *duration* is a strong signal that works no matter how
 * short the name is: among results titled "avatar", the one that's also the
 * right length and by an artist that matches is almost certainly correct. So we
 * pass the known duration (from the preview/Deezer) and score on
 * title + artist + duration, requiring a confident pairing rather than a length
 * floor. Returns `{ url, trackId }` or null.
 */
export async function searchSoundCloudTrack(
  track: string,
  artist: string,
  durationSec?: number,
): Promise<SoundCloudResult | null> {
  if (!track) return null;

  const run = async (clientId: string) => {
    const q = encodeURIComponent(`${artist} ${track}`.trim());
    const r = await fetch(
      `https://api-v2.soundcloud.com/search/tracks?q=${q}&limit=20&client_id=${clientId}`,
      { headers: { "User-Agent": UA } },
    );
    if (r.status === 401 || r.status === 403) return "reauth" as const;
    if (!r.ok) return null;
    return (await r.json())?.collection || [];
  };

  let clientId = await getClientId();
  if (!clientId) return null;
  let results = await run(clientId);
  if (results === "reauth") {
    clientId = await getClientId(true);
    if (!clientId) return null;
    results = await run(clientId);
  }
  if (!results || results === "reauth" || !Array.isArray(results)) return null;

  const wantTitle = normTrack(track);
  const wantArtist = norm(artist);
  const wantVariant = VARIANT.test(track);

  // "contains" is only meaningful for reasonably long strings; short strings
  // must match exactly (but exact IS allowed, so "3"/"xo" can still match).
  const FUZZY_MIN = 4;
  const contains = (a: string, b: string) =>
    !!a && !!b && Math.min(a.length, b.length) >= FUZZY_MIN && (a.includes(b) || b.includes(a));

  let best: any = null;
  let bestScore = -1;
  for (const t of results) {
    const rawTitle = t.title || "";
    // Re-uploads commonly format the title as "Artist - Title (feat. …)". Compare
    // both the whole title and the part after an "Artist - " prefix, so a title
    // like "DEAN - dayfly (ft. Sulli)" matches the track "dayfly" exactly.
    const seg = rawTitle.includes(" - ") ? rawTitle.split(" - ").slice(1).join(" - ") : rawTitle;
    const titleSeg = normTrack(seg);
    const titleFull = normTrack(rawTitle);
    const titleRaw = norm(rawTitle); // whole title incl. artist prefix, for artist-in-title

    const artistFields = [
      norm(t.user?.username || ""),
      norm(t.user?.permalink || ""),
      norm(t.publisher_metadata?.artist || ""),
    ].filter(Boolean);

    const titleExact = titleSeg === wantTitle || titleFull === wantTitle;
    const titleOk = titleExact || contains(titleSeg, wantTitle) || contains(titleFull, wantTitle);
    if (!titleOk) continue;

    const isVariant = VARIANT.test(rawTitle);
    if (isVariant && !wantVariant) continue;

    // Snippet-only (Go+ preview) tracks never give full playback in the widget.
    if (t.policy === "SNIP" || t.snipped) continue;

    const artistExact = !wantArtist || artistFields.some((a) => a === wantArtist);
    const artistLoose = !!wantArtist && artistFields.some((a) => contains(a, wantArtist));
    // The uploader is often a random fan account, but the artist name is in the
    // title ("DEAN - dayfly"). If the artist appears in the title text, that plus
    // a title match is high-confidence.
    const artistInTitle = wantArtist.length >= 3 && titleRaw.includes(wantArtist);
    const artistMatch = artistExact || artistLoose || artistInTitle;

    // Duration match — the length-agnostic disambiguator. SC `duration` is ms.
    const scSec = t.duration ? t.duration / 1000 : null;
    const durOk = !!durationSec && !!scSec && Math.abs(scSec - durationSec) <= 4;

    // Require a confident pairing so we never play a wrong song. A title match is
    // specific; combined with any artist signal (uploader, metadata, or the
    // artist named in the title) or a duration match, it's trustworthy.
    const confident =
      (titleOk && artistExact) ||
      (titleOk && artistInTitle) ||
      (titleExact && durOk) ||
      (artistMatch && durOk);
    if (!confident) continue;

    let score = 0;
    if (titleExact) score += 3;
    else if (titleOk) score += 1;
    if (artistExact) score += 3;
    else if (artistLoose) score += 2;
    else if (artistInTitle) score += 1;
    if (durOk) score += 3;
    // Prefer freely-streamable uploads — MONETIZE (Go+/label) tracks often use
    // encrypted HLS the anonymous widget can't play. Tie-break toward ALLOW.
    if (t.policy === "ALLOW") score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  if (!best) return null;
  return { url: best.permalink_url as string, trackId: String(best.id) };
}

export interface SoundCloudAlbum {
  /** The set/playlist permalink. */
  url: string;
  /** Ordered tracks with their numeric ids. */
  tracks: SoundCloudSetTrack[];
}

/**
 * Find an album's SoundCloud set by name + artist via the internal search, and
 * return its ordered tracks. Keyless. Null when nothing confident is found.
 */
export async function searchSoundCloudAlbum(
  album: string,
  artist: string,
): Promise<SoundCloudAlbum | null> {
  if (!album) return null;
  const run = async (clientId: string) => {
    const q = encodeURIComponent(`${artist} ${album}`.trim());
    const r = await fetch(
      `https://api-v2.soundcloud.com/search/playlists?q=${q}&limit=10&client_id=${clientId}`,
      { headers: { "User-Agent": UA } },
    );
    if (r.status === 401 || r.status === 403) return "reauth" as const;
    if (!r.ok) return null;
    return (await r.json())?.collection || [];
  };

  let clientId = await getClientId();
  if (!clientId) return null;
  let results = await run(clientId);
  if (results === "reauth") {
    clientId = await getClientId(true); // refresh a stale id and retry once
    if (!clientId) return null;
    results = await run(clientId);
  }
  if (!results || results === "reauth" || !Array.isArray(results)) return null;

  // Match the set strictly: artist + album title, reject remix/deluxe editions.
  const wantAlbum = norm(album);
  const wantArtist = norm(artist);
  const hit =
    results.find((pl: any) => {
      const title = norm(pl.title);
      const user = norm(pl.user?.username || pl.user?.permalink || "");
      const titleOk = title.includes(wantAlbum) || wantAlbum.includes(title);
      const artistOk = !wantArtist || user.includes(wantArtist) || wantArtist.includes(user);
      const variant = /remix|deluxe|instrumental|live/i.test(pl.title || "");
      return titleOk && artistOk && !variant;
    }) || null;
  if (!hit) return null;

  let tracks: SoundCloudSetTrack[] = (hit.tracks || [])
    .filter((t: any) => t?.id)
    .map((t: any) => ({ id: String(t.id), title: t.title ?? null }));
  // Search results sometimes carry only track stubs — read the set page for the
  // full ordered tracklist in that case.
  if (tracks.length < (hit.track_count || 0) || !tracks.length) {
    const full = await resolveSoundCloudSet(hit.permalink_url);
    if (full && full.length >= tracks.length) tracks = full;
  }
  if (!tracks.length) return null;
  return { url: hit.permalink_url, tracks };
}

/**
 * Resolve to a `{ url, trackId }` playable by the Widget, or null (→ preview).
 *
 * Resolution ladder:
 *   1. Direct SC URL passed in → scrape id.
 *   2. Odesli → SC URL → scrape id.
 *   3. api-v2 track search by name+artist (keyless, same as album search).
 */
export async function resolveSoundCloud(
  args: ResolveSoundCloudArgs,
): Promise<SoundCloudResult | null> {
  // If we were handed a soundcloud URL directly, skip Odesli.
  const direct =
    args.sourceUrl && /soundcloud\.com\//.test(args.sourceUrl)
      ? args.sourceUrl
      : null;
  const scUrl = direct ?? (await odesliSoundCloudUrl(args));

  if (scUrl) {
    const trackId = await scrapeTrackId(scUrl);
    if (trackId) return { url: scUrl.split("?")[0], trackId };
  }

  // Odesli had no SC link — try searching by track name + artist directly.
  if (args.track) {
    return searchSoundCloudTrack(args.track, args.artist || "", args.durationSec);
  }

  return null;
}
