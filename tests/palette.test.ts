import { describe, expect, test } from 'vitest';
import { PALETTE, parseHex } from '../src/editor/palette';
import { loadTokens } from './support/tokens';

// EL-3: shapes are coloured from the design's own palette, so a deck made in Cue looks like Cue.

describe('Given the shape palette', () => {
  test('When every swatch is compared with the design tokens, Then each is one of the design colours', () => {
    const tokenColours = new Set(
      Object.values(loadTokens().color).map((value) => value.toUpperCase()),
    );

    for (const swatch of PALETTE) expect(tokenColours.has(swatch.value), swatch.name).toBe(true);
  });

  test('When the swatches are listed, Then each has a name and a distinct colour', () => {
    expect(new Set(PALETTE.map((s) => s.value)).size).toBe(PALETTE.length);
    for (const swatch of PALETTE) expect(swatch.name.length).toBeGreaterThan(0);
  });
});

describe('parseHex', () => {
  test.each([
    ['#17803f', '#17803F'],
    ['17803F', '#17803F'],
    ['#abc', '#AABBCC'],
    ['  #F5C542 ', '#F5C542'],
  ])('Given %j, When it is read as a colour, Then it is %s', (input, expected) => {
    expect(parseHex(input)).toBe(expected);
  });

  test.each(['', '#', '#12', '#12345', '#1234567', 'red', '#ggg', 'rgb(1,2,3)'])(
    'Given %j, When it is read as a colour, Then it is rejected',
    (input) => {
      expect(parseHex(input)).toBeUndefined();
    },
  );
});
