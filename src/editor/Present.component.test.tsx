import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import type { OpenAudience } from './PresentContext';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  vi.restoreAllMocks();
  window.location.hash = '';
});

// PM-1: starting a presentation from the editor.

async function openEditor(store: DeckStore, openAudience?: OpenAudience, slides = 3) {
  const deck = deckWithSlides(slides);
  await store.save(deck);
  window.location.hash = `#/deck/${deck.id}`;
  const screen = await render(<EditorApp store={store} {...(openAudience && { openAudience })} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

test('Given no way to open the audience window, When the editor opens, Then there is no Present button', async () => {
  const screen = await openEditor(createTestStore());

  expect(screen.getByRole('button', { name: 'Present', exact: true }).elements()).toHaveLength(0);
});

test('Given the editor, When Present is pressed, Then the audience window is asked for from slide 1 and this tab becomes the presenter view', async () => {
  const open = vi.fn<OpenAudience>(() => true);
  const screen = await openEditor(createTestStore(), open);
  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();

  await screen.getByRole('button', { name: 'Present', exact: true }).click();

  await expect.poll(() => window.location.hash).toBe('#/show/deck');
  expect(open).toHaveBeenCalledExactlyOnceWith('deck', 0);
});

test('Given the Present menu, When "from this slide" is chosen, Then the show starts at the slide being edited', async () => {
  const open = vi.fn<OpenAudience>(() => true);
  const screen = await openEditor(createTestStore(), open);
  await screen.getByRole('option', { name: 'Slide 3', exact: true }).click();

  await screen.getByRole('button', { name: 'Ways to present' }).click();
  await expect
    .element(screen.getByRole('menuitem', { name: 'Present from the beginning' }))
    .toBeVisible();
  await screen.getByRole('menuitem', { name: 'Present from this slide' }).click();

  await expect.poll(() => window.location.hash).toBe('#/show/deck?slide=3');
  expect(open).toHaveBeenCalledExactlyOnceWith('deck', 2);
});

test('Given the shortcuts, When Ctrl+Enter and Ctrl+Shift+Enter are pressed, Then the show starts from the beginning, or from this slide', async () => {
  const open = vi.fn<OpenAudience>(() => false);
  const screen = await openEditor(createTestStore(), open);
  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();

  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await expect.poll(() => open.mock.calls).toEqual([['deck', 0]]);
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');

  await expect
    .poll(() => open.mock.calls)
    .toEqual([
      ['deck', 0],
      ['deck', 1],
    ]);
});

test('Given a title still being saved, When Present is pressed, Then the deck is on disk before the window opens', async () => {
  const store = createTestStore();
  let stored: string | undefined;
  const open = vi.fn<OpenAudience>(() => {
    void store.load('deck').then((deck) => {
      stored = deck?.title;
    });
    return true;
  });
  const screen = await openEditor(store, open);
  await screen.getByLabelText('Deck title').fill('Pitch v2');

  await screen.getByRole('button', { name: 'Present', exact: true }).click();

  await expect.poll(() => stored).toBe('Pitch v2');
});

test('Given a browser that blocks the window, When Present is pressed, Then the card explains and offers both ways on', async () => {
  const open = vi.fn<OpenAudience>(() => false);
  const screen = await openEditor(createTestStore(), open);

  await screen.getByRole('button', { name: 'Present', exact: true }).click();

  await expect
    .element(screen.getByRole('dialog', { name: 'Your browser blocked the audience window' }))
    .toBeVisible();
  await expect.element(screen.getByText(/Allow pop-ups for this site/)).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Present in one window' })).toBeVisible();
  // The editor stays where it was until a way on is chosen.
  expect(window.location.hash).toBe('#/deck/deck');
});

test('Given the card, When Try again is pressed and the window opens, Then the show starts', async () => {
  const open = vi.fn<OpenAudience>().mockReturnValueOnce(false).mockReturnValue(true);
  const screen = await openEditor(createTestStore(), open);
  await screen.getByRole('button', { name: 'Present', exact: true }).click();

  await screen.getByRole('button', { name: 'Try again' }).click();

  await expect.poll(() => window.location.hash).toBe('#/show/deck');
  expect(open).toHaveBeenCalledTimes(2);
});

test('Given the card, When Present in one window is chosen, Then the show runs in this tab without a second window', async () => {
  const open = vi.fn<OpenAudience>(() => false);
  const screen = await openEditor(createTestStore(), open);
  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();
  await screen.getByRole('button', { name: 'Ways to present' }).click();
  await screen.getByRole('menuitem', { name: 'Present from this slide' }).click();

  await screen.getByRole('button', { name: 'Present in one window' }).click();

  await expect.poll(() => window.location.hash).toBe('#/show/deck/single?slide=2');
});

test('Given the card, When it is dismissed, Then nothing starts and the editor is as it was', async () => {
  const open = vi.fn<OpenAudience>(() => false);
  const screen = await openEditor(createTestStore(), open);
  await screen.getByRole('button', { name: 'Present', exact: true }).click();
  await expect.element(screen.getByRole('dialog')).toBeVisible();

  await userEvent.keyboard('{Escape}');

  await expect.poll(() => screen.getByRole('dialog').elements()).toHaveLength(0);
  expect(window.location.hash).toBe('#/deck/deck');
});
