import { duplicateDeck, parseDeck, type Deck, type Env } from '@/model';
import { CueDatabase, type StoredImage } from './database';

/** What the library needs to draw a card: no need to hold every deck's slides in the list. */
export interface DeckSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: number;
  readonly slideCount: number;
  /** The first slide, drawn as the card's thumbnail. */
  readonly firstSlide: Deck['slides'][number];
}

export interface DeckStore {
  /** Newest first (SV-2). */
  list(): Promise<DeckSummary[]>;
  /** `undefined` when no such deck is stored. Throws when what is stored is damaged or too new. */
  load(id: string): Promise<Deck | undefined>;
  /**
   * Save a deck and any new photos in ONE transaction. A save that does not fit (or fails for any
   * other reason) leaves nothing behind: not the deck, not half the photos (docs/spikes/SP-5.md).
   */
  save(deck: Deck, newImages?: readonly StoredImage[]): Promise<void>;
  remove(id: string): Promise<void>;
  /** Stores and returns a copy under new ids, or `undefined` when no such deck is stored. */
  duplicate(id: string, env: Env): Promise<Deck | undefined>;
  loadImage(hash: string): Promise<StoredImage | undefined>;
  /** Deletes photos no deck refers to, as insurance against a half-finished save. Returns how many. */
  sweepOrphanImages(referencedHashes: ReadonlySet<string>): Promise<number>;
  close(): void;
}

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
          updatedAt: deck.updatedAt,
          slideCount: deck.slides.length,
          firstSlide,
        });
      }
      return summaries;
    },

    async load(id) {
      await writesSettled();
      const raw = await db.decks.get(id);
      return raw === undefined ? undefined : parseDeck(raw);
    },

    async save(deck, newImages = []) {
      await write(() =>
        db.transaction('rw', db.decks, db.images, async () => {
          await db.images.bulkPut([...newImages]);
          await db.decks.put(deck);
        }),
      );
    },

    async remove(id) {
      await write(() => db.decks.delete(id));
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

    sweepOrphanImages(referencedHashes) {
      return write(() =>
        db.transaction('rw', db.images, async () => {
          const stored = await db.images.toCollection().primaryKeys();
          const orphans = stored.filter((hash) => !referencedHashes.has(hash));
          await db.images.bulkDelete(orphans);
          return orphans.length;
        }),
      );
    },

    close() {
      db.close();
    },
  };
}
