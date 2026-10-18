import {
  UnsupportedVersionError,
  duplicateDeck,
  imageHashes,
  parseDeck,
  type Deck,
  type Env,
} from '@/model';
import { CueDatabase, type StoredImage, type StoredOriginal } from './database';

/** What the library needs to draw a card: no need to hold every deck's slides in the list. */
export interface DeckSummary {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly slideCount: number;
  /** The first slide, drawn as the card's thumbnail. */
  readonly firstSlide: Deck['slides'][number];
}

/** A stored deck that cannot be read, so it can be shown and deleted (SV-3, decision 17). */
export interface UnreadableDeck {
  readonly id: string;
  /** Its title, where the stored record still has one. */
  readonly title: string | undefined;
  /** It was saved by a newer Cue than this one: it may be fine in a newer one. */
  readonly newer: boolean;
}

export interface DeckStore {
  /** Newest first (SV-2). */
  list(): Promise<DeckSummary[]>;
  /** The decks `list` leaves out because they cannot be read: damaged, or from a newer Cue. */
  listUnreadable(): Promise<UnreadableDeck[]>;
  /** `undefined` when no such deck is stored. Throws when what is stored is damaged or too new. */
  load(id: string): Promise<Deck | undefined>;
  /**
   * Save a deck and any new photos in ONE transaction. A save that does not fit (or fails for any
   * other reason) leaves nothing behind: not the deck, not half the photos (docs/spikes/SP-5.md).
   */
  save(
    deck: Deck,
    newImages?: readonly StoredImage[],
    newOriginals?: readonly StoredOriginal[],
  ): Promise<void>;
  remove(id: string): Promise<void>;
  /** Stores and returns a copy under new ids, or `undefined` when no such deck is stored. */
  duplicate(id: string, env: Env): Promise<Deck | undefined>;
  /** Note that these decks have just been put in a file, so the backup reminder counts from now (SV-8). */
  markFiled(deckIds: readonly string[], at: number): Promise<void>;
  /** When each deck was last put in a file (SV-8); a deck never filed is not listed. */
  listFiled(): Promise<Record<string, number>>;
  /** The end of the pause the person asked for with the reminder's close button, or `undefined` (SV-8). */
  reminderSnoozedUntil(): Promise<number | undefined>;
  snoozeReminder(until: number): Promise<void>;
  loadImage(hash: string): Promise<StoredImage | undefined>;
  /** The picture as it came in, if it was kept (for the export), or `undefined`. */
  loadOriginal(hash: string): Promise<StoredOriginal | undefined>;
  /** Deletes photos no deck refers to, as insurance against a half-finished save. Returns how many. */
  sweepOrphanImages(referencedHashes: ReadonlySet<string>): Promise<number>;
  /**
   * Deletes the photos that no stored deck shows, reading the decks and deleting in one transaction, so
   * a deck saved by another tab at that moment cannot lose its photo. It deletes nothing if any stored
   * deck cannot be read (damaged, or from a newer Cue), because that deck's photos are not known.
   */
  sweepUnusedImages(): Promise<number>;
  close(): void;
}

const SNOOZE_KEY = 'backup-reminder-until';

export function createDeckStore(databaseName = 'cue'): DeckStore {
  const db = new CueDatabase(databaseName);

  // Writes still running. A read waits for them, so what was just saved is what comes back, even
  // when the editor is left (and the library opened) the moment an edit is on its way to disk.
  const writes = new Set<Promise<unknown>>();
  const write = <T>(operation: () => Promise<T>): Promise<T> => {
    const running = operation();
    writes.add(running);
    const forget = () => {
      writes.delete(running);
    };
    running.then(forget, forget);
    return running;
  };
  const writesSettled = async () => {
    await Promise.allSettled([...writes]);
  };

  return {
    async list() {
      await writesSettled();
      const stored = await db.decks.orderBy('updatedAt').reverse().toArray();
      const summaries: DeckSummary[] = [];
      for (const raw of stored) {
        // One damaged record, or one saved by a newer Cue, must not hide every other deck. It is
        // left in storage untouched (and listed again by a Cue that can read it).
        let deck: Deck;
        try {
          deck = parseDeck(raw);
        } catch {
          continue;
        }
        const [firstSlide] = deck.slides;
        if (firstSlide === undefined) continue;
        summaries.push({
          id: deck.id,
          title: deck.title,
          createdAt: deck.createdAt,
          updatedAt: deck.updatedAt,
          slideCount: deck.slides.length,
          firstSlide,
        });
      }
      return summaries;
    },

    async listUnreadable() {
      await writesSettled();
      const unreadable: UnreadableDeck[] = [];
      for (const stored of await db.decks.toArray()) {
        const raw: unknown = stored;
        try {
          parseDeck(raw);
        } catch (error) {
          const title: unknown =
            typeof raw === 'object' && raw !== null ? Reflect.get(raw, 'title') : undefined;
          unreadable.push({
            id: stored.id,
            title: typeof title === 'string' && title !== '' ? title : undefined,
            newer: error instanceof UnsupportedVersionError,
          });
        }
      }
      return unreadable;
    },

    async load(id) {
      await writesSettled();
      const raw = await db.decks.get(id);
      return raw === undefined ? undefined : parseDeck(raw);
    },

    async save(deck, newImages = [], newOriginals = []) {
      await write(() =>
        db.transaction('rw', db.decks, db.images, db.originals, async () => {
          await db.images.bulkPut([...newImages]);
          await db.originals.bulkPut([...newOriginals]);
          await db.decks.put(deck);
        }),
      );
    },

    async remove(id) {
      await write(() =>
        db.transaction('rw', db.decks, db.filed, async () => {
          await db.decks.delete(id);
          await db.filed.delete(id);
        }),
      );
    },

    async markFiled(deckIds, at) {
      await write(() => db.filed.bulkPut(deckIds.map((deckId) => ({ deckId, at }))));
    },

    async listFiled() {
      await writesSettled();
      return Object.fromEntries((await db.filed.toArray()).map((one) => [one.deckId, one.at]));
    },

    async reminderSnoozedUntil() {
      await writesSettled();
      return (await db.meta.get(SNOOZE_KEY))?.value;
    },

    async snoozeReminder(until) {
      await write(() => db.meta.put({ key: SNOOZE_KEY, value: until }));
    },

    async duplicate(id, env) {
      const original = await this.load(id);
      if (original === undefined) return undefined;
      const copy = duplicateDeck(original, env);
      await this.save(copy);
      return copy;
    },

    async loadImage(hash) {
      await writesSettled();
      return db.images.get(hash);
    },

    async loadOriginal(hash) {
      await writesSettled();
      return db.originals.get(hash);
    },

    sweepOrphanImages(referencedHashes) {
      return write(() =>
        db.transaction('rw', db.images, db.originals, async () => {
          const stored = await db.images.toCollection().primaryKeys();
          const orphans = stored.filter((hash) => !referencedHashes.has(hash));
          await db.images.bulkDelete(orphans);
          await db.originals.bulkDelete(orphans);
          return orphans.length;
        }),
      );
    },

    sweepUnusedImages() {
      return write(() =>
        db.transaction('rw', db.decks, db.images, db.originals, async () => {
          const used = new Set<string>();
          for (const raw of await db.decks.toArray()) {
            try {
              for (const hash of imageHashes(parseDeck(raw))) used.add(hash);
            } catch {
              return 0;
            }
          }
          const stored = await db.images.toCollection().primaryKeys();
          const orphans = stored.filter((hash) => !used.has(hash));
          await db.images.bulkDelete(orphans);
          // An original whose picture is gone, or that no deck shows, goes with it.
          const kept = await db.originals.toCollection().primaryKeys();
          await db.originals.bulkDelete(kept.filter((hash) => !used.has(hash)));
          return orphans.length;
        }),
      );
    },

    close() {
      db.close();
    },
  };
}
