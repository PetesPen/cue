import { expect, type Page } from '@playwright/test';

// Shared by the screenshot tests: a one-slide deck written straight into the browser's database, so
// nothing depends on clicking, and the bundled fonts loaded before anything is photographed.

export const FOREST = '#14281B';
export const GREEN = '#17803F';
export const MINT = '#7FC8A0';
export const YELLOW = '#F5C542';
export const SAGE = '#E8F0E4';

/** Put a one-slide deck in the browser's database and open it in the editor. */
export async function openSeededDeck(page: Page, elements: readonly object[]) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
  await page.evaluate(async (seeded) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cue');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error(request.error?.message ?? 'The database did not open'));
      };
    });
    const now = Date.now();
    const deck = {
      schemaVersion: 1,
      id: 'visual',
      title: 'Visual test deck',
      createdAt: now,
      updatedAt: now,
      slides: [{ id: 'slide-1', background: '#FFFFFF', notes: '', elements: seeded }],
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite');
      tx.objectStore('decks').put(deck);
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(new Error(tx.error?.message ?? 'The deck was not stored'));
      };
    });
    db.close();
  }, elements);
  await page.evaluate(() => {
    window.location.hash = '#/deck/visual';
  });
  await expect(page.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  // The bundled UI font must be what draws the page, or the images would differ run to run.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
