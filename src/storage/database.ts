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

export class CueDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  images!: EntityTable<StoredImage, 'hash'>;

  constructor(name: string) {
    super(name);
    // Version 1. Changing a table's keys or indexes needs a new version() with an upgrade.
    this.version(1).stores({ decks: 'id, updatedAt', images: 'hash' });
  }
}
