import { describe, expect, test } from 'vitest';
import { missingFeatures, type Scope } from './browserSupport';

// UX-5: a browser without what Cue needs is told so, plainly.

const everything: Scope = {
  indexedDB: {},
  crypto: { subtle: {} },
  animate: () => undefined,
  ResizeObserver: {},
  IntersectionObserver: {},
  BroadcastChannel: {},
};

describe('what a browser must have (UX-5)', () => {
  test('Given a browser with everything, Then nothing is missing', () => {
    expect(missingFeatures(everything)).toEqual([]);
  });

  test.each<[string, Partial<Scope>, string]>([
    ['IndexedDB', { indexedDB: undefined }, 'saving decks in the browser (IndexedDB)'],
    ['Web Crypto', { crypto: undefined }, 'checking pictures (Web Crypto)'],
    ['Web Crypto without subtle', { crypto: {} }, 'checking pictures (Web Crypto)'],
    ['Web Animations', { animate: undefined }, 'animation (Web Animations)'],
    ['ResizeObserver', { ResizeObserver: undefined }, 'resizing slides (ResizeObserver)'],
    [
      'IntersectionObserver',
      { IntersectionObserver: undefined },
      'drawing only what is in view (IntersectionObserver)',
    ],
    [
      'BroadcastChannel',
      { BroadcastChannel: undefined },
      'running the show in two windows (BroadcastChannel)',
    ],
  ])('Given a browser without %s, Then it is named in plain words', (_name, lacking, words) => {
    expect(missingFeatures({ ...everything, ...lacking })).toEqual([words]);
  });

  test('Given a browser with nothing, Then every need is named once', () => {
    expect(missingFeatures({})).toHaveLength(6);
  });
});
