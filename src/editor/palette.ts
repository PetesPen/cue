/**
 * The colours offered for fills and borders: the design's own colours (design/tokens.css), so shapes
 * made in Cue look like Cue. Any other colour can be typed as hex. `tests/palette.test.ts` keeps this
 * list inside the tokens.
 */
export interface Swatch {
  readonly name: string;
  readonly value: string;
}

export const PALETTE: readonly Swatch[] = [
  { name: 'Forest', value: '#14281B' },
  { name: 'Green', value: '#17803F' },
  { name: 'Mint', value: '#7FC8A0' },
  { name: 'Yellow', value: '#F5C542' },
  { name: 'Sage', value: '#E8F0E4' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Grey green', value: '#5B6F61' },
  { name: 'Red', value: '#B3261E' },
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` and `#aabbcc` are colours; anything else is not. Returns the six-digit upper-case form. */
export function parseHex(text: string): string | undefined {
  const value = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
  if (!HEX.test(value)) return undefined;
  const digits = value.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  return `#${full.toUpperCase()}`;
}
