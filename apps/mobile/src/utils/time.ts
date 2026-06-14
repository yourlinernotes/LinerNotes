/**
 * Format seconds to m:ss
 */
export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format ISO date to relative time
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = new Date('2026-06-13T09:00:00Z').getTime(); // Mock "now" from design
  const h = Math.floor((now - then) / 3.6e6);

  if (h < 1) return 'just now';
  if (h < 24) return `${h}h`;

  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d}d`;
}
