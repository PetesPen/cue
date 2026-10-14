import { afterEach, expect, test } from 'vitest';
import type { Env } from '@/model';
import { createDeckStore, type DeckStore } from '@/storage';
import { createStoredDeck, renameStoredDeck } from './library';

let counter = 0;
const clock = { time: 1000 };
const env: Env = { newId: () => `id-${String(++counter)}`, now: () => clock.time };

const stores: DeckStore[] = [];
function openStore(): DeckStore {
  const store = createDeckStore(`library-${crypto.randomUUID()}`);
  stores.push(store);
  return store;
}
afterEach(() => {
  while (stores.length > 0) stores.pop()?.close();
});

test('Given an empty library, When a deck is created, Then it is stored with one slide and listed', async () => {
  const store = openStore();

  const deck = await createStoredDeck(store, env);

  expect(deck.slides).toHaveLength(1);
  const [summary] = await store.list();
  expect(summary).toMatchObject({ id: deck.id, title: 'Untitled deck', slideCount: 1 });
});

test('Given a stored deck, When it is renamed from the library, Then the new title is stored and it moves to the top', async () => {
  const store = openStore();
  const older = await createStoredDeck(store, env);
  clock.time = 2000;
  await createStoredDeck(store, env);
  clock.time = 3000;

  await renameStoredDeck(store, older.id, '  Pitch v2  ', env);

  const titles = (await store.list()).map((s) => s.title);
  expect(titles).toEqual(['Pitch v2', 'Untitled deck']);
});

test('Given a deck that no longer exists, When it is renamed, Then nothing happens', async () => {
  const store = openStore();

  await renameStoredDeck(store, 'gone', 'Whatever', env);

  expect(await store.list()).toEqual([]);
});
