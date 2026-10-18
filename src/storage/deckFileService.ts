import { imageHashes, type Deck, type Env } from '@/model';
import { BACKUP_EXTENSION, packBackup, unpackBackup } from './backupFile';
import { loadBundledFonts } from './bundledFonts';
import { packDeck, unpackDeck, type DeckFile } from './deckFile';
import { DeckFileError, FILE_TYPE, type DeckFileProblem } from './deckFileError';
import { fileNameFor, fontsOfDeck, type UnsavedPictures } from './deckInfo';
import type { StoredImage, StoredOriginal } from './database';
import type { DeckStore } from './store';

/**
 * Saving a deck to a file and opening one (SV-3), from the deck store. A lazy chunk: the zip library is
 * fetched only when a file is saved or opened.
 */

/** Everything the deck file of `deck` holds, read from the store (and `unsaved`) and the app's own fonts. */
async function gather(
  store: DeckStore,
  deck: Deck,
  unsaved: UnsavedPictures | undefined,
): Promise<DeckFile> {
  const images: StoredImage[] = [];
  const originals: StoredOriginal[] = [];
  for (const hash of imageHashes(deck)) {
    const image = unsaved?.images.find((i) => i.hash === hash) ?? (await store.loadImage(hash));
    if (!image) throw new Error('A picture of this deck cannot be read from this browser.');
    images.push(image);
    const original =
      unsaved?.originals.find((o) => o.hash === hash) ?? (await store.loadOriginal(hash));
    if (original) originals.push(original);
  }
  return { deck, images, originals, fonts: await loadBundledFonts(fontsOfDeck(deck)) };
}

/** The deck as a file, ready to be downloaded, and the name to give it. */
export async function makeDeckFile(
  store: DeckStore,
  deck: Deck,
  now: number,
  unsaved?: UnsavedPictures,
): Promise<{ readonly file: Blob; readonly name: string; readonly bytes: number }> {
  const bytes = packDeck(await gather(store, deck, unsaved), now);
  return {
    file: new Blob([new Uint8Array(bytes)], { type: FILE_TYPE }),
    name: fileNameFor(deck.title),
    bytes: bytes.length,
  };
}

/**
 * Open a deck file: read and check all of it, and only then store it, as a NEW deck (it never replaces
 * one), together with its pictures in one transaction. Throws a `DeckFileError` for a file that is not
 * a deck, is damaged, or is from a newer Cue, and changes nothing.
 */
export async function openDeckFile(store: DeckStore, file: Blob, env: Env): Promise<Deck> {
  return addDeckFrom(store, new Uint8Array(await file.arrayBuffer()), env);
}

/** Check a deck file's bytes whole, then store it as a new deck, noting that it is in a file already (SV-8). */
async function addDeckFrom(store: DeckStore, bytes: Uint8Array, env: Env): Promise<Deck> {
  const opened = await unpackDeck(bytes);
  const deck: Deck = { ...opened.deck, id: env.newId(), updatedAt: env.now() };
  await store.save(deck, opened.images, opened.originals);
  // It came out of a file, so nothing in it is lost if the browser is cleared: the reminder counts from now.
  await store.markFiled([deck.id], deck.updatedAt);
  return deck;
}

/** A backup of all decks (SV-8), ready to be downloaded. */
export interface MadeBackup {
  readonly file: Blob;
  readonly name: string;
  readonly bytes: number;
  /** The decks in it, by id, and how many pictures they hold in all (for the message). */
  readonly deckIds: readonly string[];
  /** The titles of decks left out because a picture in them cannot be read, and how many cannot be read at all. */
  readonly skipped: readonly string[];
  readonly unreadable: number;
}

/** `Cue backup 2026-10-18.zip`: the date of the day it was made, where the person is. */
export function backupName(when: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `Cue backup ${String(when.getFullYear())}-${two(when.getMonth() + 1)}-${two(when.getDate())}${BACKUP_EXTENSION}`;
}

/**
 * Every deck of the library in one file (SV-8): a deck file for each, read from the store. It changes
 * nothing. A deck whose picture cannot be read is left out and named, never left out silently.
 */
export async function makeBackupFile(store: DeckStore, now: number): Promise<MadeBackup> {
  const parts: { title: string; bytes: Uint8Array }[] = [];
  const deckIds: string[] = [];
  const skipped: string[] = [];
  for (const summary of await store.list()) {
    try {
      const deck = await store.load(summary.id);
      if (!deck) continue;
      parts.push({ title: deck.title, bytes: packDeck(await gather(store, deck, undefined), now) });
      deckIds.push(deck.id);
    } catch {
      skipped.push(summary.title);
    }
  }
  const bytes = packBackup(parts, now);
  return {
    file: new Blob([new Uint8Array(bytes)], { type: FILE_TYPE }),
    name: backupName(new Date(now)),
    bytes: bytes.length,
    deckIds,
    skipped,
    unreadable: (await store.listUnreadable()).length,
  };
}

/** What opening a file did: added one deck, or added the decks of a backup and named any it could not read. */
export type OpenedFile =
  | { readonly kind: 'deck'; readonly deck: Deck }
  | {
      readonly kind: 'backup';
      readonly added: readonly Deck[];
      readonly failed: readonly { readonly name: string; readonly problem: DeckFileProblem }[];
    };

/**
 * Open a file the person chose: a deck file adds one new deck, a backup adds every deck in it as a new deck
 * (SV-3, SV-8). Neither ever replaces a deck. A deck file that is not whole changes nothing; in a backup a
 * deck that is not whole is named and the others are still added (a backup with one bad deck is worth
 * restoring). Throws a `DeckFileError` for a file that is neither.
 */
export async function openFileOfAnyKind(
  store: DeckStore,
  file: Blob,
  env: Env,
): Promise<OpenedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const backup = unpackBackup(bytes);
  if (!backup) return { kind: 'deck', deck: await addDeckFrom(store, bytes, env) };
  const added: Deck[] = [];
  const failed: { name: string; problem: DeckFileProblem }[] = [];
  for (const entry of backup.decks) {
    try {
      added.push(await addDeckFrom(store, entry.bytes, env));
    } catch (error) {
      failed.push({
        name: entry.name,
        problem: error instanceof DeckFileError ? error.problem : 'damaged',
      });
    }
  }
  return { kind: 'backup', added, failed };
}
