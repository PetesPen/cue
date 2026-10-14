const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(count: number, unit: string): string {
  return `${String(count)} ${unit}${count === 1 ? '' : 's'}`;
}

/** "2 hours ago", "yesterday", "3 weeks ago", "last month": when a deck was last edited (SV-2). */
export function formatEdited(updatedAt: number, now: number): string {
  const elapsed = Math.max(0, now - updatedAt);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${plural(Math.floor(elapsed / MINUTE), 'minute')} ago`;
  if (elapsed < DAY) return `${plural(Math.floor(elapsed / HOUR), 'hour')} ago`;
  const days = Math.floor(elapsed / DAY);
  if (days < 2) return 'yesterday';
  if (days < 7) return `${plural(days, 'day')} ago`;
  if (days < 28) return `${plural(Math.floor(days / 7), 'week')} ago`;
  if (days < 60) return 'last month';
  if (days < 365) return `${plural(Math.floor(days / 30), 'month')} ago`;
  return 'over a year ago';
}

/** "12 slides · Edited 2 hours ago": the line under a deck card's title. */
export function deckMeta(slideCount: number, updatedAt: number, now: number): string {
  return `${plural(slideCount, 'slide')} · Edited ${formatEdited(updatedAt, now)}`;
}
