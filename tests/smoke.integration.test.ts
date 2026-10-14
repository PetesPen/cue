import { expect, test } from 'vitest';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB request failed'));
    };
  });
}

// Tooling smoke test: proves fake-indexeddb is loaded for the integration project. Replace with
// the autosave, many-decks and quota tests (SV-1, SV-2) when storage is built.
test('Given fake-indexeddb, When a record is written and read back, Then it round-trips', async () => {
  const open = indexedDB.open('smoke', 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore('decks');
  };
  const db = await request(open);

  const store = db.transaction('decks', 'readwrite').objectStore('decks');
  await request(store.put({ title: 'Autumn Launch' }, 'deck-1'));

  const read = db.transaction('decks', 'readonly').objectStore('decks');
  expect(await request(read.get('deck-1'))).toEqual({ title: 'Autumn Launch' });
  db.close();
});
