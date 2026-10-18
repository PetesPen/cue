import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { DeckFileError } from './deckFileError';
import { fileNameFor } from './deckInfo';

/**
 * The backup of all decks (SV-8): a plain zip that holds one deck file (`.slides`) for each deck, in a folder
 * of its own, and a small `backup.json` that says what it is. Anyone can unzip it and open a single deck with
 * Cue's Open file; opening the whole backup adds every deck in it. The deck files inside already hold their
 * pictures and fonts, so they are stored as they are (compressing them again gains nothing). Pure over bytes.
 */

export const BACKUP_FORMAT = 'cue-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = '.zip';

export interface BackupLimits {
  readonly entries: number;
  readonly entryBytes: number;
  readonly totalBytes: number;
}

/** A backup of many decks is large: it may hold this many deck files, each as big as one can be. */
export const BACKUP_LIMITS: BackupLimits = {
  entries: 2000,
  entryBytes: 200 * 1024 * 1024,
  totalBytes: 4 * 1024 * 1024 * 1024,
};

const DECK_FILE = /^decks\/[^/\\]+\.slides$/;

export interface BackupPart {
  /** The deck's title, for the name of its file. */
  readonly title: string;
  /** The deck file (`packDeck`'s bytes). */
  readonly bytes: Uint8Array;
}

/** Each deck file's name in the zip: the deck's own name, and a number after it when two would be the same. */
export function backupNames(titles: readonly string[]): string[] {
  const used = new Map<string, number>();
  return titles.map((title) => {
    const base = fileNameFor(title).slice(0, -'.slides'.length);
    const count = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), count);
    return `${count === 1 ? base : `${base} (${String(count)})`}.slides`;
  });
}

/** Write a backup. */
export function packBackup(parts: readonly BackupPart[], madeAt: number): Uint8Array {
  const names = backupNames(parts.map((part) => part.title));
  const entries: Zippable = {};
  const listed = parts.map((part, at) => {
    const file = `decks/${names[at] ?? ''}`;
    entries[file] = [part.bytes, { level: 0 }];
    return { file, title: part.title };
  });
  entries['backup.json'] = strToU8(
    JSON.stringify({ format: BACKUP_FORMAT, formatVersion: BACKUP_VERSION, madeAt, decks: listed }),
  );
  const mtime = new Date(Math.min(Date.UTC(2099, 11, 31), Math.max(Date.UTC(1980, 0, 1), madeAt)));
  return zipSync(entries, { mtime });
}

/** The deck files of a backup, in the order they were written. */
export interface UnpackedBackup {
  readonly decks: readonly { readonly name: string; readonly bytes: Uint8Array }[];
}

/**
 * The deck files of a backup, or `undefined` when the bytes are not a backup (not a zip, or a zip with no
 * `backup.json`: a single deck file is that). Throws a `DeckFileError` for a backup made by a newer Cue or
 * one that is too big. Nothing is stored here.
 */
export function unpackBackup(
  bytes: Uint8Array,
  limits: BackupLimits = BACKUP_LIMITS,
): UnpackedBackup | undefined {
  let files: Record<string, Uint8Array>;
  let count = 0;
  let total = 0;
  try {
    files = unzipSync(bytes, {
      filter(info) {
        const wanted = info.name === 'backup.json' || DECK_FILE.test(info.name);
        if (!wanted) return false;
        count += 1;
        total += info.originalSize;
        if (
          count > limits.entries ||
          info.originalSize > limits.entryBytes ||
          total > limits.totalBytes
        ) {
          throw new DeckFileError('too-large', 'This backup is too big.');
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof DeckFileError) throw error;
    return undefined;
  }
  const manifestBytes = files['backup.json'];
  if (!manifestBytes) return undefined;
  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new DeckFileError('damaged', 'The list of decks in this backup is not readable.');
  }
  if (typeof manifest !== 'object' || manifest === null) {
    throw new DeckFileError('damaged', 'The list of decks in this backup is not readable.');
  }
  if (Reflect.get(manifest, 'format') !== BACKUP_FORMAT) return undefined;
  const version: unknown = Reflect.get(manifest, 'formatVersion');
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new DeckFileError('damaged', 'This backup does not say which version made it.');
  }
  if (version > BACKUP_VERSION) {
    throw new DeckFileError('newer', 'This backup was made by a newer version of Cue.', version);
  }
  // The deck files the zip holds, in a steady order (the order of the names).
  const decks = Object.keys(files)
    .filter((name) => DECK_FILE.test(name))
    .sort()
    .map((name) => ({ name: name.slice('decks/'.length), bytes: files[name] ?? new Uint8Array() }));
  return { decks };
}
