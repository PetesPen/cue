import { systemEnv, type Deck } from '@/model';
import {
  DeckFileError,
  formatBytes,
  type DeckStore,
  type StoredImage,
  type StoredOriginal,
} from '@/storage';
import type { MadeBackup, OpenedFile } from '@/storage/deckFileService';
import type { Notice } from './BackupBanner';

/**
 * Saving a deck to a file and opening one, from the editor (SV-3). The zip code is a separate chunk that is
 * fetched only when a file is saved or opened, so the first load does not pay for it.
 */

/** The two files Cue can make of a deck: a standalone web page (SV-4) and an editable deck file (SV-3). */
export type ExportKind = 'page' | 'file';

export interface MadeFile {
  readonly file: Blob;
  readonly name: string;
  readonly bytes: number;
  /** What the pictures in it weigh, when it is known: the size of the other kind of file is guessed from it. */
  readonly pictureBytes?: number;
}

/** The deck as a file (its pictures and fonts included), read from the store and the app's own files. */
export async function makeFileFor(
  store: DeckStore,
  deck: Deck,
  unsaved?: {
    readonly images: readonly StoredImage[];
    readonly originals: readonly StoredOriginal[];
  },
): Promise<MadeFile> {
  const { makeDeckFile } = await import('@/storage/deckFileService');
  return makeDeckFile(store, deck, Date.now(), unsaved);
}

/**
 * The deck as a standalone web page (SV-4), from the store, the app's own fonts and the page's program. A
 * separate chunk, fetched only when a page is made. `options.includeNotes` leaves the notes out when off.
 */
export async function makePageFor(
  store: DeckStore,
  deck: Deck,
  options: { readonly includeNotes: boolean },
  unsaved?: {
    readonly images: readonly StoredImage[];
    readonly originals: readonly StoredOriginal[];
  },
): Promise<MadeFile> {
  const { makeHtmlFile } = await import('@/storage/htmlExport/htmlExportService');
  return makeHtmlFile(store, deck, options, unsaved);
}

/** About what a web page weighs: the pictures as base64 (a third more, SP-3), and the page's own program. */
export const estimatePageBytes = (pictureBytes: number): number =>
  Math.round(pictureBytes * 1.35 + 200 * 1024);

/** About what a deck file weighs: the pictures, the deck and the fonts. */
export const estimateFileBytes = (pictureBytes: number): number => pictureBytes + 30 * 1024;

/** Open a file into the library as a new deck. Throws a `DeckFileError` and changes nothing if it cannot be. */
export async function openFileInto(store: DeckStore, file: Blob): Promise<Deck> {
  const { openDeckFile } = await import('@/storage/deckFileService');
  return openDeckFile(store, file, systemEnv);
}

/** Every deck in one file (SV-8), read from the store. The zip code is in the same separate chunk as the deck file's. */
export async function makeBackupFor(store: DeckStore): Promise<MadeBackup> {
  const { makeBackupFile } = await import('@/storage/deckFileService');
  return makeBackupFile(store, Date.now());
}

/**
 * Open a file the person chose into the library: a deck file adds a deck, a backup adds every deck in it
 * (SV-3, SV-8), each as a new deck. Throws a `DeckFileError` and changes nothing for a file that is neither.
 */
export async function openAnyFileInto(store: DeckStore, file: Blob): Promise<OpenedFile> {
  const { openFileOfAnyKind } = await import('@/storage/deckFileService');
  return openFileOfAnyKind(store, file, systemEnv);
}

const decksOf = (count: number) => `${String(count)} deck${count === 1 ? '' : 's'}`;

/** What to tell the person after a backup was saved. */
export function describeBackup(made: MadeBackup): Notice {
  const left: string[] = [];
  if (made.skipped.length > 0) {
    left.push(
      `${made.skipped.join(', ')} ${made.skipped.length === 1 ? 'has a picture that can’t' : 'have pictures that can’t'} be read, so ${made.skipped.length === 1 ? 'it was' : 'they were'} left out.`,
    );
  }
  if (made.unreadable > 0) {
    left.push(
      `${decksOf(made.unreadable)} Cue can’t read ${made.unreadable === 1 ? 'was' : 'were'} left out too.`,
    );
  }
  return {
    tone: left.length === 0 ? 'good' : 'warning',
    title: `Backed up ${decksOf(made.deckIds.length)}.`,
    text: [
      `${formatBytes(made.bytes)} saved as ${made.name}. Keep it somewhere safe: Open file brings the decks back.`,
      ...left,
    ].join(' '),
  };
}

/** What to tell the person after a backup was opened: what was added and what could not be. */
export function describeOpenedBackup(opened: Extract<OpenedFile, { kind: 'backup' }>): Notice {
  const failed = opened.failed.map((one) => one.name.slice(0, -'.slides'.length));
  return {
    tone: failed.length === 0 ? 'good' : 'warning',
    title:
      opened.added.length === 0
        ? 'No decks were added.'
        : `Added ${decksOf(opened.added.length)} from the backup.`,
    text: [
      opened.added.length > 0 ? 'Nothing was replaced: they are new decks.' : '',
      failed.length > 0
        ? `${failed.join(', ')} couldn’t be opened (${failed.length === 1 ? 'it is' : 'they are'} damaged, or made by a newer Cue).`
        : '',
    ]
      .filter((part) => part !== '')
      .join(' '),
  };
}

/** Hand a file to the browser to save, under a name. */
export function downloadFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has been given the file by the time it has had a moment to start.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
}

/** What to tell the person when a file cannot be opened: a title and a sentence (design: States). */
export function describeFileProblem(error: unknown): { title: string; text: string } {
  const untouched = 'Your decks are untouched.';
  if (error instanceof DeckFileError) {
    if (error.problem === 'newer') {
      return {
        title: 'This deck needs a newer version of Cue',
        text: `It was saved by a newer version of Cue than the one you have open. Reload the page to get the latest version. ${untouched}`,
      };
    }
    if (error.problem === 'too-large') {
      return {
        title: 'This file is too big to be a deck',
        text: `Cue decks are far smaller than this. ${untouched}`,
      };
    }
  }
  return {
    title: 'This file couldn’t be opened',
    text: `It may be damaged, or it wasn’t made with Cue. ${untouched}`,
  };
}
