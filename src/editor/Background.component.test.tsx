import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { Deck } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

async function openWith(store: DeckStore, backgrounds: readonly string[]) {
  const base = deckWithSlides(backgrounds.length);
  const deck: Deck = {
    ...base,
    slides: base.slides.map((slide, i) => ({ ...slide, background: backgrounds[i] ?? '#FFFFFF' })),
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  return screen;
}

const storedBackgrounds = async (store: DeckStore) =>
  (await store.load('deck'))?.slides.map((slide) => slide.background);

/** What the canvas and the rail's thumbnails paint behind the elements, as the browser computes it. */
const canvasColour = () => {
  const slide = document.querySelector<HTMLElement>('.canvas .cue-slide');
  return slide ? getComputedStyle(slide).backgroundColor : undefined;
};
const thumbnailColour = (index: number) => {
  const slide = document.querySelectorAll<HTMLElement>('.rail-item .cue-slide')[index];
  return slide ? getComputedStyle(slide).backgroundColor : undefined;
};

const DARK = 'rgb(20, 40, 27)';
const WHITE = 'rgb(255, 255, 255)';

// SL-5: slide background

test('Given a slide with nothing selected, When a colour is typed in the Slide section, Then the slide and its thumbnail show it, and it is saved', async () => {
  const store = createTestStore();
  const screen = await openWith(store, ['#FFFFFF']);

  await screen.getByRole('textbox', { name: 'Background as hex' }).fill('14281B');
  await userEvent.keyboard('{Enter}');

  await expect.poll(canvasColour).toBe(DARK);
  expect(thumbnailColour(0)).toBe(DARK);
  await expect.poll(() => storedBackgrounds(store), { timeout: 3000 }).toEqual(['#14281B']);
});

test('Given a new background, When Undo is pressed, Then it is as it was, in one step', async () => {
  const store = createTestStore();
  const screen = await openWith(store, ['#FFFFFF']);
  await screen.getByRole('textbox', { name: 'Background as hex' }).fill('14281B');
  await userEvent.keyboard('{Enter}');
  await expect.poll(canvasColour).toBe(DARK);

  await expect
    .element(screen.getByRole('button', { name: 'Undo' }))
    .toHaveAttribute('title', 'Undo Change background (Ctrl+Z)');
  await screen.getByRole('button', { name: 'Undo' }).click();

  await expect.poll(canvasColour).toBe(WHITE);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given three slides, When "Apply to all slides" is pressed, Then every slide has the colour, and one Undo puts each back', async () => {
  const store = createTestStore();
  const screen = await openWith(store, ['#FFFFFF', '#F5C542', '#7FC8A0']);
  await screen.getByRole('textbox', { name: 'Background as hex' }).fill('14281B');
  await userEvent.keyboard('{Enter}');
  await expect.poll(canvasColour).toBe(DARK);
  expect(thumbnailColour(1)).toBe('rgb(245, 197, 66)');

  await screen.getByRole('button', { name: 'Apply to all slides' }).click();

  await expect.poll(() => thumbnailColour(2)).toBe(DARK);
  expect(thumbnailColour(1)).toBe(DARK);
  await expect
    .poll(() => storedBackgrounds(store), { timeout: 3000 })
    .toEqual(['#14281B', '#14281B', '#14281B']);

  await screen.getByRole('button', { name: 'Undo' }).click();

  await expect.poll(() => thumbnailColour(2)).toBe('rgb(127, 200, 160)');
  expect(thumbnailColour(1)).toBe('rgb(245, 197, 66)');
});

test('Given the colour picker opened from the Slide section, When a code is typed in it, Then the slide shows that colour', async () => {
  const store = createTestStore();
  const screen = await openWith(store, ['#FFFFFF']);

  await screen.getByRole('button', { name: 'Choose background' }).click();
  await screen.getByRole('textbox', { name: 'Background hex code' }).fill('F5C542');
  await userEvent.keyboard('{Enter}');

  await expect.poll(canvasColour).toBe('rgb(245, 197, 66)');
});
