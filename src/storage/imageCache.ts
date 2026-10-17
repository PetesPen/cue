import type { ImageSource } from '@/render';
import type { DeckStore } from './store';
import type { StoredImage } from './database';

/**
 * The pictures a window has loaded, as addresses the page can draw (EL-4). A picture is read from the
 * store the first time a slide needs it, one at a time, and kept as an object URL until the window is
 * closed. A picture that was just added is put here directly, so it shows at once, before it is saved.
 */
export class ImageCache implements ImageSource {
  readonly #store: Pick<DeckStore, 'loadImage'>;
  readonly #urls = new Map<string, string>();
  readonly #waiting = new Map<string, (() => void)[]>();

  constructor(store: Pick<DeckStore, 'loadImage'>) {
    this.#store = store;
  }

  url(hash: string): string | undefined {
    return this.#urls.get(hash);
  }

  load(hash: string, ready: () => void): void {
    if (this.#urls.has(hash)) {
      ready();
      return;
    }
    const waiting = this.#waiting.get(hash);
    if (waiting) {
      waiting.push(ready);
      return;
    }
    this.#waiting.set(hash, [ready]);
    void this.#store
      .loadImage(hash)
      .then((image) => {
        if (image) this.add(image);
      })
      .catch(() => {
        // The picture could not be read; the box stays empty and asks again next time it is drawn.
      })
      .finally(() => {
        this.#waiting.delete(hash);
      });
  }

  /** Make a picture drawable now, and tell everything that was waiting for it. */
  add(image: StoredImage): void {
    if (!this.#urls.has(image.hash)) {
      this.#urls.set(
        image.hash,
        URL.createObjectURL(new Blob([image.bytes], { type: image.type })),
      );
    }
    const waiting = this.#waiting.get(image.hash) ?? [];
    this.#waiting.delete(image.hash);
    for (const ready of waiting) ready();
  }

  /** Let go of every address (when the window is closed). */
  dispose(): void {
    for (const url of this.#urls.values()) URL.revokeObjectURL(url);
    this.#urls.clear();
    this.#waiting.clear();
  }
}
