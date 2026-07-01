/**
 * LRC parsing + active-line lookup for the web app. Mirrors
 * packages/core/src/sync-engine.ts (web doesn't wire in @linernotes/core).
 */

export type LyricLine = { timeMs: number; text: string };

const TAG_RE = /\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g;

export function parseLrc(lrc: string): LyricLine[] {
  if (!lrc) return [];
  return lrc
    .split("\n")
    .flatMap((raw) => {
      const tags = [...raw.matchAll(TAG_RE)];
      if (!tags.length) return [];
      const text = raw.replace(TAG_RE, "").trim();
      return tags.map((m) => {
        const [, mm, ss, frac = "0"] = m;
        const ms = (+mm * 60 + +ss) * 1000 + Math.round(+`0.${frac}` * 1000);
        return { timeMs: ms, text };
      });
    })
    .sort((a, b) => a.timeMs - b.timeMs);
}

export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0,
    hi = lines.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
