/**
 * Where the renderer gets a picture's address from (EL-4). The editor gives it the pictures it has
 * loaded from the store; the HTML export will give it the pictures inlined in the file. The renderer
 * itself never reads storage, so the same drawing code serves both.
 */
export interface ImageSource {
  /** The address to draw, or nothing while the picture is not loaded yet. */
  readonly url: (hash: string) => string | undefined;
  /** Ask for the picture; `ready` is called once it can be drawn. */
  readonly load: (hash: string, ready: () => void) => void;
}

let current: ImageSource | undefined;

/** Set where pictures come from (once, at start), or `undefined` to forget it. */
export function setImageSource(source: ImageSource | undefined): void {
  current = source;
}

export function imageSource(): ImageSource | undefined {
  return current;
}
