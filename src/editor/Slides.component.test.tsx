import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createShape, createSlide, createText, textFromString, type Deck } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore } from './test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

/** A deck whose slides are named by their ids; slide `b` has a shape, a text and notes. */
function deckOf(...ids: string[]): Deck {
  return {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1000,
    updatedAt: Date.now(),
    slides: ids.map((id) =>
      id === 'b'
        ? {
            ...createSlide(id),
            background: '#E8F0E4',
            notes: 'Notes of b',
            elements: [
              createShape('b-shape', 'ellipse', { x: 100, y: 100, width: 300, height: 200 }),
              createText(
                'b-text',
                { x: 100, y: 500, width: 600, height: 68 },
                textFromString('Hi'),
              ),
            ],
          }
        : createSlide(id),
    ),
  };
}

async function openWith(store: DeckStore, ...ids: string[]) {
  await store.save(deckOf(...ids));
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

const railIds = () =>
  [...document.querySelectorAll<HTMLElement>('.rail-item .cue-slide')].map(
    (s) => s.dataset.slideId ?? '',
  );
const storedIds = async (store: DeckStore) =>
  (await store.load('deck'))?.slides.map((s) => s.id) ?? [];
const item = (n: number) =>
  document.querySelectorAll<HTMLElement>('.rail-item')[n - 1] ?? document.body;
const selectedNumber = () =>
  [...document.querySelectorAll('.rail-item')].findIndex(
    (el) => el.getAttribute('aria-selected') === 'true',
  ) + 1;

async function focusSlide(n: number) {
  await userEvent.click(item(n));
}

// SL-4: duplicate and delete slides

test('Given a slide with elements and notes, When Ctrl+D is pressed on the rail, Then the copy follows it with everything, and is shown', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b', 'c');
  await focusSlide(2);

  await userEvent.keyboard('{Control>}d{/Control}');

  await expect.poll(() => railIds().length).toBe(4);
  expect(railIds()[0]).toBe('a');
  expect(railIds()[1]).toBe('b');
  expect(railIds()[3]).toBe('c');
  expect(selectedNumber()).toBe(3);
  await expect
    .poll(async () => (await store.load('deck'))?.slides.length, { timeout: 3000 })
    .toBe(4);
  const saved = (await store.load('deck'))?.slides;
  const [original, copy] = [saved?.[1], saved?.[2]];
  expect(copy).toMatchObject({ background: '#E8F0E4', notes: 'Notes of b' });
  expect(copy?.elements.map((e) => e.kind)).toEqual(['shape', 'text']);
  expect(copy?.elements.map((e) => e.id)).not.toEqual(original?.elements.map((e) => e.id));
  expect(copy?.id).not.toBe('b');
});

test('Given a slide, When Delete is pressed on the rail, Then it goes, a toast offers Undo, and Undo brings it back in the same place', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'a', 'b', 'c');
  await focusSlide(2);

  await userEvent.keyboard('{Delete}');

  await expect.poll(railIds).toEqual(['a', 'c']);
  await expect.element(screen.getByText('Slide 2 deleted')).toBeVisible();
  // The slide on show is its neighbour, not the one that was deleted.
  expect(selectedNumber()).toBe(2);
  await screen.getByRole('button', { name: 'Undo', exact: true }).first().click();

  await expect.poll(railIds).toEqual(['a', 'b', 'c']);
  expect(selectedNumber()).toBe(2);
  await expect.poll(() => document.querySelectorAll('.slide-frame .cue-element').length).toBe(2);
  await expect.element(screen.getByText('Slide 2 deleted')).not.toBeInTheDocument();
});

test('Given a slide deleted, When another edit is made, Then the toast no longer offers Undo for the deletion', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'a', 'b', 'c');
  await focusSlide(1);
  await userEvent.keyboard('{Delete}');
  await expect.element(screen.getByText('Slide 1 deleted')).toBeVisible();

  await screen.getByRole('button', { name: 'New slide' }).click();

  await expect.element(screen.getByText('Slide 1 deleted')).not.toBeInTheDocument();
});

test('Given a toast, When its close button is pressed, Then it goes', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'a', 'b');
  await focusSlide(1);
  await userEvent.keyboard('{Delete}');
  await expect.element(screen.getByText('Slide 1 deleted')).toBeVisible();

  await screen.getByRole('button', { name: 'Dismiss' }).click();

  await expect.element(screen.getByText('Slide 1 deleted')).not.toBeInTheDocument();
});

test('Given the only slide, When it is deleted, Then a blank slide remains', async () => {
  const store = createTestStore();
  await openWith(store, 'b');
  await focusSlide(1);

  await userEvent.keyboard('{Delete}');

  await expect
    .poll(async () => (await store.load('deck'))?.slides[0]?.elements.length, { timeout: 3000 })
    .toBe(0);
  expect(railIds()).toHaveLength(1);
  expect(railIds()[0]).not.toBe('b');
  expect((await store.load('deck'))?.slides[0]?.notes).toBe('');
});

// SL-3: reorder slides

test('Given three slides, When Ctrl+Shift+Down is pressed on the first, Then it moves down one, numbers follow, and it keeps the focus', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b', 'c');
  await focusSlide(1);

  await userEvent.keyboard('{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}');

  await expect.poll(railIds).toEqual(['b', 'a', 'c']);
  expect(selectedNumber()).toBe(2);
  await expect.poll(() => document.activeElement === item(2)).toBe(true);
  await expect.poll(() => storedIds(store), { timeout: 3000 }).toEqual(['b', 'a', 'c']);
});

test('Given a moved slide, When Ctrl+Z is pressed, Then it is back', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b', 'c');
  await focusSlide(3);
  await userEvent.keyboard('{Control>}{Shift>}{ArrowUp}{/Shift}{/Control}');
  await expect.poll(railIds).toEqual(['a', 'c', 'b']);

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect.poll(railIds).toEqual(['a', 'b', 'c']);
});

test('Given the first slide, When Ctrl+Shift+Up is pressed, Then nothing moves', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b');
  await focusSlide(1);

  await userEvent.keyboard('{Control>}{Shift>}{ArrowUp}{/Shift}{/Control}');

  expect(railIds()).toEqual(['a', 'b']);
});

test('Given a thumbnail, When it is dragged onto the middle of a later one, Then it lands just before that one and numbers update', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b', 'c');

  await userEvent.dragAndDrop(item(1), item(3));

  await expect.poll(railIds).toEqual(['b', 'a', 'c']);
  expect(selectedNumber()).toBe(2);
  await expect.poll(() => storedIds(store), { timeout: 3000 }).toEqual(['b', 'a', 'c']);
});

test('Given a thumbnail dragged and let go where it started, Then the order is unchanged', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b', 'c');

  await userEvent.dragAndDrop(item(2), item(2));

  expect(railIds()).toEqual(['a', 'b', 'c']);
});

// The right-click menu

test('Given a thumbnail, When it is right-clicked, Then the menu offers duplicate, delete and move, with the ends disabled', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'a', 'b', 'c');
  const first = item(1);

  first.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: first.getBoundingClientRect().left + 20,
      clientY: first.getBoundingClientRect().top + 20,
    }),
  );

  await expect.element(screen.getByRole('menu', { name: 'Slide actions' })).toBeVisible();
  const labels = [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
  expect(labels).toEqual([
    'Duplicate slideCtrl+D',
    'Delete slideDel',
    'Move upCtrl+Shift+↑',
    'Move downCtrl+Shift+↓',
  ]);
  await expect.element(screen.getByRole('menuitem', { name: /^Move up/ })).toBeDisabled();
  await screen.getByRole('menuitem', { name: /^Move down/ }).click();
  await expect.poll(railIds).toEqual(['b', 'a', 'c']);
});

test('Given the menu, When Duplicate slide is chosen, Then a copy appears after the slide', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'a', 'b');
  const first = item(1);
  first.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: first.getBoundingClientRect().left + 20,
      clientY: first.getBoundingClientRect().top + 20,
    }),
  );

  await screen.getByRole('menuitem', { name: /^Duplicate slide/ }).click();

  await expect.poll(() => railIds().length).toBe(3);
  expect(railIds()[0]).toBe('a');
  expect(railIds()[2]).toBe('b');
});

test('Given Delete pressed on the slide area, When a shape is selected, Then it deletes the shape, not the slide', async () => {
  const store = createTestStore();
  await openWith(store, 'a', 'b');
  await focusSlide(2);
  const shape = document.querySelector<HTMLElement>('.slide-frame [data-element-id="b-shape"]');
  if (!shape) throw new Error('no shape');
  await userEvent.click(shape);

  await userEvent.keyboard('{Delete}');

  await expect
    .poll(() => document.querySelector('.slide-frame [data-element-id="b-shape"]'))
    .toBeNull();
  expect(railIds()).toEqual(['a', 'b']);
});
