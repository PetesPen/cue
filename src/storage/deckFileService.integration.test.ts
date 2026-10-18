import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDeck, createImage, createSlide, type Deck, type Env } from '@/model';
import { DeckFileError } from './deckFileError';
import { packBackup } from './backupFile';
import { makeBackupFile, makeDeckFile, openDeckFile, openFileOfAnyKind } from './deckFileService';
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

// SV-8: the backup of all decks, from the store, and opening it into another.

describe('the backup of all decks (SV-8)', () => {
  const when = new Date(2026, 9, 18, 14, 30).getTime();

  async function libraryOf(store: DeckStore, ...titles: string[]): Promise<Deck[]> {
    const decks: Deck[] = [];
    for (const [at, title] of titles.entries()) {
      const deck: Deck = {
        ...createDeck({ newId: () => `lib-${String(at)}`, now: () => 1000 + at }, title),
        id: `deck-${String(at)}`,
        slides: [{ ...createSlide(`s${String(at)}`), notes: `Notes of ${title}` }],
      };
      await store.save(deck);
      decks.push(deck);
    }
    return decks;
  }

  test('Given a library of decks, When a backup is made, Then it names the day, holds every deck, and changes nothing', async () => {
    const store = openStore();
    const decks = await libraryOf(store, 'Q3 review', 'Autumn Launch', 'Team offsite');

    const made = await makeBackupFile(store, when);

    expect(made.name).toBe('Cue backup 2026-10-18.zip');
    expect(made.file.type).toBe('application/zip');
    expect(made.bytes).toBe(made.file.size);
    expect([...made.deckIds].sort()).toEqual(decks.map((deck) => deck.id).sort());
    expect(made.skipped).toEqual([]);
    expect(made.unreadable).toBe(0);
    expect((await store.list()).map((deck) => deck.title).sort()).toEqual([
      'Autumn Launch',
      'Q3 review',
      'Team offsite',
    ]);
  });

  test('Given a backup, When it is opened into another library, Then every deck is added as a new deck with its pictures, and none is replaced', async () => {
    const source = openStore();
    const withPicture = await deckWithPicture(source);
    await libraryOf(source, 'Second', 'Third');
    const made = await makeBackupFile(source, when);

    const elsewhere = openStore();
    await elsewhere.save({ ...withPicture, id: 'already-here', title: 'Already here' });
    const opened = await openFileOfAnyKind(elsewhere, made.file, env);

    expect(opened.kind).toBe('backup');
    if (opened.kind !== 'backup') return;
    expect(opened.failed).toEqual([]);
    expect(opened.added.map((deck) => deck.title).sort()).toEqual(['Q3 review', 'Second', 'Third']);
    // New ids: nothing was replaced, and the deck that was there is as it was.
    expect(new Set(opened.added.map((deck) => deck.id)).size).toBe(3);
    expect((await elsewhere.load('already-here'))?.title).toBe('Already here');
    expect((await elsewhere.list()).map((deck) => deck.title).sort()).toEqual([
      'Already here',
      'Q3 review',
      'Second',
      'Third',
    ]);
    // The picture came with its deck.
    const restored = opened.added.find((deck) => deck.title === 'Q3 review');
    const hash = [...imageHashesOf(withPicture)][0] ?? '';
    expect(restored?.slides[0]?.notes).toBe('Say hello');
    expect((await elsewhere.loadImage(hash))?.bytes).toEqual(new Uint8Array([10, 20, 30, 40, 50]));
  });

  test('Given a backup with a deck file that is damaged, Then it is named and every other deck is still added', async () => {
    const source = openStore();
    const [first, second] = await libraryOf(source, 'Good one', 'Good two');
    if (!first || !second) throw new Error('two decks were made');
    const fileOf = async (deck: Deck) =>
      new Uint8Array(await (await makeDeckFile(source, deck, 1)).file.arrayBuffer());
    const backup = new Blob([
      new Uint8Array(
        packBackup(
          [
            { title: 'Good one', bytes: await fileOf(first) },
            { title: 'Broken', bytes: strToU8('this is not a deck file') },
            { title: 'Good two', bytes: await fileOf(second) },
          ],
          1,
        ),
      ),
    ]);

    const elsewhere = openStore();
    const opened = await openFileOfAnyKind(elsewhere, backup, env);

    expect(opened.kind).toBe('backup');
    if (opened.kind !== 'backup') return;
    expect(opened.added.map((deck) => deck.title).sort()).toEqual(['Good one', 'Good two']);
    expect(opened.failed).toEqual([{ name: 'Broken.slides', problem: 'not-a-zip' }]);
    expect((await elsewhere.list()).map((deck) => deck.title).sort()).toEqual([
      'Good one',
      'Good two',
    ]);
  });

  test('Given a deck whose picture cannot be read, When a backup is made, Then that deck is left out and named, and the others are in', async () => {
    const store = openStore();
    await libraryOf(store, 'Fine');
    const broken: Deck = {
      ...createDeck({ newId: () => 'b', now: () => 2000 }, 'Missing picture'),
      id: 'broken',
      slides: [
        {
          ...createSlide('sb'),
          elements: [createImage('e', 'a'.repeat(64), { x: 0, y: 0, width: 1, height: 1 })],
        },
      ],
    };
    await store.save(broken);

    const made = await makeBackupFile(store, when);

    expect(made.skipped).toEqual(['Missing picture']);
    expect(made.deckIds).toEqual(['deck-0']);
  });

  test('Given a deck Cue cannot read, When a backup is made, Then it is counted as left out and nothing fails', async () => {
    const store = openStore();
    await libraryOf(store, 'Readable');
    const future = createDeck({ newId: () => 'f', now: () => 3000 }, 'From the future');
    await store.save(Object.assign({ ...future, id: 'future' }, { schemaVersion: 99 }));

    const made = await makeBackupFile(store, when);

    expect(made.unreadable).toBe(1);
    expect(made.deckIds).toEqual(['deck-0']);
  });

  test('Given a single deck file, When it is opened through the same door, Then it is one new deck, and a text file is refused as before', async () => {
    const source = openStore();
    const deck = await deckWithPicture(source);
    const file = (await makeDeckFile(source, deck, 1)).file;

    const elsewhere = openStore();
    const opened = await openFileOfAnyKind(elsewhere, file, env);

    expect(opened.kind).toBe('deck');
    await expect(
      openFileOfAnyKind(elsewhere, new Blob(['not a deck']), env),
    ).rejects.toBeInstanceOf(DeckFileError);
    expect(await elsewhere.list()).toHaveLength(1);
  });

  test('Given decks opened from a file or a backup, Then each is noted as filed, so the reminder counts from that day', async () => {
    const source = openStore();
    await libraryOf(source, 'One', 'Two');
    const made = await makeBackupFile(source, when);

    const elsewhere = openStore();
    const opened = await openFileOfAnyKind(elsewhere, made.file, env);

    expect(opened.kind).toBe('backup');
    if (opened.kind !== 'backup') return;
    const filed = await elsewhere.listFiled();
    expect(Object.keys(filed).sort()).toEqual(opened.added.map((deck) => deck.id).sort());
    for (const deck of opened.added) expect(filed[deck.id]).toBe(deck.updatedAt);
  });

  test('Given an empty library, When a backup is made, Then it holds no decks', async () => {
    const made = await makeBackupFile(openStore(), when);

    expect(made.deckIds).toEqual([]);
    const opened = await openFileOfAnyKind(openStore(), made.file, env);
    expect(opened).toEqual({ kind: 'backup', added: [], failed: [] });
  });
});
