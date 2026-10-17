import { strToU8, zipSync } from 'fflate';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  changeTransition,
  createImage,
  createShape,
  createSlide,
  createStep,
  createText,
  parseDeck,
  type Deck,
  type Slide,
  type TransitionKind,
} from '@/model';
import { autumnLaunch } from '../../tests/fixtures/autumnLaunch';
import {
  FILE_FORMAT,
  FILE_VERSION,
  LIMITS,
  packDeck,
  unpackDeck,
  type DeckFile,
  type EmbeddedFont,
} from './deckFile';
import { DeckFileError, type DeckFileProblem } from './deckFileError';
import { sha256Hex } from './hash';

// SV-3: a deck saved to a file and opened again is the same deck; a file that is not one is turned away.

const NOW = 1_760_000_000_000;

/** A picture of `length` bytes made from `seed`, with its real hash. */
async function picture(seed: number, length = 64) {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  for (let i = 0; i < length; i++) bytes[i] = (seed * 31 + i * 7) % 256;
  return { hash: await sha256Hex(bytes), type: 'image/png', bytes };
}

const font = (family: string): EmbeddedFont => ({
  family,
  files: [
    {
      name: `${family.toLowerCase().replaceAll(' ', '-')}.woff2`,
      bytes: new Uint8Array([1, 2, 3, 4]),
    },
  ],
  licence: `${family} is under the SIL Open Font License 1.1.`,
});

const slideWith = (id: string, change: Partial<Slide>): Slide => ({
  ...createSlide(id),
  ...change,
});

/** A deck with every kind of thing in it. */
async function richDeck(): Promise<DeckFile> {
  const image = await picture(1);
  const other = await picture(2, 200);
  const slides: Slide[] = [
    slideWith('a', {
      background: '#14281B',
      notes: 'Open with the problem.\nThen the product, “quoted”, and ünïcödé ✓.',
      elements: [
        createShape('a-shape', 'ellipse', { x: 10, y: 20, width: 300, height: 200 }),
        createText('a-text', { x: 50, y: 60 }),
        createImage('a-image', image.hash, { x: 0, y: 0, width: 400, height: 300 }, 'A picture'),
      ],
      animations: [
        createStep('a-1', 'a-shape', 'appear'),
        createStep('a-2', 'a-shape', 'move', 'with-previous', { x: 700, y: 400 }),
        createStep('a-3', 'a-image', 'disappear'),
      ],
    }),
    slideWith('b', {
      transition: changeTransition(createSlide('x').transition, {
        kind: 'push',
        from: 'bottom',
        duration: 1.4,
      }),
      elements: [createImage('b-image', other.hash, { x: 5, y: 5, width: 50, height: 50 })],
    }),
  ];
  const deck: Deck = {
    schemaVersion: 1,
    id: 'deck-1',
    title: 'A deck with “everything”',
    createdAt: 1000,
    updatedAt: 2000,
    slides,
  };
  return {
    deck,
    images: [image, other],
    originals: [{ hash: image.hash, type: 'image/jpeg', bytes: new Uint8Array([9, 9, 9]) }],
    fonts: [font('Instrument Sans'), font('DM Serif Display')],
  };
}

const problemOf = async (
  bytes: Uint8Array,
  limits = LIMITS,
): Promise<DeckFileProblem | undefined> => {
  try {
    await unpackDeck(bytes, limits);
    return undefined;
  } catch (error) {
    if (error instanceof DeckFileError) return error.problem;
    throw error;
  }
};

/** A zip made by hand, for the files that are not quite right. */
const zipOf = (entries: Record<string, string | Uint8Array>): Uint8Array =>
  zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, value]): [string, Uint8Array] => [
        name,
        typeof value === 'string' ? strToU8(value) : value,
      ]),
    ),
  );

const manifest = (deck: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: FILE_FORMAT,
    formatVersion: FILE_VERSION,
    savedAt: NOW,
    deck,
    images: [],
    originals: [],
    fonts: [],
    ...extra,
  });

describe('saving a deck and opening it again (SV-3)', () => {
  test('Given a deck with text, shapes, pictures, notes, animations, a transition, originals and fonts, When it is saved and opened, Then everything is the same', async () => {
    const file = await richDeck();

    const opened = await unpackDeck(packDeck(file, NOW));

    expect(opened.deck).toEqual(file.deck);
    expect(opened.images).toEqual(file.images);
    expect(opened.originals).toEqual(file.originals);
    expect(opened.fonts).toEqual(file.fonts);
  });

  test('Given Autumn Launch, When it is saved and opened, Then every slide is exactly as it was', async () => {
    const deck = parseDeck(autumnLaunch());

    const opened = await unpackDeck(packDeck({ deck, images: [], originals: [], fonts: [] }, NOW));

    expect(opened.deck).toEqual(deck);
    expect(opened.deck.slides).toHaveLength(12);
  });

  test('Given the same deck and time, When it is saved twice, Then the files are byte for byte the same', async () => {
    const file = await richDeck();

    expect(packDeck(file, NOW)).toEqual(packDeck(file, NOW));
  });

  test('Given a computer whose clock is wrong (before 1980, after 2099, or not a time), When a deck is saved, Then the file is still made and opens', async () => {
    const file = await richDeck();

    for (const savedAt of [0, 9000, Date.UTC(2200, 0, 1), Number.NaN]) {
      const opened = await unpackDeck(packDeck(file, savedAt));

      expect(opened.deck).toEqual(file.deck);
    }
  });

  test('Given a deck with a picture, Then the picture is in the file once, by its hash, however many boxes show it', async () => {
    const image = await picture(3);
    const deck: Deck = {
      schemaVersion: 1,
      id: 'd',
      title: 'T',
      createdAt: 1,
      updatedAt: 1,
      slides: [
        slideWith('s1', {
          elements: [
            createImage('e1', image.hash, { x: 0, y: 0, width: 10, height: 10 }),
            createImage('e2', image.hash, { x: 20, y: 0, width: 10, height: 10 }),
          ],
        }),
      ],
    };

    const opened = await unpackDeck(
      packDeck({ deck, images: [image], originals: [], fonts: [] }, NOW),
    );

    expect(opened.images.map((i) => i.hash)).toEqual([image.hash]);
  });

  test('Given any deck, When it is saved and opened, Then it is the same deck (property)', async () => {
    const kinds: TransitionKind[] = ['none', 'fade', 'slide', 'push', 'zoom'];
    const slide = fc
      .record({
        notes: fc.string({ maxLength: 60 }),
        background: fc.constantFrom('#FFFFFF', '#14281B', '#F5C542'),
        x: fc.integer({ min: -200, max: 2200 }),
        width: fc.integer({ min: 0, max: 1920 }),
        kind: fc.constantFrom(...kinds),
        seconds: fc.integer({ min: 2, max: 30 }),
        steps: fc.integer({ min: 0, max: 3 }),
      })
      .map(({ notes, background, x, width, kind, seconds, steps }) =>
        slideWith(`s${String(x)}${String(width)}`, {
          notes,
          background,
          transition: changeTransition(createSlide('t').transition, {
            kind,
            duration: seconds / 10,
          }),
          elements: [createShape('shape', 'rectangle', { x, y: 5, width, height: 50 })],
          animations: Array.from({ length: steps }, (_, i) =>
            createStep(`step${String(i)}`, 'shape', i % 2 === 0 ? 'appear' : 'disappear'),
          ),
        }),
      );
    await fc.assert(
      fc.asyncProperty(
        fc.array(slide, { minLength: 1, maxLength: 4 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (slides, title) => {
          const deck: Deck = {
            schemaVersion: 1,
            id: 'x',
            title,
            createdAt: 1,
            updatedAt: 2,
            slides: slides.map((s, i) => ({ ...s, id: `${s.id}-${String(i)}` })),
          };

          const opened = await unpackDeck(
            packDeck({ deck, images: [], originals: [], fonts: [] }, NOW),
          );

          expect(opened.deck).toEqual(parseDeck(JSON.parse(JSON.stringify(deck))));
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('a file that is not a deck, or is damaged, is turned away (SV-3)', () => {
  test.each<[string, () => Uint8Array | Promise<Uint8Array>, DeckFileProblem]>([
    ['nothing at all', () => new Uint8Array(), 'not-a-zip'],
    ['plain text', () => strToU8('This is not a deck.'), 'not-a-zip'],
    [
      'the bytes of a PNG',
      () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]),
      'not-a-zip',
    ],
    [
      'a zip of something else',
      () => zipOf({ 'notes.txt': 'hello', 'photo.jpg': new Uint8Array(20) }),
      'not-cue',
    ],
    [
      'a zip whose deck.json is another format',
      () => zipOf({ 'deck.json': JSON.stringify({ format: 'something-else', deck: {} }) }),
      'not-cue',
    ],
    ['a deck.json that is not JSON', () => zipOf({ 'deck.json': '{ nope' }), 'damaged'],
    [
      'a deck.json with no version',
      () => zipOf({ 'deck.json': JSON.stringify({ format: FILE_FORMAT, deck: {} }) }),
      'damaged',
    ],
    [
      'a deck with no slides',
      () =>
        zipOf({
          'deck.json': manifest({
            schemaVersion: 1,
            id: 'd',
            title: 't',
            createdAt: 1,
            updatedAt: 1,
            slides: [],
          }),
        }),
      'damaged',
    ],
    ['a deck that is not an object', () => zipOf({ 'deck.json': manifest('a deck') }), 'damaged'],
  ])('Given %s, When it is opened, Then it says %s', async (_name, make, problem) => {
    expect(await problemOf(await make())).toBe(problem);
  });

  test('Given a file made by a newer layout of the file, Then it says it is newer, with the version', async () => {
    const file = await richDeck();
    const text = manifest(file.deck, { formatVersion: 7 });

    await expect(unpackDeck(zipOf({ 'deck.json': text }))).rejects.toMatchObject({
      problem: 'newer',
      version: 7,
    });
  });

  test('Given a deck saved by a newer Cue, Then it says it is newer, with the version', async () => {
    const file = await richDeck();
    const text = manifest({ ...file.deck, schemaVersion: 99 });

    await expect(unpackDeck(zipOf({ 'deck.json': text }))).rejects.toMatchObject({
      problem: 'newer',
      version: 99,
    });
  });

  test('Given a valid file cut short, Then it is turned away, not half-opened', async () => {
    const bytes = packDeck(await richDeck(), NOW);

    for (const length of [10, Math.floor(bytes.length / 2), bytes.length - 5]) {
      expect(['not-a-zip', 'damaged']).toContain(await problemOf(bytes.slice(0, length)));
    }
  });

  test('Given a picture the deck shows that is not in the file, Then it is damaged', async () => {
    const file = await richDeck();
    const bytes = packDeck({ ...file, images: file.images.slice(0, 1) }, NOW);

    expect(await problemOf(bytes)).toBe('damaged');
  });

  test('Given a picture whose bytes do not match its name, Then it is damaged', async () => {
    const file = await richDeck();
    const [first, second] = file.images;
    if (!first || !second) throw new Error('two pictures');
    const bytes = packDeck({ ...file, images: [{ ...first, bytes: second.bytes }, second] }, NOW);

    expect(await problemOf(bytes)).toBe('damaged');
  });

  test('Given a picture of a type Cue does not use, Then it is damaged', async () => {
    const file = await richDeck();
    const [first, second] = file.images;
    if (!first || !second) throw new Error('two pictures');
    const bytes = packDeck(
      { ...file, images: [{ ...first, type: 'application/x-evil' }, second] },
      NOW,
    );

    expect(await problemOf(bytes)).toBe('damaged');
  });

  test('Given names that leave the file’s folders, Then they are never read', async () => {
    const file = await richDeck();
    const text = manifest(file.deck, {
      images: [{ hash: 'x', type: 'image/png', file: '../../etc/passwd' }],
    });

    expect(await problemOf(zipOf({ 'deck.json': text, '../../etc/passwd': 'secret' }))).toBe(
      'damaged',
    );
  });

  test('Given a file with extra entries it does not name, Then they are ignored and the deck opens', async () => {
    const file = await richDeck();
    expect(await problemOf(packDeck(file, NOW))).toBeUndefined();
    // The same deck inside a zip that also carries other things.
    const opened = await unpackDeck(
      zipOf({
        'deck.json': manifest(file.deck, {
          images: file.images.map((image) => ({
            hash: image.hash,
            type: image.type,
            file: `images/${image.hash}.png`,
          })),
        }),
        ...Object.fromEntries(
          file.images.map((image) => [`images/${image.hash}.png`, image.bytes]),
        ),
        'evil/../x.txt': 'ignored',
        'extra/readme.md': 'also ignored',
      }),
    );
    expect(opened.deck).toEqual(file.deck);
  });

  test('Given more entries or more bytes than the limits, Then it is too large, before anything is unpacked', async () => {
    const bytes = packDeck(await richDeck(), NOW);

    expect(
      await problemOf(bytes, {
        entries: 3,
        entryBytes: LIMITS.entryBytes,
        totalBytes: LIMITS.totalBytes,
      }),
    ).toBe('too-large');
    expect(
      await problemOf(bytes, {
        entries: LIMITS.entries,
        entryBytes: 100,
        totalBytes: LIMITS.totalBytes,
      }),
    ).toBe('too-large');
    expect(
      await problemOf(bytes, {
        entries: LIMITS.entries,
        entryBytes: LIMITS.entryBytes,
        totalBytes: 500,
      }),
    ).toBe('too-large');
  });

  test('Given an original for a picture that is not in the file, Then it is left out', async () => {
    const file = await richDeck();
    const stray = { hash: 'f'.repeat(64), type: 'image/jpeg', bytes: new Uint8Array([1]) };

    const opened = await unpackDeck(
      packDeck({ ...file, originals: [...file.originals, stray] }, NOW),
    );

    expect(opened.originals.map((o) => o.hash)).toEqual(file.originals.map((o) => o.hash));
  });
});

describe('the fonts in the file (decision 38)', () => {
  test('Given fonts, When the file is read, Then every family has its files and the licence text with them', async () => {
    const file = await richDeck();

    const opened = await unpackDeck(packDeck(file, NOW));

    for (const family of opened.fonts) {
      expect(family.licence).toContain('SIL Open Font License');
      expect(family.files.length).toBeGreaterThan(0);
    }
    expect(opened.fonts.map((f) => f.family)).toEqual(['Instrument Sans', 'DM Serif Display']);
  });
});
