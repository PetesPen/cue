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

const shape = (id: string, x: number, y: number) =>
  createShape(id, 'rectangle', { x, y, width: 300, height: 200 });

/** One slide with rectangles a (100, 200) and b (700, 200), and the given steps. */
async function openWith(store: DeckStore, steps: Step[] = []) {
  const deck: Deck = {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1000,
    updatedAt: Date.now(),
    slides: [
      {
        ...createSlide('s1'),
        elements: [shape('a', 100, 200), shape('b', 700, 200)],
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

const stored = async (store: DeckStore) => (await store.load('deck'))?.slides[0]?.animations ?? [];
const node = (id: string) => {
  const found = document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const ghost = () => document.querySelector<HTMLElement>('.move-ghost');
/** Where the ghost's left edge is, in slide pixels. */
const ghostX = () => (Number.parseFloat(ghost()?.style.left ?? 'NaN') / 100) * 1920;
const frameScale = () => {
  const frame = document.querySelector('.canvas .slide-frame')?.getBoundingClientRect();
  return (frame?.width ?? 1920) / 1920;
};
const pick = (id: string) => userEvent.click(node(id));
const moveStep = (id: string, element: string, x: number, y: number) =>
  createStep(id, element, 'move', 'click', { x, y });

/** A drag of the ghost with real pointer events, `dx` and `dy` in slide pixels. */
function dragGhost(dx: number, dy: number) {
  const target = ghost();
  if (!target) throw new Error('no ghost');
  const box = target.getBoundingClientRect();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const scale = frameScale();
  const at = (cx: number, cy: number, type: string) =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      button: 0,
      clientX: cx,
      clientY: cy,
    });
  target.dispatchEvent(at(x, y, 'pointerdown'));
  target.dispatchEvent(at(x + (dx * scale) / 2, y + (dy * scale) / 2, 'pointermove'));
  target.dispatchEvent(at(x + dx * scale, y + dy * scale, 'pointermove'));
  target.dispatchEvent(at(x + dx * scale, y + dy * scale, 'pointerup'));
}

// AN-3: Move

test('Given a selected element, When Move is chosen, Then a Move step is added with its end beside the element, and the ghost and its label show', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  await pick('a');

  await screen.getByRole('button', { name: '+ Move', exact: true }).click();

  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({ element: 'a', effect: 'move', x: 260, y: 280 });
  await expect.element(screen.getByText('Ends here · drag')).toBeVisible();
  expect(ghostX()).toBeCloseTo(260, 1);
  expect(ghost()?.getAttribute('aria-label')).toContain('X 260, Y 280');
  expect(document.querySelector('.move-path-line')).not.toBeNull();
  expect(document.querySelectorAll('.step-badge')).toHaveLength(1);
});

test('Given the ghost, When it is dragged and let go, Then the end moves with it in one step, and the element itself stays where it is', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [moveStep('m', 'a', 800, 600)]);
  await pick('a');
  const placeBefore = node('a').style.left;

  // Far from every guide, so the end lands exactly where it is let go (snapping has its own tests).
  dragGhost(130, -30);

  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({
      x: 930,
      y: 570,
    });
  expect(node('a').style.left).toBe(placeBefore);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({
      x: 800,
      y: 600,
    });
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given a drag of the ghost in progress, Then the ghost follows at once but nothing is saved until it is let go', async () => {
  const store = createTestStore();
  await openWith(store, [moveStep('m', 'a', 800, 600)]);
  await pick('a');
  const target = ghost();
  if (!target) throw new Error('no ghost');
  const box = target.getBoundingClientRect();
  const event = (type: string, x: number, y: number) =>
    new PointerEvent(type, { bubbles: true, pointerId: 3, button: 0, clientX: x, clientY: y });

  target.dispatchEvent(event('pointerdown', box.x + 5, box.y + 5));
  target.dispatchEvent(event('pointermove', box.x + 5 + 96 * frameScale(), box.y + 5));

  await expect.poll(ghostX).toBeCloseTo(896, 0);
  expect((await stored(store))[0]).toMatchObject({ x: 800 });
  target.dispatchEvent(event('pointerup', box.x + 5 + 96 * frameScale(), box.y + 5));
  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({ x: 896 });
});

test('Given the ghost focused, When the arrow keys are pressed, Then it moves 1 px each and 10 with Shift, and a run of presses is one undo step', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [moveStep('m', 'a', 800, 600)]);
  await pick('a');
  ghost()?.focus();

  await userEvent.keyboard('{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}');

  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({ x: 802, y: 610 });
  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({ x: 800, y: 600 });
});

test('Given a Move, When End X and End Y are typed in the panel, Then the end changes, and the ghost with it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [moveStep('m', 'a', 800, 600)]);
  await pick('a');

  await screen.getByRole('textbox', { name: 'End X' }).fill('1000');
  await userEvent.keyboard('{Enter}');
  await screen.getByRole('textbox', { name: 'End Y' }).fill('50');
  await userEvent.keyboard('{Enter}');

  await expect
    .poll(async () => (await stored(store))[0], { timeout: 3000 })
    .toMatchObject({ x: 1000, y: 50 });
  expect(ghostX()).toBeCloseTo(1000, 1);
});

test('Given a Move step, Then the style control is not there (a Move has no style) but the timing and easing are', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [moveStep('m', 'a', 800, 600)]);
  await pick('a');

  expect(document.querySelector('[aria-label="Style"]')).toBeNull();
  await expect.element(screen.getByRole('slider', { name: 'Duration' })).toBeVisible();
  await expect.element(screen.getByRole('group', { name: 'Easing' })).toBeVisible();
});

test('Given the ghost, Then it is only on the canvas while the Animate tab is open and a Move is chosen', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    moveStep('m', 'a', 800, 600),
    createStep('s', 'b', 'appear'),
  ]);
  await pick('a');
  expect(ghost()).not.toBeNull();

  await pick('b');
  expect(ghost()).toBeNull();
  await pick('a');
  await screen.getByRole('tab', { name: 'Design' }).click();

  expect(ghost()).toBeNull();
});

test('Given a Move, When Preview plays the click, Then the element ends exactly where the ghost was, stays for later clicks, and goes back to its place when Preview ends', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    moveStep('m', 'a', 800, 600),
    createStep('s', 'b', 'appear'),
  ]);
  const placed = node('a').getBoundingClientRect();
  const frame = document.querySelector('.canvas .cue-slide')?.getBoundingClientRect();
  if (!frame) throw new Error('no slide');
  const scale = frameScale();

  await screen.getByRole('button', { name: 'Preview' }).click();
  await userEvent.keyboard('{ArrowRight}');
  await expect
    .poll(() => Math.round((node('a').getBoundingClientRect().x - frame.x) / scale), {
      timeout: 3000,
    })
    .toBe(800);
  expect(Math.round((node('a').getBoundingClientRect().y - frame.y) / scale)).toBe(600);
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => Number(getComputedStyle(node('b')).opacity), { timeout: 3000 }).toBe(1);
  expect(Math.round((node('a').getBoundingClientRect().x - frame.x) / scale)).toBe(800);

  await screen.getByRole('button', { name: 'Stop preview' }).click();

  await expect.poll(() => node('a').getBoundingClientRect().x).toBeCloseTo(placed.x, 1);
  expect(node('a').getBoundingClientRect().y).toBeCloseTo(placed.y, 1);
  expect(node('a').getAnimations()).toHaveLength(0);
});

test('Given a Move, When the element is moved in the editor, Then the ghost does not move (the end is a place on the slide)', async () => {
  const store = createTestStore();
  await openWith(store, [moveStep('m', 'a', 800, 600)]);
  await pick('a');
  const before = ghostX();

  await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
  await expect.poll(() => node('a').style.left).toBe('110px');

  expect(ghostX()).toBeCloseTo(before, 1);
});
