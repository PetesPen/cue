import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createShape, type Deck, type ShapeElement } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

// EL-6: align and distribute.

const rect = (id: string, x: number, y: number, width = 200, height = 100) =>
  createShape(id, 'rectangle', { x, y, width, height });

async function openWith(store: DeckStore, ...elements: ShapeElement[]) {
  const base = deckWithSlides(1);
  const deck: Deck = {
    ...base,
    slides: base.slides.map((slide) => ({ ...slide, elements })),
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

type Opened = Awaited<ReturnType<typeof openWith>>;

const node = (id: string) => {
  const found = document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const left = (id: string) => Number.parseFloat(node(id).style.left);
const top = (id: string) => Number.parseFloat(node(id).style.top);
const width = (id: string) => Number.parseFloat(node(id).style.width);
const height = (id: string) => Number.parseFloat(node(id).style.height);

/** Click the first, then Shift-click the others: all of them are selected. */
async function selectAll(ids: readonly string[]) {
  const [first, ...rest] = ids;
  if (!first) return;
  await userEvent.click(node(first));
  for (const id of rest) await userEvent.click(node(id), { modifiers: ['Shift'] });
}

const press = (screen: Opened, name: string) =>
  screen.getByRole('button', { name, exact: true }).click();

const three = () => [rect('a', 100, 50), rect('b', 400, 300, 700, 100), rect('c', 800, 550)];
const ids = ['a', 'b', 'c'];

test('Given three shapes selected, When Align left is pressed, Then they line up on the left of the selection', async () => {
  const screen = await openWith(createTestStore(), ...three());
  await selectAll(ids);

  await press(screen, 'Align left');

  await expect.poll(() => ids.map(left)).toEqual([100, 100, 100]);
});

test('Given three shapes selected, When Align right is pressed, Then they line up on the right of the selection', async () => {
  const screen = await openWith(createTestStore(), ...three());
  await selectAll(ids);

  await press(screen, 'Align right');

  // The selection runs from x 100 to 1100.
  await expect.poll(() => ids.map((id) => left(id) + width(id))).toEqual([1100, 1100, 1100]);
});

test('Given three shapes selected, When Align top and Align bottom are pressed, Then they line up on the top and then the bottom', async () => {
  const screen = await openWith(createTestStore(), ...three());
  await selectAll(ids);

  await press(screen, 'Align top');
  await expect.poll(() => ids.map(top)).toEqual([50, 50, 50]);
  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.poll(() => ids.map(top)).toEqual([50, 300, 550]);
  // Undo selects the shapes the step moved (the first was already on the line): select all again.
  await selectAll(ids);
  await press(screen, 'Align bottom');

  // The selection runs from y 50 to 650.
  await expect.poll(() => ids.map((id) => top(id) + height(id))).toEqual([650, 650, 650]);
});

test('Given three shapes selected, When Align centre and Align middle are pressed, Then their middles line up on the middle of the selection', async () => {
  const screen = await openWith(createTestStore(), ...three());
  await selectAll(ids);

  await press(screen, 'Align centre');
  await expect.poll(() => ids.map((id) => left(id) + width(id) / 2)).toEqual([600, 600, 600]);
  await press(screen, 'Align middle');

  await expect.poll(() => ids.map((id) => top(id) + height(id) / 2)).toEqual([350, 350, 350]);
});

test('Given one shape selected, When Align centre and Align middle are pressed, Then it is centred on the slide', async () => {
  const screen = await openWith(createTestStore(), rect('a', 100, 50, 400, 200));
  await userEvent.click(node('a'));

  await press(screen, 'Align centre');
  await press(screen, 'Align middle');

  await expect.poll(() => [left('a'), top('a')]).toEqual([760, 440]);
});

test('Given an element already in place, When Align is pressed, Then nothing is saved as a new step', async () => {
  const screen = await openWith(createTestStore(), rect('a', 0, 0));
  await userEvent.click(node('a'));

  await press(screen, 'Align left');

  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given three shapes, When Distribute horizontally is pressed, Then the gaps are equal and the outer two stay put, in one undo step', async () => {
  const screen = await openWith(
    createTestStore(),
    rect('a', 100, 50),
    rect('b', 250, 50),
    rect('c', 900, 50),
  );
  await selectAll(ids);

  await press(screen, 'Distribute horizontally');

  // Span 100 to 1100, widths 600: two gaps of 200, so b starts at 500.
  await expect.poll(() => ids.map(left)).toEqual([100, 500, 900]);
  await userEvent.hover(screen.getByRole('button', { name: 'Undo' }));
  await expect
    .poll(() => screen.getByRole('tooltip').element().textContent)
    .toBe('Undo DistributeCtrlZ');
  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => ids.map(left)).toEqual([100, 250, 900]);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given three shapes, When Distribute vertically is pressed, Then the vertical gaps are equal', async () => {
  const screen = await openWith(
    createTestStore(),
    rect('a', 100, 0),
    rect('b', 100, 100),
    rect('c', 100, 900),
  );
  await selectAll(ids);

  await press(screen, 'Distribute vertically');

  await expect.poll(() => ids.map(top)).toEqual([0, 450, 900]);
});

test('Given fewer than three shapes selected, Then Distribute is not available; Align is', async () => {
  const screen = await openWith(createTestStore(), rect('a', 100, 50), rect('b', 400, 300));
  await selectAll(['a', 'b']);

  await expect
    .element(screen.getByRole('button', { name: 'Distribute horizontally' }))
    .toBeDisabled();
  await expect
    .element(screen.getByRole('button', { name: 'Distribute vertically' }))
    .toBeDisabled();
  await expect.element(screen.getByRole('button', { name: 'Align left' })).toBeEnabled();
});

test('Given a turned shape and another, When they are aligned left, Then the outer box of the turned one lines up', async () => {
  const turned = { ...rect('t', 400, 300, 200, 100), rotation: 90 };
  const screen = await openWith(createTestStore(), rect('a', 100, 50), turned);
  await selectAll(['a', 't']);

  await press(screen, 'Align left');

  // 200 x 100 turned a quarter turn is 100 x 200 about (500, 350): its outer box starts at x 450. To
  // start at 100 its own x moves by 350.
  await expect.poll(() => left('t')).toBe(50);
  expect(left('a')).toBe(100);
});

test('Given the Align buttons, When one is hovered, Then its hint names it', async () => {
  const screen = await openWith(createTestStore(), rect('a', 100, 50));
  await userEvent.click(node('a'));

  await userEvent.hover(screen.getByRole('button', { name: 'Align top', exact: true }));

  await expect.poll(() => screen.getByRole('tooltip').element().textContent).toBe('Align top');
});
