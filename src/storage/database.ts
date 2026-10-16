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

export class CueDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  images!: EntityTable<StoredImage, 'hash'>;
  originals!: EntityTable<StoredOriginal, 'hash'>;

  constructor(name: string) {
    super(name);
    // Changing a table's keys or indexes needs a new version() with an upgrade. Version 2 only adds
    // a table, which needs none.
    this.version(1).stores({ decks: 'id, updatedAt', images: 'hash' });
    this.version(2).stores({ decks: 'id, updatedAt', images: 'hash', originals: 'hash' });
  }
}
