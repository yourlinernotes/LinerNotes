/**
 * SoundCloud track resolution — keyless, best-effort.
 *
 * We can't use SoundCloud's Data API (paid Artist-Pro gated) and we deliberately
 * do NOT scrape a `client_id` for the private api-v2 (brittle + credential-y).
 * Instead we use the *public* pieces only:
 *
 *   1. Odesli / song.link (already used elsewhere in the app) resolves a track we
 *      have an id/URL for → its `linksByPlatform.soundcloud.url`, when one exists.
 *   2. That public track page carries the numeric track id in an app-link meta
 *      tag (`android-app://…/sounds:<id>` / `soundcloud://sounds:<id>`) — the
 *      documented "wreardle" pattern. We scrape just that number.
 *
 * The numeric id is what the HTML5 Widget needs (`.../tracks/<id>`). Coverage is
 * uneven (indie-strong, mainstream/embed-restricted gaps) — every failure returns
 * null and the caller falls back to a 30s preview. See vault "SoundCloud Widget API".
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

/**
 * Resolve to a `{ url, trackId }` playable by the Widget, or null (→ preview).
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
  if (!scUrl) return null;

  const trackId = await scrapeTrackId(scUrl);
  if (!trackId) return null;

  // Strip Odesli's tracking params for a clean canonical URL.
  const clean = scUrl.split("?")[0];
  return { url: clean, trackId };
}
