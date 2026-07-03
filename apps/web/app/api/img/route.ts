/**
 * GET /api/img?url=<image url>
 *
 * Same-origin image proxy for album covers. Cover hosts (mzstatic, coverartarchive,
 * lastfm, i.scdn) don't send CORS headers and some are flaky — proxying them makes
 * every cover load reliably (same-origin, no CORS, no mixed-content) AND lets
 * palette extraction read the pixels without a tainted canvas. Streams the bytes
 * with a hard cache. Fails to 502 so <img onError> can fall back to the palette block.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("url") || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return new Response("bad url", { status: 400 });
  }
  // Prefer https, but the server can fetch http too (no mixed-content rule server-side).
  const url = raw.replace(/^http:\/\//i, "https://");

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });
    // If the https upgrade failed on an http-only host, retry the original.
    const resp = r.ok ? r : url !== raw ? await fetch(raw, { redirect: "follow", signal: AbortSignal.timeout(9000) }) : r;
    if (!resp.ok) return new Response("upstream", { status: 502 });
    const ct = resp.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return new Response("not an image", { status: 502 });
    const body = await resp.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
