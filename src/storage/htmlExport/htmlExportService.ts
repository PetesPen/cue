import { runtimeScript, runtimeStyle } from 'virtual:cue-export-runtime';
import { isImage, type Deck } from '@/model';
import fontsCss from '../../fonts/fonts.css?raw';
import { loadBundledFonts } from '../bundledFonts';
import type { StoredImage } from '../database';
import { fileNameFor, fontsOfDeck, type UnsavedPictures } from '../deckInfo';
import type { DeckStore } from '../store';
import { HtmlExportError, buildHtml } from './exporter';

/**
 * The deck as a standalone web page (SV-4), from the deck in the tab and the store. A lazy chunk: the
 * page's program and the exporter are fetched only when a page is made. Nothing is written anywhere, and
 * the deck is not changed.
 */

export const HTML_EXTENSION = '.html';

export interface MadeHtml {
  readonly file: Blob;
  readonly name: string;
  readonly bytes: number;
  /** The bytes of the pictures in it, from which the size of another kind of file is estimated. */
  readonly pictureBytes: number;
}

export interface HtmlOptions {
  readonly includeNotes: boolean;
}

/** The pictures the deck shows, once each; one that cannot be read stops the export and names its slide. */
async function pictures(
  store: DeckStore,
  deck: Deck,
  unsaved: UnsavedPictures | undefined,
): Promise<StoredImage[]> {
  const found = new Map<string, StoredImage>();
  for (const [index, slide] of deck.slides.entries()) {
    for (const element of slide.elements) {
      if (!isImage(element) || found.has(element.hash)) continue;
      const image =
        unsaved?.images.find((candidate) => candidate.hash === element.hash) ??
        (await store.loadImage(element.hash));
      if (!image) {
        throw new HtmlExportError(
          `The picture on slide ${String(index + 1)} can’t be read from this browser, so the page was not made. Nothing has been changed.`,
        );
      }
      found.set(element.hash, image);
    }
  }
  return [...found.values()];
}

export async function makeHtmlFile(
  store: DeckStore,
  deck: Deck,
  options: HtmlOptions,
  unsaved?: UnsavedPictures,
): Promise<MadeHtml> {
  const images = await pictures(store, deck, unsaved);
  const file = await buildHtml({
    deck,
    images,
    fonts: await loadBundledFonts(fontsOfDeck(deck)),
    fontsCss,
    includeNotes: options.includeNotes,
    runtime: { script: runtimeScript, style: runtimeStyle },
  });
  return {
    file,
    name: fileNameFor(deck.title, HTML_EXTENSION),
    bytes: file.size,
    pictureBytes: images.reduce((total, image) => total + image.bytes.length, 0),
  };
}
