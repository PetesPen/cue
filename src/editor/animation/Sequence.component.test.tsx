import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createShape, createSlide, createStep, type Deck, type Step } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from '../EditorApp';
import { closeTestStores, createTestStore } from '../test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

// AN-5: the order of the steps, and which play together.

const ELEMENTS = ['a', 'b', 'c', 'd'] as const;

/** One slide with rectangles a to d, and steps "A:c" (On click) or "B:w" (With previous) for them. */
async function openWith(store: DeckStore, ...notes: string[]) {
  const steps: Step[] = notes.map((note) => {
    const [id = '', how] = note.split(':');
    return createStep(id, id.toLowerCase(), 'appear', how === 'w' ? 'with-previous' : 'click');
  });
  const deck: Deck = {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1000,
    updatedAt: Date.now(),
    slides: [
      {
        ...createSlide('s1'),
        elements: ELEMENTS.map((id, i) =>
          createShape(id, 'rectangle', { x: 100 + i * 400, y: 300, width: 300, height: 200 }),
        ),
        animations: steps,
      },
    ],
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  await screen.getByRole('tab', { name: 'Animate' }).click();
  return screen;
}

const stored = async (store: DeckStore) =>
  ((await store.load('deck'))?.slides[0]?.animations ?? []).map(
    (s) => `${s.id}:${s.trigger === 'click' ? 'c' : 'w'}`,
  );
const rows = () => [...document.querySelectorAll<HTMLElement>('.step-row')];
const rowIds = () => rows().map((row) => row.dataset.stepId);
const headings = () => [...document.querySelectorAll('.step-click h2')].map((h) => h.textContent);

/** A drag of one row to a height, with real pointer events on the window (where the list listens). */
function dragRow(from: HTMLElement, toY: number, release = true) {
  const box = from.getBoundingClientRect();
  const event = (type: string, y: number) =>
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 5,
      button: 0,
      clientX: box.x + 20,
      clientY: y,
    });
  from.dispatchEvent(event('pointerdown', box.y + box.height / 2));
  window.dispatchEvent(event('pointermove', box.y + box.height / 2 + 2));
  window.dispatchEvent(event('pointermove', toY));
  if (release) window.dispatchEvent(event('pointerup', toY));
}

test('Given steps for three clicks, When the Animate tab is opened, Then they are listed in play order under "Click n" headings, each with its element and effect', async () => {
  const screen = await openWith(createTestStore(), 'A:c', 'B:w', 'C:c');

  expect(headings()).toEqual(['Click 1', 'Click 2']);
  expect(rowIds()).toEqual(['A', 'B', 'C']);
  await expect.element(screen.getByText('3 steps · 2 clicks')).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'Rectangle, Appear, with previous' }))
    .toBeVisible();
});

test('Given a step, When it is dragged to a new place, Then a line shows where it will land, and it moves when let go, in one undo step', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'A:c', 'B:c', 'C:c');
  const [first, , third] = rows();
  if (!first || !third) throw new Error('no rows');
  const below = third.getBoundingClientRect().bottom + 4;

  dragRow(first, below, false);
  await expect.poll(() => document.querySelector('.step-drop-line') !== null).toBe(true);
  window.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, pointerId: 5, button: 0, clientY: below }),
  );

  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['B:c', 'C:c', 'A:c']);
  await expect.poll(rowIds).toEqual(['B', 'C', 'A']);
  expect(document.querySelector('.step-drop-line')).toBeNull();
  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['A:c', 'B:c', 'C:c']);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given a drag in progress, When Escape is pressed, Then nothing moves', async () => {
  const store = createTestStore();
  await openWith(store, 'A:c', 'B:c', 'C:c');
  const [first, , third] = rows();
  if (!first || !third) throw new Error('no rows');

  dragRow(first, third.getBoundingClientRect().bottom + 4, false);
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );

  await expect.poll(() => document.querySelector('.step-drop-line')).toBeNull();
  expect(rowIds()).toEqual(['A', 'B', 'C']);
  expect(await stored(store)).toEqual(['A:c', 'B:c', 'C:c']);
});

test('Given a short press on a step, Then it is a click that selects it, not a drag', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'A:c', 'B:c');
  const second = rows()[1];
  if (!second) throw new Error('no row');

  await userEvent.click(second);

  await expect.element(screen.getByRole('region', { name: 'Step settings' })).toBeVisible();
  expect(second.getAttribute('aria-current')).toBe('true');
  expect(await stored(store)).toEqual(['A:c', 'B:c']);
});

test('Given a step focused, When Alt and the down or up arrow are pressed, Then it moves one place and keeps the focus', async () => {
  const store = createTestStore();
  await openWith(store, 'A:c', 'B:c', 'C:c');
  rows()[0]?.focus();

  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['B:c', 'A:c', 'C:c']);
  await expect.poll(() => document.activeElement?.getAttribute('data-step-id')).toBe('A');
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');

  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['A:c', 'B:c', 'C:c']);
});

test('Given the first step, When it is moved up, Then nothing happens; the last one cannot go down either', async () => {
  const store = createTestStore();
  await openWith(store, 'A:c', 'B:c');
  rows()[0]?.focus();

  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
  rows()[1]?.focus();
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');

  expect(await stored(store)).toEqual(['A:c', 'B:c']);
});

test('Given a second step, When it is set to With previous, Then it joins the first click, and the counts and headings follow', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 'A:c', 'B:c');
  rows()[1]?.click();

  await screen
    .getByRole('group', { name: 'When' })
    .getByRole('button', { name: 'With previous' })
    .click();

  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['A:c', 'B:w']);
  await expect.element(screen.getByText('2 steps · 1 click')).toBeVisible();
  expect(headings()).toEqual(['Click 1']);
});

test('Given a step that is With previous, When it is dragged to the front, Then it becomes the first and is On click', async () => {
  const store = createTestStore();
  await openWith(store, 'A:c', 'B:w', 'C:c');
  const [, second] = rows();
  if (!second) throw new Error('no row');
  const top = rows()[0]?.getBoundingClientRect().top ?? 0;

  dragRow(second, top - 2);

  await expect.poll(() => stored(store), { timeout: 3000 }).toEqual(['B:c', 'A:c', 'C:c']);
});

test('Given the Design tab, Then the rows can be moved only in the Animate tab', async () => {
  const screen = await openWith(createTestStore(), 'A:c', 'B:c');

  await screen.getByRole('tab', { name: 'Design' }).click();

  expect(document.querySelector('.step-list')?.closest('[hidden]')).not.toBeNull();
});
