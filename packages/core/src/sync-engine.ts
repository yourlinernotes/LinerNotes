/**
 * @linernotes/core/sync-engine
 *
 * Player-agnostic synced-lyrics engine. Turns an LRC string into timed lines
 * and, given a live playback position (ms), tells you which line to highlight.
 *
 * The engine only ever takes `positionMs`, so the audio *source* is swappable —
 * it works identically whether the position comes from the SoundCloud Widget
 * (`PLAY_PROGRESS`), expo-audio (`playbackStatusUpdate`), or an `<audio>` tag.
 *
 * Design + rationale: vault note "Synced Lyrics" §2–3.
 */

export interface LyricLine {
  /** Milliseconds into the track when this line is sung. */
  timeMs: number;
  /** The lyric text (may be empty for an instrumental gap). */
  text: string;
}

const TAG_RE = /\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g;

/**
 * Parse an `.lrc` string into a time-sorted array of `{ timeMs, text }`.
 *
 * Handles:
 *  - `[mm:ss.xx] text` where `.xx` is *fractional seconds* (`.5` = 500ms,
 *    `.67` = 670ms) — parsed as a fraction, robust to 1–3 digit fractions.
 *  - Multi-tag lines (`[00:10.00][00:40.00] chorus`) → one entry per tag.
 *  - ID/metadata tags (`[ti:...]`, `[ar:...]`) and blank lines → dropped.
 *  - Empty-text timestamps (instrumental gaps) → kept, so the highlight can clear.
 */
export function parseLrc(lrc: string): LyricLine[] {
  if (!lrc) return [];
  return lrc
    .split('\n')
    .flatMap((raw) => {
      const tags = [...raw.matchAll(TAG_RE)];
      if (!tags.length) return [];
      const text = raw.replace(TAG_RE, '').trim();
      return tags.map((m) => {
        const [, mm, ss, frac = '0'] = m;
        const ms = (+mm * 60 + +ss) * 1000 + Math.round(+`0.${frac}` * 1000);
        return { timeMs: ms, text };
      });
    })
    .sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Index of the line to highlight at `positionMs` — the last line whose
 * `timeMs <= positionMs`. Returns -1 before the first line. O(log n) binary
 * search, forward-stable as position advances.
 */
export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/**
 * Whether an LRC string actually carries timestamps (i.e. is line-synced).
 * Useful to decide synced-highlight vs static-block rendering.
 */
export function isSynced(lrc: string | null | undefined): boolean {
  // Non-global test — the shared TAG_RE is stateful (`g` flag), so use a fresh
  // literal here to stay pure across repeated calls.
  return !!lrc && /\[\d+:\d{2}(?:\.\d{1,3})?\]/.test(lrc);
}
