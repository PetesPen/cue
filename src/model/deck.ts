import { freeze } from 'immer';

/** Bump when the stored shape changes, and add a migration in `parse.ts` (SV-3, SV-5). */
export const SCHEMA_VERSION = 1;

/** Slides are drawn in a fixed 16:9 space and scaled to fit (design/README.md). */
export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

export const DEFAULT_DECK_TITLE = 'Untitled deck';
export const DEFAULT_SLIDE_BACKGROUND = '#FFFFFF';

export type Id = string;

/** What a slide holds. Text, shapes and images arrive with the EL stories; each has an id. */
export interface SlideElement {
  readonly id: Id;
}

export interface Slide {
  readonly id: Id;
  readonly background: string;
  readonly elements: readonly SlideElement[];
  readonly notes: string;
}

/** The one immutable document. Times are milliseconds since the epoch. */
export interface Deck {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly id: Id;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly slides: readonly Slide[];
}

/** The two outside things a deck needs: new ids and the time. Passed in so model code stays pure. */
export interface Env {
  readonly newId: () => Id;
  readonly now: () => number;
}

export const systemEnv: Env = {
  newId: () => crypto.randomUUID(),
  now: () => Date.now(),
};

export function createSlide(id: Id): Slide {
  return { id, background: DEFAULT_SLIDE_BACKGROUND, elements: [], notes: '' };
}

/** A new deck starts with one blank slide (SL-1). */
export function createDeck(env: Env, title: string = DEFAULT_DECK_TITLE): Deck {
  const at = env.now();
  return freeze(
    {
      schemaVersion: SCHEMA_VERSION,
      id: env.newId(),
      title: normaliseTitle(title),
      createdAt: at,
      updatedAt: at,
      slides: [createSlide(env.newId())],
    },
    true,
  );
}

/** A copy that shares no ids with the original, so both can live side by side (SV-2). */
export function duplicateDeck(deck: Deck, env: Env): Deck {
  const at = env.now();
  return freeze(
    {
      schemaVersion: SCHEMA_VERSION,
      id: env.newId(),
      title: `Copy of ${deck.title}`,
      createdAt: at,
      updatedAt: at,
      slides: deck.slides.map((slide) => ({
        ...slide,
        id: env.newId(),
        elements: slide.elements.map((element) => ({ ...element, id: env.newId() })),
      })),
    },
    true,
  );
}

/** A title is never empty or padded with spaces. */
export function normaliseTitle(title: string): string {
  return title.trim() || DEFAULT_DECK_TITLE;
}
