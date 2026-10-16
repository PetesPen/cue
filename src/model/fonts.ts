/**
 * The bundled fonts (src/fonts) and which styles each one really has. The editor hides a style button
 * a font does not have, and no text document keeps such a style, so what the editor shows is what an
 * export will draw (decisions 7, 11 and 20). `tests/fonts.test.ts` checks this table against the
 * font files declared in `src/fonts/fonts.css`.
 */

export type FontKind = 'Sans' | 'Serif' | 'Mono' | 'Hand';

export interface FontInfo {
  readonly family: string;
  /** The small label in the font picker. */
  readonly kind: FontKind;
  /** Has a bold design (not one the browser would make up). */
  readonly bold: boolean;
  /** Has an italic design. */
  readonly italic: boolean;
}

export const FONTS: readonly FontInfo[] = [
  { family: 'Instrument Sans', kind: 'Sans', bold: true, italic: true },
  { family: 'Figtree', kind: 'Sans', bold: true, italic: true },
  { family: 'Bricolage Grotesque', kind: 'Sans', bold: true, italic: false },
  { family: 'DM Serif Display', kind: 'Serif', bold: false, italic: true },
  { family: 'Space Grotesk', kind: 'Sans', bold: true, italic: false },
  { family: 'JetBrains Mono', kind: 'Mono', bold: true, italic: true },
  { family: 'Caveat', kind: 'Hand', bold: true, italic: false },
];

export const DEFAULT_FONT = 'Instrument Sans';

/** What a font can do. A font Cue does not know (from a newer deck) is assumed to do everything. */
export function fontCapabilities(family: string): { bold: boolean; italic: boolean } {
  const known = FONTS.find((font) => font.family === family);
  return known ? { bold: known.bold, italic: known.italic } : { bold: true, italic: true };
}

/** Is this one of the bundled fonts? Pasted text in any other font falls back to the default. */
export function isBundledFont(family: string): boolean {
  return FONTS.some((font) => font.family === family);
}
