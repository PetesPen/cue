import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDeck, createImage, createSlide, type Deck, type Env } from '@/model';
import { DeckFileError } from './deckFileError';
import { makeDeckFile, openDeckFile } from './deckFileService';
import { fileNameFor, fontsOfDeck } from './deckInfo';
import { sha256Hex } from './hash';
import { createDeckStore, type DeckStore } from './store';

// The font files are read from the app's own folder through the browser; here they are pretend.
vi.mock('./bundledFonts', () => ({
  loadBundledFonts: (families: readonly string[]) =>
    Promise.resolve(
      families.map((family) => ({
        family,
        files: [{ name: 'face.woff2', bytes: new Uint8Array([1, 2, 3]) }],
        licence: `${family}: SIL Open Font License 1.1`,
      })),
    ),
}));

// SV-3: saving a deck from the store to a file, and opening a file into the store.

let counter = 0;
const env: Env = { newId: () => `new-${String(++counter)}`, now: () => 5000 };

const stores: DeckStore[] = [];
function openStore(): DeckStore {
  const store = createDeckStore(`file-${crypto.randomUUID()}`);
  stores.push(store);
  return store;
}
afterEach(() => {
  while (stores.length > 0) stores.pop()?.close();
});

async function deckWithPicture(store: DeckStore): Promise<Deck> {
  const bytes = new Uint8Array([10, 20, 30, 40, 50]);
  const image = { hash: await sha256Hex(bytes), type: 'image/png', bytes };
  const base = createDeck({ newId: () => 'src', now: () => 1000 }, 'Q3 review');
  const deck: Deck = {
    ...base,
    id: 'source',
    slides: [
      {
        ...createSlide('s1'),
        notes: 'Say hello',
        elements: [createImage('e1', image.hash, { x: 0, y: 0, width: 100, height: 50 })],
      },
    ],
  };
  await store.save(
    deck,
    [image],
    [{ hash: image.hash, type: 'image/jpeg', bytes: new Uint8Array([7, 7]) }],
  );
  return deck;
}

describe('saving a deck to a file (SV-3)', () => {
  test('Given a stored deck with a picture, When a file is made, Then it has the deck, the picture, its original and the fonts, and a name from the title', async () => {
    const store = openStore();
    const deck = await deckWithPicture(store);

    const made = await makeDeckFile(store, deck, 9000);

    expect(made.name).toBe('Q3 review.slides');
    expect(made.file.type).toBe('application/zip');
    expect(made.bytes).toBe(made.file.size);
    const other = openStore();
    const opened = await openDeckFile(other, made.file, env);
    expect(opened.slides).toEqual(deck.slides);
    const hash = [...imageHashesOf(deck)][0] ?? '';
    expect((await other.loadImage(hash))?.bytes).toEqual(new Uint8Array([10, 20, 30, 40, 50]));
    expect((await other.loadOriginal(hash))?.bytes).toEqual(new Uint8Array([7, 7]));
  });

  test('Given a picture that cannot be read from the store, When a file is made, Then it fails clearly and makes nothing', async () => {
    const store = openStore();
    const deck = await deckWithPicture(store);
    const gone: Deck = {
      ...deck,
      slides: [
        {
          ...createSlide('s2'),
          elements: [createImage('e9', 'f'.repeat(64), { x: 0, y: 0, width: 1, height: 1 })],
        },
      ],
    };

    await expect(makeDeckFile(store, gone, 1)).rejects.toThrow(/picture/);
  });

  test.each([
    ['Q3 review', 'Q3 review.slides'],
    ['Plans: 2027/28?', 'Plans 202728.slides'],
    ['', 'Cue deck.slides'],
    ['///', 'Cue deck.slides'],
    ['Café déjà vu', 'Café déjà vu.slides'],
    ['x'.repeat(200), `${'x'.repeat(80)}.slides`],
  ])('Given the title %j, When the file is named, Then it is %j', (title, name) => {
    expect(fileNameFor(title)).toBe(name);
  });

  test('Given a deck whose text uses two fonts, When the fonts are listed, Then each appears once', () => {
    const deck = createDeck(env, 'Fonts');

    expect(fontsOfDeck(deck)).toEqual([]);
  });
});

function imageHashesOf(deck: Deck): Set<string> {
  const hashes = new Set<string>();
  for (const slide of deck.slides) {
    for (const element of slide.elements) if (element.kind === 'image') hashes.add(element.hash);
  }
  return hashes;
}

describe('opening a deck file (SV-3)', () => {
  test('Given a file, When it is opened, Then the deck is added as a new one with its pictures, apart from its id and time', async () => {
    const source = openStore();
    const deck = await deckWithPicture(source);
    const made = await makeDeckFile(source, deck, 9000);
    const store = openStore();

    const opened = await openDeckFile(store, made.file, env);

    expect(opened.id).not.toBe(deck.id);
    expect(opened.updatedAt).toBe(5000);
    expect({ ...opened, id: '', updatedAt: 0 }).toEqual({ ...deck, id: '', updatedAt: 0 });
    expect(await store.load(opened.id)).toEqual(opened);
    const hash = [...imageHashesOf(deck)][0] ?? '';
    expect((await store.loadImage(hash))?.bytes).toEqual(new Uint8Array([10, 20, 30, 40, 50]));
    expect((await store.loadOriginal(hash))?.bytes).toEqual(new Uint8Array([7, 7]));
  });

  test('Given the same file opened twice, Then there are two decks, each its own, and neither replaced the other', async () => {
    const source = openStore();
    const deck = await deckWithPicture(source);
    const made = await makeDeckFile(source, deck, 9000);
    const store = openStore();

    const first = await openDeckFile(store, made.file, env);
    const second = await openDeckFile(store, made.file, env);

    expect(second.id).not.toBe(first.id);
    expect((await store.list()).map((d) => d.id).sort()).toEqual([first.id, second.id].sort());
  });

  test('Given a deck in the store with the same id as the file’s, When the file is opened, Then the stored deck is untouched', async () => {
    const store = openStore();
    const deck = await deckWithPicture(store);
    const made = await makeDeckFile(store, deck, 9000);

    await openDeckFile(store, made.file, env);

    expect(await store.load('source')).toEqual(deck);
  });

  test.each([
    ['a text file', new Blob(['not a deck'])],
    ['a zip of something else', new Blob([new Uint8Array(zipSync({ 'a.txt': strToU8('hi') }))])],
    ['an empty file', new Blob([])],
  ])(
    'Given %s, When it is opened, Then it is turned away and the store is exactly as it was',
    async (_name, blob) => {
      const store = openStore();
      const deck = await deckWithPicture(store);
      const before = await store.list();

      await expect(openDeckFile(store, blob, env)).rejects.toBeInstanceOf(DeckFileError);

      expect(await store.list()).toEqual(before);
      expect(await store.load(deck.id)).toEqual(deck);
    },
  );

  test('Given a file with a damaged picture, When it is opened, Then nothing of it is stored', async () => {
    const source = openStore();
    const deck = await deckWithPicture(source);
    const made = await makeDeckFile(source, deck, 9000);
    // Flip a byte of the stored picture inside the zip: its hash no longer matches.
    const bytes = new Uint8Array(await made.file.arrayBuffer());
    const at = bytes.findIndex(
      (_, i) => bytes[i] === 10 && bytes[i + 1] === 20 && bytes[i + 2] === 30,
    );
    expect(at).toBeGreaterThan(0);
    bytes[at] = 11;
    const store = openStore();

    await expect(openDeckFile(store, new Blob([bytes]), env)).rejects.toMatchObject({
      problem: 'damaged',
    });

    expect(await store.list()).toEqual([]);
    expect(await store.loadImage([...imageHashesOf(deck)][0] ?? '')).toBeUndefined();
  });
});
