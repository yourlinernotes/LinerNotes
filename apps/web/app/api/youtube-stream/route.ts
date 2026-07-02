import { getYouTubeAudioStream } from "@/lib/youtube";

/**
 * GET /api/youtube-stream?v=<videoId>
 *
 * Proxies a track's YouTube audio to the browser. The stream is extracted FRESH
 * here (not handed a URL from elsewhere) so the googlevideo fetch and the
 * deciphering happen inside this one server invocation — avoids the IP-binding
 * 403s you get when a URL deciphered on one host is fetched from another.
 *
 * YouTube serves SABR only (no static, Range-able googlevideo URL), so we get a
 * sequential audio ReadableStream. We still support seeking: a `Range: bytes=N-`
 * request is served by *skipping* the first N bytes of the fresh stream and
 * returning 206 with a correct Content-Range — the whole file is never buffered.
 *
 * Fail → 502.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

function parseRange(header: string | null, total: number): { start: number; end: number } | null {
  if (!header || !total) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : total - 1;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start < 0) start = 0;
  if (end >= total) end = total - 1;
  if (start > end) return null;
  return { start, end };
}

/**
 * Wrap the SABR stream so it (a) skips the first `start` bytes and (b) stops
 * after `wanted` bytes — turning a from-zero sequential stream into a Range
 * response without buffering the whole thing.
 */
function sliceStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  wanted: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let skipped = 0;
  let emitted = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (emitted < wanted) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          let chunk = value;
          // Drop bytes before `start`.
          if (skipped < start) {
            const drop = Math.min(start - skipped, chunk.length);
            skipped += drop;
            chunk = chunk.subarray(drop);
            if (chunk.length === 0) continue;
          }
          // Trim the tail so we emit exactly `wanted` bytes.
          const remaining = wanted - emitted;
          if (chunk.length > remaining) chunk = chunk.subarray(0, remaining);
          emitted += chunk.length;
          controller.enqueue(chunk);
          return;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });
}

export async function GET(request: Request) {
  // Kill switch — mirrors /api/youtube-audio. YOUTUBE_FALLBACK=off disables the tier.
  if (/^(off|0|false|no)$/i.test(process.env.YOUTUBE_FALLBACK || "")) {
    return new Response("youtube fallback disabled", { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const videoId = (searchParams.get("v") || "").trim();
  if (!videoId) return new Response("missing v", { status: 400 });

  let audio;
  try {
    audio = await getYouTubeAudioStream(videoId);
  } catch (error) {
    console.error("[youtube-stream] extract error:", error);
    audio = null;
  }
  if (!audio) return new Response("stream unavailable", { status: 502 });

  const { stream, mime, contentLength } = audio;
  const range = parseRange(request.headers.get("range"), contentLength);

  const baseHeaders: Record<string, string> = {
    "Content-Type": mime || "audio/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  try {
    if (range && contentLength) {
      const wanted = range.end - range.start + 1;
      return new Response(sliceStream(stream, range.start, wanted), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${range.start}-${range.end}/${contentLength}`,
          "Content-Length": String(wanted),
        },
      });
    }
    return new Response(stream, {
      status: 200,
      headers: contentLength
        ? { ...baseHeaders, "Content-Length": String(contentLength) }
        : baseHeaders,
    });
  } catch (error) {
    console.error("[youtube-stream] proxy error:", error);
    return new Response("stream error", { status: 502 });
  }
}
