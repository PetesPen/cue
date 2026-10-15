import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

// SV-7: one tab per deck. Another tab is played by a lock taken here, in the test, under the name
// the editor uses; Web Locks are shared by every tab of the browser, so the editor cannot tell.

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

const held: (() => void)[] = [];
afterEach(() => {
  while (held.length > 0) held.pop()?.();
});

/** Act as another tab that has the deck open. Returns the way for that tab to "close". */
async function otherTabOpens(deckId: string): Promise<() => void> {
  let release: () => void = () => undefined;
  const granted = new Promise<void>((resolve) => {
    void navigator.locks.request(`cue-deck:${deckId}`, () => {
      resolve();
      return new Promise<void>((done) => {
        release = done;
      });
    });
  });
  await granted;
  held.push(() => {
    release();
  });
  return () => {
    release();
  };
}

async function openDeck(store: DeckStore, id = 'deck') {
  await store.save(deckWithSlides(2, 'Autumn Launch', id));
  window.location.hash = `#/deck/${id}`;
  return render(<EditorApp store={store} />);
}

test('Given a deck open in another tab, When this tab opens it, Then it says so, offers the library, and does not let you edit', async () => {
  await otherTabOpens('deck');

  const screen = await openDeck(createTestStore());

  await expect
    .element(screen.getByRole('heading', { name: 'This deck is open in another tab' }), {
      timeout: 3000,
    })
    .toBeVisible();
  await expect
    .element(screen.getByRole('link', { name: 'Back to your decks' }))
    .toHaveAttribute('href', '#/');
  expect(document.querySelector('.slide-frame')).toBeNull();
  expect(document.querySelector('.rail-item')).toBeNull();
});

test('Given the other tab closes, When this tab was waiting, Then the deck opens by itself, with no reload', async () => {
  const closeOther = await otherTabOpens('deck');
  const screen = await openDeck(createTestStore());
  await expect
    .element(screen.getByRole('heading', { name: 'This deck is open in another tab' }), {
      timeout: 3000,
    })
    .toBeVisible();

  closeOther();

  await expect
    .element(screen.getByRole('option', { name: 'Slide 1' }), { timeout: 3000 })
    .toBeVisible();
  await expect.element(screen.getByLabelText('Deck title')).toHaveValue('Autumn Launch');
});

test('Given another deck open in another tab, When this tab opens a different deck, Then nothing is blocked', async () => {
  await otherTabOpens('another-deck');

  const screen = await openDeck(createTestStore(), 'deck');

  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
});

test('Given the library is open, When the locks are read, Then none is a deck lock (the library takes no lock, so it can be open in any number of tabs)', async () => {
  const store = createTestStore();
  await store.save(deckWithSlides(1));
  window.location.hash = '#/';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByText('Autumn Launch')).toBeVisible();

  const locks = await navigator.locks.query();

  expect(locks.held?.filter((lock) => lock.name?.startsWith('cue-deck:'))).toEqual([]);
});

test('Given an open editor, When it is left, Then its lock is released so another tab can have the deck', async () => {
  const store = createTestStore();
  const screen = await openDeck(store);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  expect((await navigator.locks.query()).held?.some((lock) => lock.name === 'cue-deck:deck')).toBe(
    true,
  );

  window.location.hash = '#/';
  await expect.element(screen.getByRole('heading', { name: /Your decks/ })).toBeVisible();

  await expect
    .poll(async () => (await navigator.locks.query()).held?.some((l) => l.name === 'cue-deck:deck'))
    .toBe(false);
});

test('Given a browser with no Web Locks, When a deck is opened, Then it opens as before', async () => {
  Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
  try {
    const screen = await openDeck(createTestStore());

    await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  } finally {
    // Remove the shadowing property so the real lock manager is back for the next test.
    Reflect.deleteProperty(navigator, 'locks');
  }
});
