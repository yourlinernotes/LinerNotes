import { NextResponse } from "next/server";
import { translateLines } from "@/lib/translate";

/**
 * POST /api/lyric-translate  { lines: string[], target?: string }
 *
 * Translate lyric lines (keyless, best-effort) to `target` (default "en"),
 * index-aligned so the caller keeps each translation's original timestamp.
 * Returns { translations: string[], sourceLang }.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const lines: string[] = Array.isArray(body?.lines) ? body.lines.slice(0, 200) : [];
    const target: string = (body?.target || "en").toString().slice(0, 5);
    if (!lines.length) return NextResponse.json({ translations: [], sourceLang: null });
    const result = await translateLines(lines, target);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[lyric-translate] error:", error);
    return NextResponse.json({ translations: [], sourceLang: null });
  }
}
