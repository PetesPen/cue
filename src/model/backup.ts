/**
 * When to remind the person to back up (SV-8): pure, so every edge is a table test. Decks live only in the
 * browser, and clearing its data takes them, so a deck that has changed since it was last put in a file
 * (a deck file, or a backup of all decks) and whose file is two weeks old or more is work that is not in
 * a file anywhere recently. A deck that has not changed since it was filed has nothing to lose.
 */

export const REMINDER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the rule needs to know of a deck. */
export interface DeckDates {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The reminder to show: how many days the oldest unfiled work has waited, and whether nothing was ever filed. */
export interface Reminder {
  readonly days: number;
  /** No deck of the library has ever been put in a file. */
  readonly never: boolean;
}

/**
 * The reminder, or `undefined` when there is nothing to say. `filed` holds when each deck was last put in a
 * file; a deck never filed counts from the day it was made. `snoozedUntil` is the end of the pause the
 * person asked for with the reminder's close button.
 */
export function backupReminder(
  decks: readonly DeckDates[],
  filed: Readonly<Record<string, number>>,
  now: number,
  snoozedUntil?: number,
): Reminder | undefined {
  if (snoozedUntil !== undefined && now < snoozedUntil) return undefined;
  let oldest = 0;
  for (const deck of decks) {
    const at = filed[deck.id];
    // Changed since it was filed, or never filed at all.
    if (at !== undefined && deck.updatedAt <= at) continue;
    const age = now - (at ?? deck.createdAt);
    if (age >= REMINDER_DAYS * DAY_MS) oldest = Math.max(oldest, age);
  }
  if (oldest === 0) return undefined;
  return {
    days: Math.floor(oldest / DAY_MS),
    never: decks.every((deck) => filed[deck.id] === undefined),
  };
}

/** The moment the pause begins to end: the reminder's close button hides it for 14 days. */
export function snoozeUntil(now: number): number {
  return now + REMINDER_DAYS * DAY_MS;
}
