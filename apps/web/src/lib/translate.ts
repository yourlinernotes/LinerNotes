/**
 * Lyric translation — context-aware, keyless-first, no paid API required.
 *
 * The old version translated one line at a time, which is why translations read
 * "barebones": a lyric line in isolation gives the engine no context, so dropped
 * subjects (common in Korean/Japanese) get the wrong pronoun (I↔you swaps) and
 * nothing flows. We fix that with *whole-song context* at every tier:
 *
 *   1. Gemini (free tier, if GEMINI_API_KEY is set) — translates the full lyric
 *      with instructions to stay faithful *and* natural, returning a line-aligned
 *      array. This is the only tier that reaches "fan translation" eloquence.
 *   2. Google translate_a/single (keyless) in BATCHES — the whole song (or large
 *      chunks) sent as one text with newlines preserved, so the engine sees
 *      surrounding lines. Realigns by splitting on newline; falls back to
 *      per-line only when a chunk's line count doesn't survive the round-trip.
 *   3. MyMemory (keyless) per-line — last resort.
 *
 * Translation is a *second text track at the same timestamps* — the sync engine
 * renders it exactly like the original, so index alignment must be preserved.
 */

const UA = "Mozilla/5.0 (compatible; LinerNotes/1.0)";

// Human-readable names read better in the Gemini prompt than ISO codes.
const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", ru: "Russian",
  ar: "Arabic", hi: "Hindi", id: "Indonesian", th: "Thai", vi: "Vietnamese",
  tr: "Turkish", nl: "Dutch", pl: "Polish", sv: "Swedish",
};
const langName = (code: string) => LANG_NAMES[code] || code;

export interface TranslationResult {
  translations: string[];
  sourceLang: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1: Gemini free tier (whole-song context, eloquent, line-aligned)
// ─────────────────────────────────────────────────────────────────────────────

async function geminiTranslate(lines: string[], target: string): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  // Blank lines carry no text but must keep their slot for timestamp alignment.
  // Send only the non-blank lines to the model, then splice back.
  const idxMap: number[] = [];
  const payloadLines: string[] = [];
  lines.forEach((l, i) => { if (l.trim()) { idxMap.push(i); payloadLines.push(l); } });
  if (!payloadLines.length) return lines.map(() => "");

  const prompt =
    `You are translating song lyrics into ${langName(target)}. You are given the ` +
    `lyric as a JSON array of lines, in order. Translate each line into ${langName(target)}.\n\n` +
    `Rules:\n` +
    `- Use the whole lyric as context. Resolve pronouns (I / you / we), tense, and ` +
    `gender from surrounding lines — do NOT translate a line in isolation.\n` +
    `- Prioritise how a fluent native speaker would actually say it: natural, ` +
    `emotionally faithful, and singable — not a literal word-for-word gloss.\n` +
    `- Return EXACTLY one translated line per input line, in the same order. Do not ` +
    `merge, split, reorder, add, or drop lines.\n` +
    `- If a line is already in ${langName(target)}, return it unchanged.\n` +
    `- Output ONLY a JSON array of strings of the same length as the input.\n\n` +
    `Lyric:\n${JSON.stringify(payloadLines)}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: { type: "ARRAY", items: { type: "STRING" } },
          },
        }),
      },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const arr = JSON.parse(text);
    // Must line up exactly, or we can't trust the alignment — bail to the next tier.
    if (!Array.isArray(arr) || arr.length !== payloadLines.length) return null;

    const out = lines.map(() => "");
    idxMap.forEach((origIdx, k) => { out[origIdx] = String(arr[k] ?? ""); });
    return out;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2: keyless Google, batched with context
// ─────────────────────────────────────────────────────────────────────────────

/** Translate one blob of text (newlines preserved) via the keyless endpoint. */
async function googleBlob(text: string, target: string): Promise<{ text: string; src: string } | null> {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=` +
      encodeURIComponent(text);
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const j = await r.json();
    // j[0] is an array of translated segments; concatenating segment[0] rebuilds
    // the full text with its newlines, which is how we realign to lines.
    const translated = (j[0] || []).map((s: any) => s[0]).join("");
    return { text: translated, src: j[2] || "" };
  } catch {
    return null;
  }
}

/** Per-line fallback for a chunk whose batched newline count didn't round-trip. */
async function googlePerLine(chunk: string[], target: string): Promise<string[]> {
  return Promise.all(
    chunk.map(async (line) => {
      if (!line.trim()) return "";
      const g = await googleBlob(line, target);
      return g?.text ?? line;
    }),
  );
}

/**
 * Split lines into chunks small enough for a GET URL, translate each chunk as a
 * single newline-joined blob (so the engine has cross-line context), and realign
 * by newline. If the newline count doesn't survive, fall back to per-line for
 * that chunk so alignment is never wrong.
 */
async function googleBatched(lines: string[], target: string): Promise<{ translations: string[]; sourceLang: string | null }> {
  const CHUNK_CHARS = 1200; // keep the encoded GET URL well under limits
  const chunks: { start: number; lines: string[] }[] = [];
  let cur: string[] = [];
  let curLen = 0;
  let start = 0;
  lines.forEach((line, i) => {
    const add = line.length + 1;
    if (cur.length && curLen + add > CHUNK_CHARS) {
      chunks.push({ start, lines: cur });
      cur = []; curLen = 0; start = i;
    }
    cur.push(line); curLen += add;
  });
  if (cur.length) chunks.push({ start, lines: cur });

  const translations = [...lines];
  let sourceLang: string | null = null;

  await Promise.all(
    chunks.map(async ({ start: s, lines: chunk }) => {
      const blob = await googleBlob(chunk.join("\n"), target);
      let pieces: string[] | null = null;
      if (blob) {
        if (!sourceLang && blob.src) sourceLang = blob.src;
        const split = blob.text.split("\n");
        if (split.length === chunk.length) pieces = split;
      }
      // Newlines didn't round-trip (or the blob failed) → guarantee alignment.
      if (!pieces) pieces = await googlePerLine(chunk, target);
      pieces.forEach((t, k) => { translations[s + k] = t; });
    }),
  );

  return { translations, sourceLang };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 3: MyMemory (keyless, per-line) — last resort for stragglers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

/** Detect the source language cheaply from the first non-blank line. */
async function detectSource(lines: string[], target: string): Promise<string | null> {
  const first = lines.find((l) => l.trim());
  if (!first) return null;
  const g = await googleBlob(first, target);
  return g?.src || null;
}

/**
 * Translate an array of lyric lines to `target` (default "en"), preserving index
 * alignment so the caller can pair each with its original timestamp.
 */
export async function translateLines(lines: string[], target = "en"): Promise<TranslationResult> {
  if (!lines.length) return { translations: [], sourceLang: null };

  // Tier 1 — Gemini free tier (best; whole-song context + eloquence).
  const gem = await geminiTranslate(lines, target);
  if (gem) {
    const sourceLang = await detectSource(lines, target);
    return { translations: gem, sourceLang };
  }

  // Tier 2 — keyless Google, batched with context.
  const batched = await googleBatched(lines, target);

  // Tier 3 — patch any lines that came back identical/blank via MyMemory.
  const translations = await Promise.all(
    batched.translations.map(async (t, i) => {
      const orig = lines[i];
      if (!orig.trim()) return "";
      if (t && t !== orig) return t; // batched succeeded for this line
      const m = await mymemoryLine(orig, target, batched.sourceLang || "");
      return m ?? orig; // never blank a non-blank line
    }),
  );

  return { translations, sourceLang: batched.sourceLang };
}
