import { isImage, isShape, isTextBox, type Deck, type RichText } from '@/model';
import { ensureFonts } from '@/render';
import type { ImageCache } from '@/storage';

/** How long a show waits for fonts and pictures before it starts anyway. */
export const PRELOAD_LIMIT_MS = 4000;

/**
 * Get what a show needs ready before the first slide appears: the fonts of every text and the pictures of
 * every slide. A transition draws the next slide before it is shown, and a slide that arrives with a
 * fallback font or an empty picture would be seen doing it. A picture that cannot be read does not hold
 * the show back for long: the box stays empty, as in the editor.
 */
export async function preloadDeck(
  deck: Deck,
  images: ImageCache,
  limitMs: number = PRELOAD_LIMIT_MS,
): Promise<void> {
  const docs: RichText[] = [];
  const hashes = new Set<string>();
  for (const slide of deck.slides) {
    for (const element of slide.elements) {
      if (isTextBox(element)) docs.push(element.doc);
      else if (isShape(element) && element.text) docs.push(element.text);
      else if (isImage(element)) hashes.add(element.hash);
    }
  }
  const fonts = Promise.all(docs.map((doc) => ensureFonts(doc)));
  const pictures = Promise.all(
    [...hashes].map(
      (hash) =>
        new Promise<void>((resolve) => {
          images.load(hash, resolve);
        }),
    ),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, limitMs);
  });
  try {
    await Promise.race([Promise.all([fonts, pictures]), gaveUp]);
  } finally {
    clearTimeout(timer);
  }
}
