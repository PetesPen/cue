import { systemEnv, type Deck } from '@/model';
import { DeckFileError, type DeckStore, type StoredImage, type StoredOriginal } from '@/storage';

/**
 * Saving a deck to a file and opening one, from the editor (SV-3). The zip code is a separate chunk that is
 * fetched only when a file is saved or opened, so the first load does not pay for it.
 */

export interface MadeFile {
  readonly file: Blob;
  readonly name: string;
  readonly bytes: number;
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

/** Open a file into the library as a new deck. Throws a `DeckFileError` and changes nothing if it cannot be. */
export async function openFileInto(store: DeckStore, file: Blob): Promise<Deck> {
  const { openDeckFile } = await import('@/storage/deckFileService');
  return openDeckFile(store, file, systemEnv);
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
