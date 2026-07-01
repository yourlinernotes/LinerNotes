/**
 * Lyric translation — keyless, so it works out of the box.
 *
 * Primary: Google's public `translate_a/single` endpoint (no key, auto-detects
 * source, good quality). Fallback: MyMemory (keyless). Both are unofficial/rate-
 * limited, so this is a best-effort enhancement — a paid DeepL key can be
 * dropped in later for scale/quality.
 *
 * Translation is a *second text track at the same timestamps* — the sync engine
 * renders it exactly like the original, so the player can toggle or stack them.
 */

const UA = "Mozilla/5.0 (compatible; LinerNotes/1.0)";

async function googleLine(text: string, target: string): Promise<{ text: string; src: string } | null> {
  if (!text.trim()) return { text: "", src: "" };
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=` +
      encodeURIComponent(text);
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const translated = (j[0] || []).map((s: any) => s[0]).join("");
    return { text: translated, src: j[2] || "" };
  } catch {
    return null;
  }
}

async function mymemoryLine(text: string, target: string, src: string): Promise<string | null> {
  if (!text.trim()) return "";
  try {
    const pair = `${src || "autodetect"}|${target}`;
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`,
      { headers: { "User-Agent": UA } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j?.responseData?.translatedText ?? null;
  } catch {
    return null;
  }
}

/** Run tasks with a small concurrency cap (be gentle on the free endpoints). */
async function pooled<T>(items: T[], limit: number, fn: (t: T, i: number) => Promise<any>) {
  const out: any[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface TranslationResult {
  translations: string[];
  sourceLang: string | null;
}

/**
 * Translate an array of lyric lines to `target` (default "en"), preserving
 * index alignment so the caller can pair each with its original timestamp.
 */
export async function translateLines(lines: string[], target = "en"): Promise<TranslationResult> {
  let sourceLang: string | null = null;
  const translations = await pooled(lines, 8, async (line) => {
    const g = await googleLine(line, target);
    if (g) {
      if (!sourceLang && g.src) sourceLang = g.src;
      return g.text;
    }
    const m = await mymemoryLine(line, target, sourceLang || "");
    return m ?? line; // fall back to the original line, never blank
  });
  return { translations, sourceLang };
}
