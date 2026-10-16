import { expect, type Page } from '@playwright/test';

// Put a deck straight into the browser's database and open it, so a test starts from a known deck
// without clicking it together (see tests/fixtures/autumnLaunch.ts).

export async function seedDeck(page: Page, deck: object, id: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
  await page.evaluate(
    async ({ stored }) => {
      // The app creates its database when it starts. A slow engine may not have finished by the time
      // the heading shows, so wait for the store to exist (and never create the database ourselves:
      // an aborted upgrade leaves nothing behind).
      const open = () =>
        new Promise<IDBDatabase | undefined>((resolve) => {
          const request = indexedDB.open('cue');
          request.onupgradeneeded = () => {
            request.transaction?.abort();
          };
          request.onsuccess = () => {
            resolve(request.result);
          };
          request.onerror = () => {
            resolve(undefined);
          };
        });
      let db: IDBDatabase | undefined;
      for (let attempt = 0; attempt < 100; attempt++) {
        db = await open();
        if (db?.objectStoreNames.contains('decks')) break;
        db?.close();
        db = undefined;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!db) throw new Error('The deck database did not appear');
      const ready = db;
      await new Promise<void>((resolve, reject) => {
        const tx = ready.transaction('decks', 'readwrite');
        tx.objectStore('decks').put(stored);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(new Error(tx.error?.message ?? 'The deck was not stored'));
        };
      });
      ready.close();
    },
    { stored: deck },
  );
  await page.evaluate((deckId) => {
    window.location.hash = `#/deck/${deckId}`;
  }, id);
  await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
}
