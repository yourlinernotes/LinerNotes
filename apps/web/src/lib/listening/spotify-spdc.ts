import crypto from "crypto";
import type { NowPlaying } from "./types";
import type { RecentPlay } from "./recent";

/**
 * EXPERIMENTAL — Spotify now-playing WITHOUT the official API.
 *
 * Official Spotify OAuth is unusable for us (Feb 2026: dev mode capped at 5
 * users, Premium required, extended quota needs 250k MAU). This path rides the
 * user's own Spotify web-session cookie (`sp_dc`): mint an internal web-player
 * access token, then call the normal player endpoints. No client_id, no 5-user
 * cap. See vault note "Listening History & Scrobbling".
 *
 * ⚠️ BRITTLE: the token mint requires a time-based one-time code (TOTP) whose
 * secret Spotify rotates. Per the vault's "keep the fragile bit server-side,
 * hotfixable" guardrail, the secret is read from an env var — if Spotify rotates
 * it you update `SPOTIFY_TOTP_SECRET` (base32) in Vercel, no code release. When
 * the secret isn't configured this returns null (feature simply off).
 */

const TOTP_SECRET_B32 = process.env.SPOTIFY_TOTP_SECRET || ""; // base32, no padding
const TOTP_VER = process.env.SPOTIFY_TOTP_VER || "61";

/** Decode an unpadded base32 string to bytes. */
function base32Decode(s: string): Buffer {
  const alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = alph.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

/** RFC-6238 TOTP (HMAC-SHA1, 30s period, 6 digits) for a given unix-ms time. */
function totp(secret: Buffer, unixMs: number, period = 30, digits = 6): string {
  const counter = Math.floor(unixMs / 1000 / period);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

interface SpToken {
  accessToken: string;
  expiresAt: number;
}
// Tiny in-process token cache keyed by sp_dc (avoids re-minting each poll).
const tokenCache = new Map<string, SpToken>();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Mint a web-player access token from an sp_dc cookie. Null on any failure. */
async function mintToken(spDc: string): Promise<string | null> {
  const cached = tokenCache.get(spDc);
  if (cached && cached.expiresAt > Date.now() + 10_000) return cached.accessToken;
  if (!TOTP_SECRET_B32) return null; // feature not configured

  const secret = base32Decode(TOTP_SECRET_B32);

  // Current web-player flow (2026): GET open.spotify.com/api/token with a TOTP
  // whose secret Spotify rotates (env, hotfixable). For totpVer >= 10 the client
  // clock is fine — no server-time round-trip. Try "transport", then "init".
  const attempt = async (reason: "transport" | "init"): Promise<string | null> => {
    try {
      const ts = Date.now();
      const code = totp(secret, ts);
      const params = new URLSearchParams({
        reason,
        productType: "web-player",
        totp: code,
        totpServer: code,
        totpVer: TOTP_VER,
        cTime: String(ts),
      });
      const r = await fetch(`https://open.spotify.com/api/token?${params}`, {
        headers: {
          Cookie: `sp_dc=${spDc}`,
          "User-Agent": UA,
          Accept: "application/json",
          Referer: "https://open.spotify.com/",
          "App-Platform": "WebPlayer",
        },
      });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j?.accessToken) return null;
      tokenCache.set(spDc, {
        accessToken: j.accessToken,
        expiresAt: j.accessTokenExpirationTimestampMs || Date.now() + 55 * 60 * 1000,
      });
      return j.accessToken;
    } catch {
      return null;
    }
  };

  return (await attempt("transport")) || (await attempt("init"));
}

function toNowPlaying(item: any, isPlaying: boolean, at?: number): NowPlaying | null {
  if (!item) return null;
  const artist = (item.artists || []).map((a: any) => a.name).join(", ");
  return {
    track: item.name,
    artist,
    album: item.album?.name,
    // Spotify returns ISRC, not MBID — resolve to MBID later if needed.
    mbid: null,
    source: "spotify",
    isPlaying,
    at,
  };
}

/**
 * The user's current (or most recent) Spotify play via the sp_dc cookie.
 * Returns null when off/unconfigured/unauthorised (fails soft — never throws).
 */
export async function spotifySpDcNowPlaying(spDc: string): Promise<NowPlaying | null> {
  if (!spDc) return null;
  const token = await mintToken(spDc);
  if (!token) return null;
  const auth = { Authorization: `Bearer ${token}` };

  // 1. Currently playing (204 = nothing playing → fall through to recent).
  try {
    const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers: auth });
    if (r.ok && r.status !== 204) {
      const j = await r.json();
      if (j?.item) return toNowPlaying(j.item, !!j.is_playing);
    }
  } catch {
    /* try recent */
  }

  // 2. Most recent play.
  try {
    const r = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", { headers: auth });
    if (r.ok) {
      const j = await r.json();
      const play = j?.items?.[0];
      if (play?.track) {
        const at = play.played_at ? Math.floor(new Date(play.played_at).getTime() / 1000) : undefined;
        return toNowPlaying(play.track, false, at);
      }
    }
  } catch {
    /* none */
  }
  return null;
}

/** Normalise a Spotify track object into a RecentPlay. Album art comes free. */
function trackToRecentPlay(track: any, playedAt?: string): RecentPlay | null {
  if (!track?.name) return null;
  const artist = (track.artists || []).map((a: any) => a.name).join(", ");
  return {
    track: track.name,
    artist,
    album: track.album?.name || undefined,
    playedAt: playedAt ? new Date(playedAt).getTime() : undefined,
    artworkUrl: track.album?.images?.[0]?.url || null,
    // Spotify returns ISRC, not MBID.
    mbid: null,
  };
}

/**
 * The user's recently-played tracks via the sp_dc cookie (newest first).
 * Album art is captured from item.track.album.images[0].url. Fails soft to [].
 */
export async function spotifySpDcRecent(spDc: string, limit = 50): Promise<RecentPlay[]> {
  if (!spDc) return [];
  const token = await mintToken(spDc);
  if (!token) return [];
  try {
    const r = await fetch(
      `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return [];
    const j = await r.json();
    const items: any[] = j?.items || [];
    return items
      .map((it) => trackToRecentPlay(it.track, it.played_at))
      .filter((p): p is RecentPlay => p !== null);
  } catch {
    return [];
  }
}

/**
 * The user's short-term top tracks via the sp_dc cookie. May 403 if the minted
 * token lacks the scope — fails soft to [] in that case (and any other error).
 */
export async function spotifySpDcTopTracks(spDc: string, limit = 20): Promise<RecentPlay[]> {
  if (!spDc) return [];
  const token = await mintToken(spDc);
  if (!token) return [];
  try {
    const r = await fetch(
      `https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return []; // e.g. 403 missing scope
    const j = await r.json();
    const items: any[] = j?.items || [];
    return items
      .map((t) => trackToRecentPlay(t))
      .filter((p): p is RecentPlay => p !== null);
  } catch {
    return [];
  }
}
