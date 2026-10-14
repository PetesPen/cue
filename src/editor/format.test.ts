import { describe, expect, test } from 'vitest';
import { deckMeta, formatEdited } from './format';

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const ago = (ms: number) => NOW - ms;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatEdited (SV-2)', () => {
  test.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [MINUTE, '1 minute ago'],
    [45 * MINUTE, '45 minutes ago'],
    [HOUR, '1 hour ago'],
    [2 * HOUR, '2 hours ago'],
    [23 * HOUR, '23 hours ago'],
    [24 * HOUR, 'yesterday'],
    [47 * HOUR, 'yesterday'],
    [3 * DAY, '3 days ago'],
    [6 * DAY, '6 days ago'],
    [7 * DAY, '1 week ago'],
    [14 * DAY, '2 weeks ago'],
    [27 * DAY, '3 weeks ago'],
    [28 * DAY, 'last month'],
    [59 * DAY, 'last month'],
    [90 * DAY, '3 months ago'],
    [364 * DAY, '12 months ago'],
    [400 * DAY, 'over a year ago'],
  ])(
    'Given a deck edited %d ms ago, When the date is shown, Then it reads "%s"',
    (elapsed, text) => {
      expect(formatEdited(ago(elapsed), NOW)).toBe(text);
    },
  );

  test('Given a clock set slightly behind the edit time, When the date is shown, Then it says "just now", never a negative time', () => {
    expect(formatEdited(NOW + 5000, NOW)).toBe('just now');
  });
});

describe('deckMeta (SV-2)', () => {
  test('Given a deck of 12 slides edited 2 hours ago, When its card line is built, Then it reads like the design', () => {
    expect(deckMeta(12, ago(2 * HOUR), NOW)).toBe('12 slides · Edited 2 hours ago');
  });

  test('Given a deck of one slide, When its card line is built, Then "slide" is singular', () => {
    expect(deckMeta(1, ago(0), NOW)).toBe('1 slide · Edited just now');
  });
});
