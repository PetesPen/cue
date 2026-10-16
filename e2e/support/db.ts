import type { Page } from '@playwright/test';

// Reading what the editor has saved, straight from the browser's database, so a test can tell that
// something was saved (or has not been yet) without leaning on the "Saved" label.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Every deck in the browser's database, as plain data. */
async function readDecks(page: Page): Promise<unknown[]> {
  const text = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cue');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(request.error?.message ?? 'The database did not open'));
      };
    });
    const decks = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction('decks').objectStore('decks').getAll();
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(request.error?.message ?? 'The decks were not read'));
      };
    });
    db.close();
    return JSON.stringify(decks);
  });
  const decks: unknown = JSON.parse(text);
  return Array.isArray(decks) ? (decks as unknown[]) : [];
}

/** The slides of the first deck. */
async function savedSlides(page: Page): Promise<unknown[]> {
  const deck = (await readDecks(page))[0];
  const slides = isRecord(deck) ? deck.slides : undefined;
  return Array.isArray(slides) ? (slides as unknown[]) : [];
}

/** The notes of each slide of the first deck. */
export async function savedNotes(page: Page): Promise<string[]> {
  return (await savedSlides(page)).map((slide) =>
    isRecord(slide) && typeof slide.notes === 'string' ? slide.notes : '',
  );
}

/** The fill of the first element of the first slide. */
export async function savedFill(page: Page): Promise<string | undefined> {
  const slide = (await savedSlides(page))[0];
  const elements = isRecord(slide) ? slide.elements : undefined;
  const element: unknown = Array.isArray(elements) ? (elements as unknown[])[0] : undefined;
  return isRecord(element) && typeof element.fill === 'string' ? element.fill : undefined;
}

/** Everything stored for every deck, as one piece of text, to tell that nothing in it changed. */
export async function savedDecksText(page: Page): Promise<string> {
  return JSON.stringify(await readDecks(page));
}
