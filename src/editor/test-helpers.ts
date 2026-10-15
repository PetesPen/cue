import { createSlide, type Deck } from '@/model';
import { createDeckStore, type DeckStore } from '@/storage';

/** Shared by the editor's component tests. Not part of the app. */

const open: DeckStore[] = [];

/** A store on a database of its own, so tests never see each other's decks. */
export function createTestStore(): DeckStore {
  const store = createDeckStore(`test-${crypto.randomUUID()}`);
  open.push(store);
  return store;
}

export function closeTestStores(): void {
  while (open.length > 0) open.pop()?.close();
}

/** A deck whose slides are called `<id>-1`, `<id>-2`, and so on. */
export function deckWithSlides(count: number, title = 'Autumn Launch', id = 'deck'): Deck {
  return {
    schemaVersion: 1,
    id,
    title,
    createdAt: 1000,
    updatedAt: Date.now(),
    slides: Array.from({ length: count }, (_, i) => createSlide(`${id}-${String(i + 1)}`)),
  };
}

/** The slide ids behind the rail's thumbnails, in order. */
export function railSlideIds(): string[] {
  return [...document.querySelectorAll<HTMLElement>('.rail-item .cue-slide')].map(
    (slide) => slide.dataset.slideId ?? '',
  );
}

/** The id of the slide the rail marks as current. */
export function selectedSlideId(): string | undefined {
  return document.querySelector<HTMLElement>('.rail-item[aria-selected="true"] .cue-slide')?.dataset
    .slideId;
}
