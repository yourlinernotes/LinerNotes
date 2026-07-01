import type { NowPlaying } from "./types";

/**
 * EXPERIMENTAL — Spotify now-playing WITHOUT the official API.
 *
 * Official Spotify OAuth is unusable for us (Feb 2026: dev mode capped at 5
 * users, Premium required, extended quota needs 250k MAU). This path rides the
 * user's own Spotify web-session cookie (`sp_dc`) → mint an internal web-player
 * token → call the internal now-playing endpoint. No client_id, no 5-user cap.
 *
 * ⚠️ BRITTLE: Spotify added a rotating TOTP to the token exchange in 2025, so
 * this breaks whenever they change it. Fence behind an opt-in flag, keep it
 * server-side (hotfixable without an app release), and NEVER let it gate the
 * rating floor. See vault note "Listening History & Scrobbling".
 *
 * TODO:
 *  - exchange `sp_dc` -> web access token (compute the TOTP)
 *  - GET https://api.spotify.com/v1/me/player/currently-playing with that token
 *  - capture `sp_dc` via an in-app WebView Spotify login (mobile)
 *  - persist the cookie on MusicConnection (needs a schema field) or session store
 */
export async function spotifySpDcNowPlaying(_spDc: string): Promise<NowPlaying | null> {
  // Not implemented yet — experimental scaffold.
  return null;
}
