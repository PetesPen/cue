import { fontsUsed, imageHashes, isShape, isTextBox, type Deck, type Env } from '@/model';
import { loadBundledFonts } from './bundledFonts';
import { packDeck, unpackDeck, type DeckFile } from './deckFile';
import { FILE_EXTENSION, FILE_TYPE } from './deckFileError';
import type { StoredImage, StoredOriginal } from './database';
import type { DeckStore } from './store';

/**
 * Saving a deck to a file and opening one (SV-3), from the deck store. A lazy chunk: the zip library is
 * fetched only when a file is saved or opened.
 */

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
export function fileNameFor(title: string): string {
  const cleaned = title
    .replaceAll(/[^\p{L}\p{N} _-]+/gu, '')
    .trim()
    .slice(0, 80);
  return `${cleaned === '' ? 'Cue deck' : cleaned}${FILE_EXTENSION}`;
}

/** Everything the deck file of `deck` holds, read from the store and the app's own fonts. */
async function gather(store: DeckStore, deck: Deck): Promise<DeckFile> {
  const images: StoredImage[] = [];
  const originals: StoredOriginal[] = [];
  for (const hash of imageHashes(deck)) {
    const image = await store.loadImage(hash);
    if (!image) throw new Error('A picture of this deck cannot be read from this browser.');
    images.push(image);
    const original = await store.loadOriginal(hash);
    if (original) originals.push(original);
  }
  return { deck, images, originals, fonts: await loadBundledFonts(fontsOfDeck(deck)) };
}

/** The deck as a file, ready to be downloaded, and the name to give it. */
export async function makeDeckFile(
  store: DeckStore,
  deck: Deck,
  now: number,
): Promise<{ readonly file: Blob; readonly name: string; readonly bytes: number }> {
  const bytes = packDeck(await gather(store, deck), now);
  return {
    file: new Blob([new Uint8Array(bytes)], { type: FILE_TYPE }),
    name: fileNameFor(deck.title),
    bytes: bytes.length,
  };
}

/**
 * Open a deck file: read and check all of it, and only then store it, as a NEW deck (it never replaces
 * one), together with its pictures in one transaction. Throws a `DeckFileError` for a file that is not
 * a deck, is damaged, or is from a newer Cue, and changes nothing.
 */
export async function openDeckFile(store: DeckStore, file: Blob, env: Env): Promise<Deck> {
  const opened = await unpackDeck(new Uint8Array(await file.arrayBuffer()));
  const deck: Deck = { ...opened.deck, id: env.newId(), updatedAt: env.now() };
  await store.save(deck, opened.images, opened.originals);
  return deck;
}
