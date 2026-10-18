import { fontsUsed, isShape, isTextBox, type Deck } from '@/model';
import { FILE_EXTENSION } from './deckFileError';
import type { StoredImage, StoredOriginal } from './database';

/**
 * Small facts about a deck that both of the ways to take it out of Cue (the deck file, SV-3, and the web
 * page, SV-4) need. Kept apart from the zip code so that the web page's exporter does not load it.
 */

/** A font a deck uses, as it travels in a file: its files and the licence text that must go with them. */
export interface EmbeddedFont {
  readonly family: string;
  readonly files: readonly { readonly name: string; readonly bytes: Uint8Array }[];
  readonly licence: string;
}

/** The folder a family has in a deck file, and in the app's own font files. */
export const fontFolder = (family: string) =>
  family
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

/** The bundled font families a deck's text uses. */
export function fontsOfDeck(deck: Deck): string[] {
  const families = new Set<string>();
  for (const slide of deck.slides) {
    for (const element of slide.elements) {
      const doc = isTextBox(element) ? element.doc : isShape(element) ? element.text : undefined;
      if (doc) for (const family of fontsUsed(doc)) families.add(family);
    }
  }
  return [...families];
}

/** A file name from a deck title: letters, digits, spaces and dashes; never empty. */
export function fileNameFor(title: string, extension = FILE_EXTENSION): string {
  const cleaned = title
    .replaceAll(/[^\p{L}\p{N} _-]+/gu, '')
    .trim()
    .slice(0, 80);
  return `${cleaned === '' ? 'Cue deck' : cleaned}${extension}`;
}

/** Pictures that are in the editor but not in the store yet (a save that has not worked, or has not happened). */
export interface UnsavedPictures {
  readonly images: readonly StoredImage[];
  readonly originals: readonly StoredOriginal[];
}
