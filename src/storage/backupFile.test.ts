import { strToU8, unzipSync, zipSync } from 'fflate';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { BACKUP_VERSION, backupNames, packBackup, unpackBackup } from './backupFile';
import { DeckFileError } from './deckFileError';

// SV-8: the backup of all decks is a plain zip of deck files, with a note saying what it is.

const bytes = (...values: number[]) => new Uint8Array(values);

describe('the backup of all decks as a file (SV-8)', () => {
  test('Given several decks, When they are packed and unpacked, Then every deck file comes back whole and in order', () => {
    const packed = packBackup(
      [
        { title: 'Q3 review', bytes: bytes(1, 2, 3) },
        { title: 'Autumn Launch', bytes: bytes(4, 5) },
      ],
      1_760_000_000_000,
    );

    const unpacked = unpackBackup(packed);

    expect(unpacked?.decks.map((deck) => deck.name)).toEqual([
      'Autumn Launch.slides',
      'Q3 review.slides',
    ]);
    expect(unpacked?.decks.find((deck) => deck.name === 'Q3 review.slides')?.bytes).toEqual(
      bytes(1, 2, 3),
    );
    expect(unpacked?.decks.find((deck) => deck.name === 'Autumn Launch.slides')?.bytes).toEqual(
      bytes(4, 5),
    );
  });

  test('Given a backup, Then anyone can unzip it: a folder of deck files and a note, and the deck files are stored as they are', () => {
    const files = unzipSync(
      packBackup([{ title: 'One', bytes: bytes(9, 9, 9) }], 1_760_000_000_000),
    );

    expect(Object.keys(files).sort()).toEqual(['backup.json', 'decks/One.slides']);
    const note: unknown = JSON.parse(new TextDecoder().decode(files['backup.json']));
    expect(note).toMatchObject({ format: 'cue-backup', formatVersion: BACKUP_VERSION });
  });

  test('Given decks with the same title, Then their files get different names, and every name is a safe one', () => {
    expect(backupNames(['Talk', 'talk', 'Talk', 'Other'])).toEqual([
      'Talk.slides',
      'talk (2).slides',
      'Talk (3).slides',
      'Other.slides',
    ]);
    expect(backupNames(['///', ''])).toEqual(['Cue deck.slides', 'Cue deck (2).slides']);
  });

  test('Given any titles, Then the names are all different and none can leave the folder', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 30 }), { maxLength: 20 }), (titles) => {
        const names = backupNames(titles);
        expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);
        for (const name of names) {
          expect(name.includes('/') || name.includes(String.fromCharCode(92))).toBe(false);
          expect(name.endsWith('.slides')).toBe(true);
        }
      }),
    );
  });

  test('Given a single deck file, Then it is not a backup', () => {
    const deckFile = zipSync({ 'deck.json': strToU8('{}') });
    expect(unpackBackup(deckFile)).toBeUndefined();
  });

  test('Given bytes that are not a zip, Then they are not a backup (the deck file code says what is wrong with them)', () => {
    expect(unpackBackup(strToU8('just some text'))).toBeUndefined();
    expect(unpackBackup(new Uint8Array())).toBeUndefined();
  });

  test('Given a zip of something else that has a folder called decks, Then it is not a backup', () => {
    expect(unpackBackup(zipSync({ 'decks/a.slides': bytes(1) }))).toBeUndefined();
  });

  test('Given a backup from a newer Cue, Then it says so and nothing is read', () => {
    const newer = zipSync({
      'backup.json': strToU8(
        JSON.stringify({ format: 'cue-backup', formatVersion: BACKUP_VERSION + 1, decks: [] }),
      ),
    });
    expect(() => unpackBackup(newer)).toThrow(DeckFileError);
    try {
      unpackBackup(newer);
    } catch (error) {
      expect(error).toMatchObject({ problem: 'newer', version: BACKUP_VERSION + 1 });
    }
  });

  test.each([
    ['a note that is not JSON', 'not json'],
    ['a note that is not an object', '42'],
    ['a note with no version', JSON.stringify({ format: 'cue-backup' })],
    [
      'a note with a version that is not a number',
      JSON.stringify({ format: 'cue-backup', formatVersion: 'one' }),
    ],
  ])('Given %s, Then the backup is damaged', (_name, note) => {
    const damaged = zipSync({ 'backup.json': strToU8(note) });
    expect(() => unpackBackup(damaged)).toThrow(DeckFileError);
  });

  test('Given a note for some other format, Then it is not a Cue backup', () => {
    const other = zipSync({
      'backup.json': strToU8(JSON.stringify({ format: 'something-else', formatVersion: 1 })),
    });
    expect(unpackBackup(other)).toBeUndefined();
  });

  test('Given more files than the limit, or one too big, Then it is refused before anything is read', () => {
    const many = packBackup(
      [
        { title: 'a', bytes: bytes(1) },
        { title: 'b', bytes: bytes(1) },
        { title: 'c', bytes: bytes(1) },
      ],
      1,
    );
    const limits = { entries: 2, entryBytes: 100, totalBytes: 1000 } as const;
    expect(() => unpackBackup(many, limits)).toThrow(/too big/);
    const big = packBackup([{ title: 'a', bytes: new Uint8Array(200) }], 1);
    expect(() => unpackBackup(big, { entries: 10, entryBytes: 100, totalBytes: 1000 })).toThrow(
      /too big/,
    );
  });

  test('Given a clock before 1980 or after 2099, Then the backup is still made', () => {
    for (const madeAt of [0, -5, 5_000_000_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(
        unpackBackup(packBackup([{ title: 'a', bytes: bytes(1) }], madeAt))?.decks,
      ).toHaveLength(1);
    }
  });
});
