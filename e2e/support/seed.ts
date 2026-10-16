import { expect, type Page } from '@playwright/test';

// Put a deck straight into the browser's database and open it, so a test starts from a known deck
// without clicking it together (see tests/fixtures/autumnLaunch.ts).

export async function seedDeck(page: Page, deck: object, id: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
  await page.evaluate(
    async ({ stored }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('cue');
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new Error(request.error?.message ?? 'The database did not open'));
        };
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('decks', 'readwrite');
        tx.objectStore('decks').put(stored);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(new Error(tx.error?.message ?? 'The deck was not stored'));
        };
      });
      db.close();
    },
    { stored: deck },
  );
  await page.evaluate((deckId) => {
    window.location.hash = `#/deck/${deckId}`;
  }, id);
  await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
}
