/**
 * GET /api/img?url=<image url>
 *
 * Same-origin image proxy for album covers. Cover hosts (mzstatic, coverartarchive,
 * lastfm, i.scdn) don't send CORS headers and some are flaky — proxying them makes
 * every cover load reliably (same-origin, no CORS, no mixed-content) AND lets
 * palette extraction read the pixels without a tainted canvas. Streams the bytes
 * with a hard cache. Fails to 502 so <img onError> can fall back to the palette block.
 *
 * SSRF hardening: only fetch known cover-art hosts, reject private/loopback/
 * link-local/metadata IPs, and never follow redirects (which could point at an
 * internal target).
 */
export const runtime = "nodejs";

import dns from "dns/promises";
import net from "net";
import https from "https";
import type { LookupFunction } from "net";

// Cover-art CDNs actually used by the app (iTunes/Apple, MusicBrainz Cover Art
// Archive, Deezer, Spotify, Last.fm). Match is on exact host or a subdomain.
// Kept narrow: `fastly.net`/`archive.org` are shared multi-tenant CDNs, so we
// pin the specific sub-suffixes rather than admitting every tenant.
const ALLOWED_HOST_SUFFIXES = [
  "mzstatic.com",             // Apple / iTunes artwork (is1-ssl.mzstatic.com, …)
  "coverartarchive.org",      // MusicBrainz Cover Art Archive
  "us.archive.org",           // Cover Art Archive storage (ia*.us.archive.org)
  "scdn.co",                  // Spotify (i.scdn.co)
  "dzcdn.net",                // Deezer artwork (e-cdns-images.dzcdn.net, …)
  "freetls.fastly.net",       // Last.fm images (lastfm.freetls.fastly.net)
];

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith(`.${suffix}`)
  );
}

/** Reject loopback / private / link-local / metadata / unique-local ranges. */
function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b, c] = p;
    if (a === 0 || a === 127) return true;           // 0.0.0.0/8, 127.0.0.0/8
    if (a === 10) return true;                        // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 (IETF proto)
    if (a === 169 && b === 254) return true;          // 169.254.0.0/16 (incl. metadata)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    return false;
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase();
    if (ip6 === "::1" || ip6 === "::") return true;  // loopback / unspecified
    if (ip6.startsWith("fe80")) return true;         // link-local
    if (ip6.startsWith("fc") || ip6.startsWith("fd")) return true; // fc00::/7 ULA
    // IPv4-mapped — dotted (::ffff:a.b.c.d) or hex (::ffff:7f00:1) form.
    const mappedDotted = ip6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPrivateAddress(mappedDotted[1]);
    const mappedHex = ip6.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    return false;
  }
  // Unknown/unparseable — treat as unsafe.
  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("url") || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return new Response("bad url", { status: 400 });
  }
  // Prefer https, but the server can fetch http too (no mixed-content rule server-side).
  const url = raw.replace(/^http:\/\//i, "https://");

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return new Response("bad url", { status: 400 });
  }

  // Host allowlist.
  if (!hostAllowed(hostname)) {
    return new Response("host not allowed", { status: 400 });
  }

  // Resolve the hostname and reject if ANY resolved address is private/internal.
  // Keep the validated address(es) and PIN the connection to them below, so the
  // TLS/TCP layer can't independently re-resolve to an internal target
  // (DNS-rebinding / TOCTOU) between this check and the fetch.
  let pinnedAddrs: { address: string; family: number }[];
  try {
    if (net.isIP(hostname)) {
      if (isPrivateAddress(hostname)) {
        return new Response("host not allowed", { status: 400 });
      }
      pinnedAddrs = [{ address: hostname, family: net.isIP(hostname) }];
    } else {
      const addrs = await dns.lookup(hostname, { all: true });
      if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
        return new Response("host not allowed", { status: 400 });
      }
      pinnedAddrs = addrs;
    }
  } catch {
    return new Response("host not allowed", { status: 400 });
  }

  // Custom lookup that only ever returns the pre-validated address(es) — the
  // connection cannot reach any host we didn't just clear.
  const pinnedLookup: LookupFunction = (_host, options, cb) => {
    if ((options as { all?: boolean }).all) {
      (cb as (e: Error | null, a: { address: string; family: number }[]) => void)(
        null,
        pinnedAddrs
      );
    } else {
      cb(null, pinnedAddrs[0].address, pinnedAddrs[0].family);
    }
  };

  try {
    const result = await new Promise<
      { status: number; contentType: string; body: Buffer } | { error: true }
    >((resolve) => {
      const req = https.get(
        url,
        {
          lookup: pinnedLookup,
          headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" },
          timeout: 9000,
        },
        (res) => {
          const status = res.statusCode ?? 502;
          // A redirect status means the upstream wants us elsewhere — refuse
          // (following it could re-point at an internal host). Don't auto-follow.
          if (status >= 300 && status < 400) {
            res.destroy();
            return resolve({ status: 502, contentType: "", body: Buffer.alloc(0) });
          }
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () =>
            resolve({
              status,
              contentType: res.headers["content-type"] || "image/jpeg",
              body: Buffer.concat(chunks),
            })
          );
          res.on("error", () => resolve({ error: true }));
        }
      );
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve({ error: true }));
    });

    if ("error" in result) return new Response("fetch failed", { status: 502 });
    if (result.status >= 300 && result.status < 400) {
      return new Response("redirect refused", { status: 502 });
    }
    if (result.status < 200 || result.status >= 300) {
      return new Response("upstream", { status: 502 });
    }
    if (!result.contentType.startsWith("image/")) {
      return new Response("not an image", { status: 502 });
    }
    return new Response(new Uint8Array(result.body), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
