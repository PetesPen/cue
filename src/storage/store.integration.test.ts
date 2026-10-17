import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { applyCommand, createDeck, createImage, type Deck, type Env } from '@/model';
import { Autosaver } from './autosave';
import { CueDatabase, type StoredImage } from './database';
import { createDeckStore, type DeckStore } from './store';

let counter = 0;
const clock = { time: 1000 };
const env: Env = { newId: () => `id-${String(++counter)}`, now: () => clock.time };

const stores: DeckStore[] = [];
function openStore(name = `test-${crypto.randomUUID()}`): DeckStore {
  const store = createDeckStore(name);
  stores.push(store);
  return store;
}
afterEach(() => {
  while (stores.length > 0) stores.pop()?.close();
});

function deckAt(time: number, title: string): Deck {
  clock.time = time;
  return createDeck(env, title);
}

function image(hash: string, bytes: number[]): StoredImage {
  return { hash, type: 'image/jpeg', bytes: new Uint8Array(bytes) };
}

describe('the deck store (SV-1, SV-2)', () => {
  test('Given a saved deck, When the app is reopened (a new connection), Then the deck comes back exactly as left', async () => {
    const name = `reopen-${crypto.randomUUID()}`;
    const first = openStore(name);
    let deck = deckAt(1000, 'Autumn Launch');
    deck = applyCommand(deck, {
      type: 'addSlide',
      slideId: 'new',
      afterSlideId: deck.slides[0]?.id ?? '',
      at: 2000,
    }).deck;
    await first.save(deck);
    first.close();

    const reopened = openStore(name);

    expect(await reopened.load(deck.id)).toEqual(deck);
  });

  test('Given a save that is still running, When the library is listed and the deck loaded, Then they already include it', async () => {
    const store = openStore();
    const deck = deckAt(1000, 'Just saved');

    const saving = store.save(deck); // not awaited: the editor was left with an edit on its way
    const listed = await store.list();
    const loaded = await store.load(deck.id);
    await saving;

    expect(listed.map((s) => s.title)).toEqual(['Just saved']);
    expect(loaded).toEqual(deck);
  });

  test('Given a remove that is still running, When the library is listed, Then the deck is already gone', async () => {
    const store = openStore();
    const deck = deckAt(1000, 'Doomed');
    await store.save(deck);

    const removing = store.remove(deck.id);
    const listed = await store.list();
    await removing;

    expect(listed).toEqual([]);
  });

  test('Given no such deck, When it is loaded, Then the answer is "not found", not an error', async () => {
    expect(await openStore().load('nope')).toBeUndefined();
  });

  test('Given three decks edited at different times, When they are listed, Then the newest edit comes first', async () => {
    const store = openStore();
    const old = deckAt(1000, 'Old');
    const newest = deckAt(3000, 'Newest');
    const middle = deckAt(2000, 'Middle');
    for (const deck of [old, newest, middle]) await store.save(deck);

    const titles = (await store.list()).map((s) => s.title);

    expect(titles).toEqual(['Newest', 'Middle', 'Old']);
  });

  test('Given a deck with two slides, When the library lists it, Then the card has its title, slide count, date and first slide', async () => {
    const store = openStore();
    const start = deckAt(1000, 'Team offsite');
    const deck = applyCommand(start, {
      type: 'addSlide',
      slideId: 'second',
      afterSlideId: start.slides[0]?.id ?? '',
      at: 4000,
    }).deck;
    await store.save(deck);

    const [summary] = await store.list();

    expect(summary).toEqual({
      id: deck.id,
      title: 'Team offsite',
      updatedAt: 4000,
      slideCount: 2,
      firstSlide: deck.slides[0],
    });
  });

  test('Given a saved deck that is edited and saved again, When it is loaded, Then only the latest version is there', async () => {
    const store = openStore();
    const v1 = deckAt(1000, 'v1');
    await store.save(v1);
    const v2 = applyCommand(v1, { type: 'renameDeck', title: 'v2', at: 2000 }).deck;
    await store.save(v2);

    expect((await store.list()).map((s) => s.title)).toEqual(['v2']);
  });

  test('Given a saved deck, When it is removed, Then it is gone from the list and cannot be loaded', async () => {
    const store = openStore();
    const keep = deckAt(1000, 'Keep');
    const drop = deckAt(2000, 'Drop');
    await store.save(keep);
    await store.save(drop);

    await store.remove(drop.id);

    expect((await store.list()).map((s) => s.title)).toEqual(['Keep']);
    expect(await store.load(drop.id)).toBeUndefined();
  });

  test('Given a saved deck, When it is duplicated, Then a second deck exists with its own ids and "Copy of" title', async () => {
    const store = openStore();
    const deck = deckAt(1000, 'Q3 review');
    await store.save(deck);
    clock.time = 5000;

    const copy = await store.duplicate(deck.id, env);

    expect(copy?.title).toBe('Copy of Q3 review');
    expect(copy?.id).not.toBe(deck.id);
    const titles = (await store.list()).map((s) => s.title);
    expect(titles).toEqual(['Copy of Q3 review', 'Q3 review']);
    expect(await store.load(deck.id)).toEqual(deck);
  });

  test('Given no such deck, When it is duplicated, Then nothing is created', async () => {
    const store = openStore();

    expect(await store.duplicate('nope', env)).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });

  test('Given stored data that is not a valid deck, When it is loaded, Then it fails loudly instead of showing garbage', async () => {
    const name = `damaged-${crypto.randomUUID()}`;
    const store = openStore(name);
    await store.save(deckAt(1000, 'Fine'));
    const db = (await import('dexie')).default;
    const raw = new db(name);
    await raw.open();
    await raw.table('decks').put({ id: 'broken', updatedAt: 1, schemaVersion: 1 });
    raw.close();

    await expect(store.load('broken')).rejects.toThrow(/missing a field/);
  });

  test('Given one damaged record and one deck from a newer Cue, When the library is listed, Then the readable decks still show and nothing is deleted', async () => {
    const name = `mixed-${crypto.randomUUID()}`;
    const store = openStore(name);
    await store.save(deckAt(3000, 'Readable'));
    const Dexie = (await import('dexie')).default;
    const raw = new Dexie(name);
    await raw.open();
    await raw.table('decks').put({ id: 'broken', updatedAt: 2000, schemaVersion: 1 });
    await raw.table('decks').put({ ...deckAt(1000, 'From the future'), schemaVersion: 99 });
    raw.close();

    expect((await store.list()).map((s) => s.title)).toEqual(['Readable']);
    await expect(store.load('broken')).rejects.toThrow();
    const kept = new Dexie(name);
    await kept.open();
    expect(await kept.table('decks').count()).toBe(3);
    kept.close();
  });
});

describe('decks that cannot be read are listed so they can be deleted (SV-3, decision 17)', () => {
  test('Given a damaged record, a deck from a newer Cue and a good deck, When the unreadable ones are listed, Then the first two are, with what is known of them, and the good one is not', async () => {
    const name = `unreadable-${crypto.randomUUID()}`;
    const store = openStore(name);
    await store.save(deckAt(3000, 'Readable'));
    const Dexie = (await import('dexie')).default;
    const raw = new Dexie(name);
    await raw.open();
    await raw
      .table('decks')
      .put({ id: 'broken', title: 'Half a deck', updatedAt: 2000, schemaVersion: 1 });
    await raw.table('decks').put({ id: 'nameless', updatedAt: 2000, schemaVersion: 1 });
    await raw
      .table('decks')
      .put({ ...deckAt(1000, 'From the future'), id: 'future', schemaVersion: 99 });
    raw.close();

    const unreadable = (await store.listUnreadable()).sort((a, b) => a.id.localeCompare(b.id));

    expect(unreadable).toEqual([
      { id: 'broken', title: 'Half a deck', newer: false },
      { id: 'future', title: 'From the future', newer: true },
      { id: 'nameless', title: undefined, newer: false },
    ]);
  });

  test('Given an unreadable deck, When it is deleted, Then it goes, and the readable decks stay', async () => {
    const name = `unreadable-${crypto.randomUUID()}`;
    const store = openStore(name);
    await store.save(deckAt(3000, 'Readable'));
    const Dexie = (await import('dexie')).default;
    const raw = new Dexie(name);
    await raw.open();
    await raw.table('decks').put({ id: 'broken', updatedAt: 2000, schemaVersion: 1 });
    raw.close();

    await store.remove('broken');

    expect(await store.listUnreadable()).toEqual([]);
    expect((await store.list()).map((d) => d.title)).toEqual(['Readable']);
  });

  test('Given only readable decks, Then nothing is unreadable', async () => {
    const store = openStore();
    await store.save(deckAt(1000, 'One'));

    expect(await store.listUnreadable()).toEqual([]);
  });
});

describe('photos live with the deck (SV-1, docs/spikes/SP-5.md)', () => {
  test('Given a deck saved with photos, When a photo is loaded, Then the bytes and type are exactly what was stored', async () => {
    const store = openStore();
    const deck = deckAt(1000, 'With photos');

    await store.save(deck, [image('hash-a', [1, 2, 3]), image('hash-b', [9, 8, 7, 6])]);

    const a = await store.loadImage('hash-a');
    expect(a?.type).toBe('image/jpeg');
    expect([...(a?.bytes ?? [])]).toEqual([1, 2, 3]);
    expect([...((await store.loadImage('hash-b'))?.bytes ?? [])]).toEqual([9, 8, 7, 6]);
    expect(await store.loadImage('hash-missing')).toBeUndefined();
  });

  test('Given a save where one photo cannot be stored, When it fails, Then neither the deck change nor the other photo is left behind', async () => {
    const store = openStore();
    const v1 = deckAt(1000, 'Before');
    await store.save(v1);
    const v2 = applyCommand(v1, { type: 'renameDeck', title: 'After', at: 2000 }).deck;
    // A function cannot be copied into the database, so storing this "photo" fails midway.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const unstorable = { hash: 'bad', type: 'image/png', bytes: () => undefined } as never;

    await expect(store.save(v2, [image('good', [1]), unstorable])).rejects.toThrow();

    expect((await store.load(v1.id))?.title).toBe('Before');
    expect(await store.loadImage('good')).toBeUndefined();
  });

  test('Given photos no deck refers to, When orphans are swept, Then only those are deleted and the count is returned', async () => {
    const store = openStore();
    await store.save(deckAt(1000, 'D'), [
      image('used', [1]),
      image('orphan-1', [2]),
      image('orphan-2', [3]),
    ]);

    const removed = await store.sweepOrphanImages(new Set(['used']));

    expect(removed).toBe(2);
    expect(await store.loadImage('used')).toBeDefined();
    expect(await store.loadImage('orphan-1')).toBeUndefined();
  });
});

describe('sweeping photos no deck shows (EL-4)', () => {
  /** A deck whose first slide shows these pictures. */
  function showing(time: number, title: string, ...hashes: string[]): Deck {
    const deck = deckAt(time, title);
    return {
      ...deck,
      slides: deck.slides.map((slide, i) =>
        i === 0
          ? {
              ...slide,
              elements: hashes.map((hash, n) =>
                createImage(`img-${String(n)}-${hash}`, hash, {
                  x: 0,
                  y: 0,
                  width: 10,
                  height: 10,
                }),
              ),
            }
          : slide,
      ),
    };
  }

  test('Given decks that show some photos, When the store sweeps, Then only the photos no deck shows are deleted', async () => {
    const store = openStore();
    await store.save(showing(1000, 'One', 'a', 'b'), [image('a', [1]), image('b', [2])]);
    await store.save(showing(2000, 'Two', 'b'), [image('c', [3]), image('d', [4])]);

    const removed = await store.sweepUnusedImages();

    expect(removed).toBe(2);
    expect(await store.loadImage('a')).toBeDefined();
    expect(await store.loadImage('b')).toBeDefined();
    expect(await store.loadImage('c')).toBeUndefined();
    expect(await store.loadImage('d')).toBeUndefined();
  });

  test('Given a photo two decks show, When one deck is removed and the store sweeps, Then the photo stays for the other', async () => {
    const store = openStore();
    const one = showing(1000, 'One', 'shared');
    await store.save(one, [image('shared', [1])]);
    await store.save(showing(2000, 'Two', 'shared'));

    await store.remove(one.id);
    await store.sweepUnusedImages();

    expect(await store.loadImage('shared')).toBeDefined();
  });

  test('Given the last deck that showed a photo is removed, When the store sweeps, Then the photo is deleted', async () => {
    const store = openStore();
    const only = showing(1000, 'Only', 'lonely');
    await store.save(only, [image('lonely', [1])]);

    await store.remove(only.id);

    expect(await store.sweepUnusedImages()).toBe(1);
    expect(await store.loadImage('lonely')).toBeUndefined();
  });

  test('Given a stored deck that cannot be read, When the store sweeps, Then nothing is deleted, because its photos are not known', async () => {
    const name = `damaged-${crypto.randomUUID()}`;
    const store = openStore(name);
    await store.save(showing(1000, 'Fine', 'a'), [image('a', [1]), image('b', [2])]);
    const db = new CueDatabase(name);
    await db.table('decks').put({ id: 'broken', schemaVersion: 1, title: 'x' });
    db.close();

    expect(await store.sweepUnusedImages()).toBe(0);
    expect(await store.loadImage('b')).toBeDefined();
  });

  test('Given a save that lands while the sweep runs, When both finish, Then the new photo is still there', async () => {
    const store = openStore();
    await store.save(showing(1000, 'Old', 'old'), [image('old', [1])]);

    const sweeping = store.sweepUnusedImages();
    const saving = store.save(showing(2000, 'New', 'fresh'), [image('fresh', [2])]);
    await Promise.all([sweeping, saving]);

    expect(await store.loadImage('fresh')).toBeDefined();
    expect(await store.loadImage('old')).toBeDefined();
  });
});

describe('originals of scaled pictures (EL-4)', () => {
  const original = (hash: string, bytes: number[]) => ({
    hash,
    type: 'image/png',
    bytes: new Uint8Array(bytes),
  });
  const showing = (hash: string): Deck => {
    const deck = deckAt(1000, 'D');
    return {
      ...deck,
      slides: deck.slides.map((slide) => ({
        ...slide,
        elements: [createImage('p', hash, { x: 0, y: 0, width: 10, height: 10 })],
      })),
    };
  };

  test('Given a picture saved with its original, When both are loaded, Then each is as saved, and loading the picture does not need the original', async () => {
    const store = openStore();

    await store.save(showing('h'), [image('h', [1, 2])], [original('h', [9, 9, 9, 9])]);

    expect((await store.loadImage('h'))?.bytes).toEqual(new Uint8Array([1, 2]));
    expect((await store.loadOriginal('h'))?.bytes).toEqual(new Uint8Array([9, 9, 9, 9]));
  });

  test('Given a picture saved without an original, When the original is asked for, Then there is none', async () => {
    const store = openStore();
    await store.save(showing('h'), [image('h', [1])]);

    expect(await store.loadOriginal('h')).toBeUndefined();
  });

  test('Given a save where the original cannot be stored, When it fails, Then neither the picture nor the deck change is left behind', async () => {
    const store = openStore();
    // A function cannot be copied into the database, so storing this original fails midway.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const unstorable = { hash: 'h', type: 'image/png', bytes: () => undefined } as never;

    await expect(store.save(showing('h'), [image('h', [1])], [unstorable])).rejects.toThrow();

    expect(await store.loadImage('h')).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });

  test('Given an unused picture with its original, When the store sweeps, Then both go; a used picture keeps its original', async () => {
    const store = openStore();
    await store.save(
      showing('used'),
      [image('used', [1]), image('unused', [2])],
      [original('used', [3]), original('unused', [4])],
    );

    expect(await store.sweepUnusedImages()).toBe(1);

    expect(await store.loadImage('unused')).toBeUndefined();
    expect(await store.loadOriginal('unused')).toBeUndefined();
    expect(await store.loadOriginal('used')).toBeDefined();
  });

  test('Given the older kind of database with no originals table, When the app opens it, Then it upgrades and keeps decks and pictures', async () => {
    const name = `old-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({ decks: 'id, updatedAt', images: 'hash' });
    const deck = showing('h');
    await old.table('decks').put(deck);
    await old.table('images').put(image('h', [7]));
    old.close();

    const store = openStore(name);

    expect(await store.load(deck.id)).toEqual(deck);
    expect((await store.loadImage('h'))?.bytes).toEqual(new Uint8Array([7]));
    expect(await store.loadOriginal('h')).toBeUndefined();
  });
});

describe('autosave onto the real store (SV-1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Given an edit, When the autosave delay passes, Then the deck is in the database and the state is "saved"', async () => {
    const store = openStore();
    const states: string[] = [];
    const saver = new Autosaver({
      save: (deck) => store.save(deck),
      onChange: (s) => states.push(s.status),
      delayMs: 20,
      maxWaitMs: 60,
    });
    const deck = deckAt(1000, 'Edited');

    saver.edit(deck);
    await vi.waitFor(async () => {
      expect(await store.load(deck.id)).toEqual(deck);
    });

    expect(states).toEqual(['saving', 'saved']);
  });
});
