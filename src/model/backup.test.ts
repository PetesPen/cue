import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { REMINDER_DAYS, backupReminder, snoozeUntil, type DeckDates } from './backup';

// SV-8: the reminder to back up is shown only for work that is not in a file anywhere recently.

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const ago = (days: number) => NOW - days * DAY;

const deck = (id: string, madeDaysAgo: number, editedDaysAgo = madeDaysAgo): DeckDates => ({
  id,
  createdAt: ago(madeDaysAgo),
  updatedAt: ago(editedDaysAgo),
});

describe('when to remind the person to back up (SV-8)', () => {
  test('Given no decks, Then there is nothing to say', () => {
    expect(backupReminder([], {}, NOW)).toBeUndefined();
  });

  test('Given a deck made 20 days ago and never filed, Then the reminder says 20 days and that nothing was ever filed', () => {
    expect(backupReminder([deck('a', 20)], {}, NOW)).toEqual({ days: 20, never: true });
  });

  test('Given a deck made 13 days ago and never filed, Then it is too soon', () => {
    expect(backupReminder([deck('a', 13)], {}, NOW)).toBeUndefined();
  });

  test('Given a deck made exactly 14 days ago, Then the reminder is due', () => {
    expect(backupReminder([deck('a', REMINDER_DAYS)], {}, NOW)?.days).toBe(14);
  });

  test('Given a deck filed 20 days ago and edited since, Then the reminder counts from the file', () => {
    expect(backupReminder([deck('a', 60, 5)], { a: ago(20) }, NOW)).toEqual({
      days: 20,
      never: false,
    });
  });

  test('Given a deck filed 20 days ago and not edited since, Then it has nothing to lose and nothing is said', () => {
    expect(backupReminder([deck('a', 60, 30)], { a: ago(20) }, NOW)).toBeUndefined();
  });

  test('Given a deck edited the moment it was filed, Then it is in the file', () => {
    expect(backupReminder([deck('a', 60, 20)], { a: ago(20) }, NOW)).toBeUndefined();
  });

  test('Given a deck filed 3 days ago and edited since, Then it is too soon', () => {
    expect(backupReminder([deck('a', 60, 1)], { a: ago(3) }, NOW)).toBeUndefined();
  });

  test('Given several decks, Then the days are those of the one that has waited longest', () => {
    const decks = [deck('new', 3), deck('old', 40), deck('mid', 25)];
    expect(backupReminder(decks, {}, NOW)?.days).toBe(40);
  });

  test('Given some decks filed and some not, Then "never" is false', () => {
    const decks = [deck('filed', 60, 1), deck('loose', 30)];
    expect(backupReminder(decks, { filed: ago(2) }, NOW)).toEqual({ days: 30, never: false });
  });

  test('Given the reminder was closed, Then it stays away until the pause is over', () => {
    const decks = [deck('a', 20)];
    expect(backupReminder(decks, {}, NOW, NOW + 1)).toBeUndefined();
    expect(backupReminder(decks, {}, NOW, NOW)).toEqual({ days: 20, never: true });
    expect(backupReminder(decks, {}, NOW, NOW - 1)).toEqual({ days: 20, never: true });
  });

  test('Given the close button, Then the pause is 14 days', () => {
    expect(snoozeUntil(NOW)).toBe(NOW + 14 * DAY);
  });

  test('Given any decks and files, When every deck is filed now, Then there is nothing to say', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            createdAt: fc.integer({ min: 0, max: NOW }),
            updatedAt: fc.integer({ min: 0, max: NOW }),
          }),
          { maxLength: 12 },
        ),
        (decks) => {
          const filed = Object.fromEntries(decks.map((one) => [one.id, NOW]));
          expect(backupReminder(decks, filed, NOW)).toBeUndefined();
        },
      ),
    );
  });

  test('Given any decks, Then a reminder always names at least 14 days', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            createdAt: fc.integer({ min: 0, max: NOW }),
            updatedAt: fc.integer({ min: 0, max: NOW }),
          }),
          { maxLength: 12 },
        ),
        (decks) => {
          const reminder = backupReminder(decks, {}, NOW);
          if (reminder) expect(reminder.days).toBeGreaterThanOrEqual(REMINDER_DAYS);
        },
      ),
    );
  });
});
