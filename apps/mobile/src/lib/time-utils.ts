/**
 * Format ISO timestamp to relative time
 * Based on Claude Design handoff lnRel function
 */
export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const hours = Math.floor((now - then) / 3.6e6);

  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d`;
}

/**
 * Format seconds to m:ss timestamp
 * Based on Claude Design handoff lnFmt function
 */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
