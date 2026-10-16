import { createContext, useContext } from 'react';
import { normaliseColour, textRuns, type Deck } from '@/model';
import { textOf } from '../text/format';

/**
 * The colours the deck already uses (fills, borders, text and slide backgrounds), in the order they
 * first appear, as `#RRGGBB`. The colour picker offers them so a deck keeps to few colours.
 */
export function deckColours(deck: Deck): string[] {
  const found = new Set<string>();
  const add = (value: unknown) => {
    const colour = normaliseColour(value);
    if (colour) found.add(colour);
  };
  for (const slide of deck.slides) {
    add(slide.background);
    for (const element of slide.elements) {
      add(element.fill);
      if (element.border.width > 0) add(element.border.color);
      const doc = textOf(element);
      if (!doc) continue;
      for (const run of textRuns(doc)) {
        for (const mark of run.marks ?? []) if (mark.type === 'textStyle') add(mark.attrs.color);
      }
    }
  }
  return [...found];
}

export interface ColourContextValue {
  /** Colours in use in the deck, and picked in this session (most recent first). */
  readonly colours: readonly string[];
  /** Note a colour that was just chosen, so it is offered first next time. */
  readonly remember: (colour: string) => void;
}

export const ColourContext = createContext<ColourContextValue>({
  colours: [],
  remember: () => undefined,
});

export const useDeckColours = (): ColourContextValue => useContext(ColourContext);
