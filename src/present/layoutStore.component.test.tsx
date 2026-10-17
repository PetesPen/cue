import { afterEach, describe, expect, test } from 'vitest';
import {
  DEFAULT_LAYOUT,
  NOTES_PX,
  TOP_VH,
  clampNotesPx,
  clampTopVh,
  readLayout,
  writeLayout,
} from './layoutStore';

// Runs in the browser, where `localStorage` is real.

afterEach(() => {
  localStorage.clear();
});

describe('the sizes are kept in range (PM-4)', () => {
  test.each([
    [Number.NaN, DEFAULT_LAYOUT.topVh],
    [0, TOP_VH.min],
    [100, TOP_VH.max],
    [45.6, 46],
    [30, 30],
  ])('Given a share of %s, When it is clamped, Then it is %s', (given, wanted) => {
    expect(clampTopVh(given)).toBe(wanted);
  });

  test.each([
    [Number.NaN, DEFAULT_LAYOUT.notesPx],
    [1, NOTES_PX.min],
    [99, NOTES_PX.max],
    [23, 24],
    [22, 22],
    [15, 16],
  ])(
    'Given a text size of %s, When it is clamped, Then it is %s, in steps of 2',
    (given, wanted) => {
      expect(clampNotesPx(given)).toBe(wanted);
    },
  );
});

describe('the layout is remembered on this browser (PM-4)', () => {
  test('Given nothing kept, When the layout is read, Then it is the board default', () => {
    expect(readLayout()).toEqual({ topVh: 46, notesPx: 22 });
  });

  test('Given a layout written, When it is read, Then it is the same', () => {
    writeLayout({ topVh: 30, notesPx: 30 });

    expect(readLayout()).toEqual({ topVh: 30, notesPx: 30 });
  });

  test.each([
    ['not JSON', 'nonsense'],
    ['not an object', '42'],
    ['null', 'null'],
    ['strings for numbers', '{"topVh":"big","notesPx":"huge"}'],
    ['half there', '{"topVh":40}'],
  ])(
    'Given a stored value that is %s, When it is read, Then what is usable is kept and the rest is the default',
    (_name, stored) => {
      localStorage.setItem('cue.presenter', stored);

      const layout = readLayout();

      expect(layout.notesPx).toBe(DEFAULT_LAYOUT.notesPx);
      expect(layout.topVh).toBe(stored === '{"topVh":40}' ? 40 : DEFAULT_LAYOUT.topVh);
    },
  );

  test('Given values out of range, When they are read, Then they are put in range', () => {
    localStorage.setItem('cue.presenter', '{"topVh":500,"notesPx":3}');

    expect(readLayout()).toEqual({ topVh: TOP_VH.max, notesPx: NOTES_PX.min });
  });
});
