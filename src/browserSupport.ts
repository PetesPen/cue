/**
 * What Cue needs from a browser (UX-5): the current Chrome, Edge, Firefox and Safari on a computer have all
 * of it. A browser without one of these gets a clear message instead of a screen that half works.
 */

/** The things Cue relies on, each with the word a person would use for what it does. */
const NEEDS: readonly { readonly what: string; readonly has: (scope: Scope) => boolean }[] = [
  { what: 'saving decks in the browser (IndexedDB)', has: (s) => s.indexedDB !== undefined },
  { what: 'checking pictures (Web Crypto)', has: (s) => s.crypto?.subtle !== undefined },
  { what: 'animation (Web Animations)', has: (s) => typeof s.animate === 'function' },
  { what: 'resizing slides (ResizeObserver)', has: (s) => s.ResizeObserver !== undefined },
  {
    what: 'drawing only what is in view (IntersectionObserver)',
    has: (s) => s.IntersectionObserver !== undefined,
  },
  {
    what: 'running the show in two windows (BroadcastChannel)',
    has: (s) => s.BroadcastChannel !== undefined,
  },
];

/** The parts of a browser's global scope that are asked about (a stand-in can be given in tests). */
export interface Scope {
  readonly indexedDB?: unknown;
  readonly crypto?: { readonly subtle?: unknown } | undefined;
  /** `Element.prototype.animate`. */
  readonly animate?: unknown;
  readonly ResizeObserver?: unknown;
  readonly IntersectionObserver?: unknown;
  readonly BroadcastChannel?: unknown;
}

/** What this browser lacks, in plain words; nothing when it has all of it. */
export function missingFeatures(scope: Scope): string[] {
  return NEEDS.filter((need) => !need.has(scope)).map((need) => need.what);
}

/** The real browser's scope. */
export function browserScope(): Scope {
  return {
    indexedDB: Reflect.get(globalThis, 'indexedDB'),
    crypto: Reflect.get(globalThis, 'crypto'),
    animate: Reflect.get(Element.prototype, 'animate'),
    ResizeObserver: Reflect.get(globalThis, 'ResizeObserver'),
    IntersectionObserver: Reflect.get(globalThis, 'IntersectionObserver'),
    BroadcastChannel: Reflect.get(globalThis, 'BroadcastChannel'),
  };
}

/** Narrower than this, Cue is not for the screen (a phone): editing there is out of scope (CLAUDE.md). */
export const SMALL_SCREEN_QUERY = '(max-width: 699px)';
