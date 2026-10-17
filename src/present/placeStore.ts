import type { ShowPlace } from '@/model';
import { parseMessage } from './channel';

/**
 * Where a show was when its window was reloaded (PM-3): kept for this tab only, in `sessionStorage`, so a
 * reload of either window returns to the same place. Nothing about a show goes into the deck. A show that
 * ends clears it, and it is only read when the page was reloaded, so a new show never starts from an old
 * one's place.
 */

type Role = 'presenter' | 'audience' | 'single';

const key = (deckId: string, role: Role) => `cue-show-place:${deckId}:${role}`;

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined {
  try {
    return window.sessionStorage;
  } catch {
    // Storage can be blocked (a private window, a policy): a reload then starts the show again.
    return undefined;
  }
}

export function writePlace(deckId: string, role: Role, place: ShowPlace): void {
  try {
    storage()?.setItem(key(deckId, role), JSON.stringify({ type: 'place', place }));
  } catch {
    // Nothing to do: the show goes on, it just cannot be picked up again after a reload.
  }
}

export function readPlace(deckId: string, role: Role): ShowPlace | undefined {
  try {
    const text = storage()?.getItem(key(deckId, role));
    if (text === null || text === undefined) return undefined;
    const message = parseMessage(JSON.parse(text));
    return message?.type === 'place' ? message.place : undefined;
  } catch {
    return undefined;
  }
}

export function clearPlace(deckId: string, role: Role): void {
  try {
    storage()?.removeItem(key(deckId, role));
  } catch {
    // As above.
  }
}

/** Was this page loaded by a reload? (Only then is a remembered place used.) */
export function wasReloaded(): boolean {
  const entry = performance.getEntriesByType('navigation')[0];
  return entry instanceof PerformanceNavigationTiming && entry.type === 'reload';
}
