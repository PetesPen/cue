import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import {
  InvalidDeckError,
  UnsupportedVersionError,
  imageHashes,
  parseDeck,
  type Deck,
} from '@/model';
import type { StoredImage, StoredOriginal } from './database';
import { DeckFileError } from './deckFileError';
import { sha256Hex } from './hash';
import { fontFolder, type EmbeddedFont } from './deckInfo';

/**
 * The deck file (SV-3, SV-5): a zip with `deck.json` (what this is, the version of the file's layout, and
 * the deck exactly as it is stored, whose own schema version is its own), the pictures the deck shows by
 * their content hash, the originals of pictures that were scaled down, and the fonts the deck uses with
 * their licences. Opening checks everything before anything is stored: a wrong or damaged file can never
 * overwrite or half-add a deck. Pure over bytes, so tests need no browser.
 */

/** What `deck.json` says this is. */
export const FILE_FORMAT = 'cue-deck';
/** The version of the file's layout (not of the deck inside it). */
export const FILE_VERSION = 1;

/** Limits applied before anything is unpacked, against a file that is not what it says. */
export interface Limits {
  readonly entries: number;
  readonly entryBytes: number;
  readonly totalBytes: number;
}

export const LIMITS: Limits = {
  entries: 4000,
  entryBytes: 200 * 1024 * 1024,
  totalBytes: 1024 * 1024 * 1024,
};

export { fontFolder, type EmbeddedFont };

/** Everything a deck file holds. */
export interface DeckFile {
  readonly deck: Deck;
  readonly images: readonly StoredImage[];
  readonly originals: readonly StoredOriginal[];
  readonly fonts: readonly EmbeddedFont[];
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const typeOfExtension = (name: string): string | undefined =>
  Object.entries(EXTENSIONS).find(([, extension]) => name.endsWith(`.${extension}`))?.[0];

const SAFE_NAME =
  /^(?:images|originals|fonts)\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

interface Manifest {
  readonly format: typeof FILE_FORMAT;
  readonly formatVersion: number;
  readonly savedAt: number;
  readonly deck: Deck;
  readonly images: readonly {
    readonly hash: string;
    readonly type: string;
    readonly file: string;
  }[];
  readonly originals: readonly {
    readonly hash: string;
    readonly type: string;
    readonly file: string;
  }[];
  readonly fonts: readonly {
    readonly family: string;
    readonly files: readonly string[];
    readonly licence: string;
  }[];
}

const README =
  'This is a Cue deck file (.slides): a zip with deck.json, the pictures and the fonts of one deck.\n' +
  'Open it in Cue with "Open file". The fonts are under the SIL Open Font License; each folder under fonts/\n' +
  'holds the licence text of its family.\n';

/** A zip can only date its entries from 1980 to 2099; a clock outside that (a flat battery) must not stop a save. */
function zipTime(ms: number): number {
  const earliest = Date.UTC(1980, 0, 2);
  const latest = Date.UTC(2098, 11, 31);
  return Number.isFinite(ms) ? Math.min(latest, Math.max(earliest, ms)) : earliest;
}

/** Write a deck file. Pictures are stored as they are (they are compressed already); the rest is deflated. */
export function packDeck(file: DeckFile, savedAt: number): Uint8Array {
  const entries: Zippable = {};
  const images = file.images.map((image) => {
    const name = `images/${image.hash}.${EXTENSIONS[image.type] ?? 'bin'}`;
    entries[name] = [image.bytes, { level: 0 }];
    return { hash: image.hash, type: image.type, file: name };
  });
  const originals = file.originals.map((original) => {
    const name = `originals/${original.hash}.${EXTENSIONS[original.type] ?? 'bin'}`;
    entries[name] = [original.bytes, { level: 0 }];
    return { hash: original.hash, type: original.type, file: name };
  });
  const fonts = file.fonts.map((font) => {
    const folder = `fonts/${fontFolder(font.family)}`;
    for (const part of font.files) entries[`${folder}/${part.name}`] = [part.bytes, { level: 0 }];
    entries[`${folder}/OFL.txt`] = strToU8(font.licence);
    return {
      family: font.family,
      files: font.files.map((part) => `${folder}/${part.name}`),
      licence: `${folder}/OFL.txt`,
    };
  });
  const manifest: Manifest = {
    format: FILE_FORMAT,
    formatVersion: FILE_VERSION,
    savedAt,
    deck: file.deck,
    images,
    originals,
    fonts,
  };
  entries['deck.json'] = strToU8(JSON.stringify(manifest));
  entries['README.txt'] = strToU8(README);
  return zipSync(entries, { mtime: zipTime(savedAt) });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function list(value: unknown, what: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new DeckFileError('damaged', `The ${what} list is not a list.`);
  return value;
}

function text(record: Record<string, unknown>, key: string, what: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new DeckFileError('damaged', `${what} has no ${key}.`);
  return value;
}

/**
 * Read a deck file, or throw a `DeckFileError` saying why not. Nothing is stored: the caller gets a deck,
 * its pictures and its fonts, every one checked (the deck parses, every picture it shows is in the file and
 * matches its hash, no name leaves the file's folders).
 */
export async function unpackDeck(bytes: Uint8Array, limits: Limits = LIMITS): Promise<DeckFile> {
  let entries: Record<string, Uint8Array>;
  let count = 0;
  let total = 0;
  try {
    entries = unzipSync(bytes, {
      filter(info) {
        count += 1;
        total += info.originalSize;
        if (
          count > limits.entries ||
          info.originalSize > limits.entryBytes ||
          total > limits.totalBytes
        ) {
          throw new DeckFileError('too-large', 'This file is too big to be a deck.');
        }
        // Only what the layout names is read; anything else in the zip is left alone.
        return info.name === 'deck.json' || SAFE_NAME.test(info.name);
      },
    });
  } catch (error) {
    if (error instanceof DeckFileError) throw error;
    throw new DeckFileError('not-a-zip', 'This is not a deck file: it is not a zip archive.');
  }

  const manifestBytes = entries['deck.json'];
  if (!manifestBytes)
    throw new DeckFileError('not-cue', 'This zip is not a Cue deck: it has no deck.json.');
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new DeckFileError('damaged', 'deck.json cannot be read.');
  }
  if (!isRecord(raw) || raw.format !== FILE_FORMAT) {
    throw new DeckFileError('not-cue', 'This zip is not a Cue deck.');
  }
  const formatVersion = raw.formatVersion;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new DeckFileError('damaged', 'The file has no valid version.');
  }
  if (formatVersion > FILE_VERSION) {
    throw new DeckFileError(
      'newer',
      'This file was made by a newer version of Cue.',
      formatVersion,
    );
  }

  let deck: Deck;
  try {
    deck = parseDeck(raw.deck);
  } catch (error) {
    if (error instanceof UnsupportedVersionError) {
      throw new DeckFileError('newer', error.message, error.version);
    }
    if (error instanceof InvalidDeckError) throw new DeckFileError('damaged', error.message);
    throw new DeckFileError('damaged', 'The deck in this file cannot be read.');
  }

  const fileBytes = (name: unknown, what: string): Uint8Array => {
    if (typeof name !== 'string' || !SAFE_NAME.test(name)) {
      throw new DeckFileError('damaged', `${what} has a name that is not allowed.`);
    }
    const found = entries[name];
    if (!found) throw new DeckFileError('damaged', `${what} is missing from the file.`);
    return found;
  };
  /** A copy on its own buffer, for the store. */
  const copy = (source: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(source);

  const images: StoredImage[] = [];
  for (const item of list(raw.images, 'picture')) {
    if (!isRecord(item)) throw new DeckFileError('damaged', 'A picture entry is not an object.');
    const hash = text(item, 'hash', 'A picture');
    const type = text(item, 'type', 'A picture');
    const body = copy(fileBytes(item.file, `The picture ${hash}`));
    if (typeOfExtension(String(item.file)) !== type) {
      throw new DeckFileError('damaged', `The picture ${hash} is not a picture type Cue uses.`);
    }
    if ((await sha256Hex(body)) !== hash) {
      throw new DeckFileError('damaged', `The picture ${hash} does not match its name.`);
    }
    images.push({ hash, type, bytes: body });
  }
  const present = new Set(images.map((image) => image.hash));
  for (const hash of imageHashes(deck)) {
    if (!present.has(hash)) {
      throw new DeckFileError('damaged', `A picture the deck shows (${hash}) is not in the file.`);
    }
  }

  const originals: StoredOriginal[] = [];
  for (const item of list(raw.originals, 'original')) {
    if (!isRecord(item)) throw new DeckFileError('damaged', 'An original entry is not an object.');
    const hash = text(item, 'hash', 'An original');
    const type = text(item, 'type', 'An original');
    if (typeOfExtension(String(item.file)) !== type) {
      throw new DeckFileError('damaged', `The original of ${hash} is not a picture type Cue uses.`);
    }
    // Kept only where its scaled picture is in the file: an original for nothing is left out.
    if (present.has(hash)) {
      originals.push({
        hash,
        type,
        bytes: copy(fileBytes(item.file, `The original of ${hash}`)),
      });
    }
  }

  const fonts: EmbeddedFont[] = [];
  for (const item of list(raw.fonts, 'font')) {
    if (!isRecord(item)) throw new DeckFileError('damaged', 'A font entry is not an object.');
    const family = text(item, 'family', 'A font');
    const names = list(item.files, 'font file');
    fonts.push({
      family,
      files: names.map((name) => ({
        name: String(name).split('/').pop() ?? '',
        bytes: fileBytes(name, `A file of ${family}`),
      })),
      licence: strFromU8(fileBytes(item.licence, `The licence of ${family}`)),
    });
  }

  return { deck, images, originals, fonts };
}
