import crypto from "crypto";
import type { NowPlaying } from "./types";

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
const TOTP_VER = process.env.SPOTIFY_TOTP_VER || "5";

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

/** Mint a web-player access token from an sp_dc cookie. Null on any failure. */
async function mintToken(spDc: string): Promise<string | null> {
  const cached = tokenCache.get(spDc);
  if (cached && cached.expiresAt > Date.now() + 10_000) return cached.accessToken;
  if (!TOTP_SECRET_B32) return null; // feature not configured

  try {
    const secret = base32Decode(TOTP_SECRET_B32);
    // Use Spotify's server clock so the TOTP lines up with theirs.
    let ts = Date.now();
    try {
      const st = await fetch("https://open.spotify.com/server-time", {
        headers: { Cookie: `sp_dc=${spDc}` },
      });
      if (st.ok) {
        const j = await st.json();
        if (j?.serverTime) ts = Number(j.serverTime) * 1000;
      }
    } catch {
      /* fall back to local time */
    }

    const code = totp(secret, ts);
    const url =
      `https://open.spotify.com/get_access_token?reason=transport&productType=web_player` +
      `&totp=${code}&totpVer=${TOTP_VER}&ts=${ts}`;
    const r = await fetch(url, {
      headers: {
        Cookie: `sp_dc=${spDc}`,
        "User-Agent": "Mozilla/5.0",
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
