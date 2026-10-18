import Dexie, { type EntityTable } from 'dexie';
import type { Deck } from '@/model';

/**
 * A photo, stored once by content hash as raw bytes plus a type. Raw bytes (not a Blob) work in
 * every browser, including private windows, where WebKit refuses Blobs (docs/spikes/SP-5.md).
 */
export interface StoredImage {
  readonly hash: string;
  readonly type: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/**
 * The picture as it came in, kept only when it was scaled down on import and is small enough (EL-4),
 * for the export to use. Stored apart from the scaled picture, so showing a slide never loads it. Keyed
 * by the hash of the scaled picture it belongs to.
 */
export interface StoredOriginal {
  readonly hash: string;
  readonly type: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/** When a deck was last put in a file, a deck file or a backup of all decks (SV-8). Not part of the deck. */
export interface FiledDeck {
  readonly deckId: string;
  readonly at: number;
}

/** A small named value of the library itself, such as the end of the pause of the backup reminder (SV-8). */
export interface MetaValue {
  readonly key: string;
  readonly value: number;
}

export class CueDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  images!: EntityTable<StoredImage, 'hash'>;
  originals!: EntityTable<StoredOriginal, 'hash'>;
  filed!: EntityTable<FiledDeck, 'deckId'>;
  meta!: EntityTable<MetaValue, 'key'>;

  constructor(name: string) {
    super(name);
    // Changing a table's keys or indexes needs a new version() with an upgrade. Version 2 only adds
    // a table, which needs none.
    this.version(1).stores({ decks: 'id, updatedAt', images: 'hash' });
    this.version(2).stores({ decks: 'id, updatedAt', images: 'hash', originals: 'hash' });
    // Version 3 only adds two small tables (SV-8), which needs no upgrade.
    this.version(3).stores({
      decks: 'id, updatedAt',
      images: 'hash',
      originals: 'hash',
      filed: 'deckId',
      meta: 'key',
    });
  }
}
