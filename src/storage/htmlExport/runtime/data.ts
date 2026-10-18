import { parseDeck, type Deck } from '@/model';
import type { ImageSource } from '@/render';
import {
  DECK_BLOCK,
  IMAGE_ATTRIBUTE,
  IMAGE_TYPE_ATTRIBUTE,
  LICENCES_BLOCK,
  NOTES_ATTRIBUTE,
} from '../layout';

/**
 * What the page's program reads from its own page (SV-4): the deck, the pictures the deck shows (left
 * as text in their blocks until a slide needs one), the licences of the fonts, and whether the notes
 * are in the file.
 */

interface PageImage {
  readonly type: string;
  readonly block: Element;
}

export interface PageData {
  readonly deck: Deck;
  /** The notes are in the file (and the page offers them). */
  readonly notes: boolean;
  readonly licences: string;
  readonly images: ReadonlyMap<string, PageImage>;
}

/** The page cannot be shown, and why, in words for the person looking at it. */
export class PageError extends Error {}

export function readPage(doc: Document): PageData {
  const block = doc.getElementById(DECK_BLOCK)?.textContent;
  if (!block) throw new PageError('This page has no deck in it.');
  let raw: unknown;
  try {
    raw = JSON.parse(block);
  } catch {
    throw new PageError('The deck in this page is damaged.');
  }
  let deck: Deck;
  try {
    deck = parseDeck(raw);
  } catch {
    throw new PageError(
      'The deck in this page is damaged, or it was made by a newer version of Cue than this page understands.',
    );
  }
  const images = new Map<string, PageImage>();
  for (const block of doc.querySelectorAll(`script[${IMAGE_ATTRIBUTE}]`)) {
    const hash = block.getAttribute(IMAGE_ATTRIBUTE);
    if (hash) images.set(hash, { type: block.getAttribute(IMAGE_TYPE_ATTRIBUTE) ?? '', block });
  }
  return {
    deck,
    notes: doc.documentElement.getAttribute(NOTES_ATTRIBUTE) === 'included',
    licences: doc.getElementById(LICENCES_BLOCK)?.textContent ?? '',
    images,
  };
}

function decode(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Where the renderer gets its pictures from: each is made from its block the first time a slide asks
 * for it, and drawn from an address of its own. The text of a block is let go once its picture is made.
 */
export function imageSourceFor(images: ReadonlyMap<string, PageImage>): ImageSource & {
  readonly release: () => void;
} {
  const urls = new Map<string, string>();
  return {
    url: (hash) => urls.get(hash),
    load(hash, ready) {
      if (!urls.has(hash)) {
        const image = images.get(hash);
        if (!image) return;
        const bytes = decode(image.block.textContent);
        image.block.textContent = '';
        urls.set(hash, URL.createObjectURL(new Blob([bytes], { type: image.type })));
      }
      setTimeout(ready, 0);
    },
    release() {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
