import type { Deck } from './deck';
import { isImage } from './elements';

/** The pictures a deck shows, by content hash: what must stay in storage while the deck does. */
export function imageHashes(deck: Deck): Set<string> {
  const hashes = new Set<string>();
  for (const slide of deck.slides) {
    for (const element of slide.elements) {
      if (isImage(element)) hashes.add(element.hash);
    }
  }
  return hashes;
}
