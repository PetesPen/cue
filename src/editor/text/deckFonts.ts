import { fontsUsed, type Deck } from '@/model';
import { textOf } from './format';

/** The fonts the deck's text already uses, in the order they first appear: the font picker lists them first. */
export function deckFonts(deck: Deck): string[] {
  const families = new Set<string>();
  for (const slide of deck.slides) {
    for (const element of slide.elements) {
      const doc = textOf(element);
      if (doc) for (const family of fontsUsed(doc)) families.add(family);
    }
  }
  return [...families];
}
