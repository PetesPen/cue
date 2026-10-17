import { createContext, useContext } from 'react';

/**
 * Open the audience window for a show of a deck, starting at a slide (its index from 0). Called straight
 * from the click that starts the show; returns whether the window opened. The app gives the editor this
 * (`present` is another module, which the editor never imports), and without it there is no Present
 * button.
 */
export type OpenAudience = (deckId: string, slide: number) => boolean;

export const PresentContext = createContext<OpenAudience | undefined>(undefined);

export function useOpenAudience(): OpenAudience | undefined {
  return useContext(PresentContext);
}
