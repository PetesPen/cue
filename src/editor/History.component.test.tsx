import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createShape, createText, plainText, textFromString, type Deck } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';
import { edit, editor, storedText } from './text-test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

const rect = (id: string, x = 400, y = 300) =>
  createShape(id, 'rectangle', { x, y, width: 300, height: 200 });

async function openWith(store: DeckStore, slides: number, ...elements: ReturnType<typeof rect>[]) {
  const base = deckWithSlides(slides);
  const deck: Deck = {
    ...base,
    slides: base.slides.map((slide, i) => (i === 0 ? { ...slide, elements } : slide)),
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  return screen;
}

const node = (id: string) =>
  document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);
const stored = async (store: DeckStore, slide = 0) =>
  (await store.load('deck'))?.slides[slide]?.elements ?? [];
const undoButton = (screen: Awaited<ReturnType<typeof openWith>>) =>
  screen.getByRole('button', { name: 'Undo' });
const redoButton = (screen: Awaited<ReturnType<typeof openWith>>) =>
  screen.getByRole('button', { name: 'Redo' });

async function select(id: string) {
  const target = node(id);
  if (!target) throw new Error(`no ${id}`);
  await userEvent.click(target);
}

// EL-8: undo and redo

test('Given a deck just opened, Then undo and redo are there but nothing can be undone', async () => {
  const screen = await openWith(createTestStore(), 1, rect('a'));

  await expect.element(undoButton(screen)).toBeDisabled();
  await expect.element(redoButton(screen)).toBeDisabled();
});

test('Given a shape nudged, When Ctrl+Z is pressed, Then it is back, and Ctrl+Shift+Z puts it again', async () => {
  const store = createTestStore();
  await openWith(store, 1, rect('a'));
  await select('a');
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => node('a')?.style.left).toBe('401px');

  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.poll(() => node('a')?.style.left).toBe('400px');
  await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

  await expect.poll(() => node('a')?.style.left).toBe('401px');
  await expect.poll(async () => (await stored(store))[0]?.x, { timeout: 3000 }).toBe(401);
});

test('Given an undo, When Ctrl+Y is pressed, Then it is redone too', async () => {
  const store = createTestStore();
  await openWith(store, 1, rect('a'));
  await select('a');
  await userEvent.keyboard('{ArrowDown}{Control>}z{/Control}');
  await expect.poll(() => node('a')?.style.top).toBe('300px');

  await userEvent.keyboard('{Control>}y{/Control}');

  await expect.poll(() => node('a')?.style.top).toBe('301px');
});

test('Given arrow key presses close together, When Ctrl+Z is pressed once, Then all of them are undone', async () => {
  const store = createTestStore();
  await openWith(store, 1, rect('a'));
  await select('a');
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}');
  await expect.poll(() => node('a')?.style.left).toBe('403px');

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect.poll(() => node('a')?.style.left).toBe('400px');
  expect(node('a')?.style.top).toBe('300px');
});

test('Given a shape changed in the Design panel, When the undo button is pressed, Then it is as it was, and the button says what it undoes', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rect('a'));
  await select('a');
  await screen.getByRole('textbox', { name: 'X', exact: true }).fill('900');
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => node('a')?.style.left).toBe('900px');

  await expect.element(undoButton(screen)).toHaveAttribute('title', 'Undo Move (Ctrl+Z)');
  await undoButton(screen).click();

  await expect.poll(() => node('a')?.style.left).toBe('400px');
  await expect.element(redoButton(screen)).toHaveAttribute('title', 'Redo Move (Ctrl+Shift+Z)');
});

test('Given a deleted shape, When Ctrl+Z is pressed, Then it is back where it was, in the same order, and selected', async () => {
  const store = createTestStore();
  await openWith(store, 1, rect('a', 100, 100), rect('b', 600, 100), rect('c', 1100, 100));
  await select('b');
  await userEvent.keyboard('{Delete}');
  await expect.poll(() => node('b')).toBeNull();

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect.poll(() => node('b')).not.toBeNull();
  expect(
    [...document.querySelectorAll<HTMLElement>('.slide-frame .cue-element')].map(
      (n) => n.dataset.elementId,
    ),
  ).toEqual(['a', 'b', 'c']);
  await expect.poll(() => document.querySelector('.sel-box')).not.toBeNull();
  await expect.poll(async () => (await stored(store)).length, { timeout: 3000 }).toBe(3);
});

test('Given a slide added, When Ctrl+Z is pressed, Then it is gone and the slide before is shown; redo brings it back', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rect('a'));
  await screen.getByRole('button', { name: 'New slide' }).click();
  await expect.element(screen.getByRole('option', { name: 'Slide 2', exact: true })).toBeVisible();

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect
    .element(screen.getByRole('option', { name: 'Slide 2', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole('option', { name: 'Slide 1', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
  await expect.element(screen.getByRole('option', { name: 'Slide 2', exact: true })).toBeVisible();
});

test('Given an edit on slide 1 and then a visit to slide 2, When Ctrl+Z is pressed, Then slide 1 is shown with its edit undone', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 2, rect('a'));
  await select('a');
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => node('a')?.style.left).toBe('401px');
  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();
  await expect.poll(() => node('a')).toBeNull();

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect
    .element(screen.getByRole('option', { name: 'Slide 1', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => node('a')?.style.left).toBe('400px');
});

test('Given notes typed, When Ctrl+Z is pressed outside the field, Then the notes are undone', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rect('a'));
  const field = screen.getByRole('textbox', { name: 'Speaker notes text' });
  await field.fill('Some notes');
  await userEvent.click(document.querySelector<HTMLElement>('.slide-frame') ?? document.body, {
    position: { x: 4, y: 4 },
  });
  await expect.poll(async () => (await store.load('deck'))?.slides[0]?.notes).toBe('Some notes');

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect.element(field).toHaveValue('');
});

// Typing in a text box: the app's history, not the editor's own

test('Given words typed in a text box, When Ctrl+Z is pressed while editing, Then the words are undone and the editor stays open', async () => {
  const store = createTestStore();
  const base = deckWithSlides(1);
  await store.save({
    ...base,
    slides: base.slides.map((slide) => ({
      ...slide,
      elements: [createText('t', { x: 200, y: 200, width: 800 }, textFromString('Our'))],
    })),
  });
  window.location.hash = '#/deck/deck';
  await render(<EditorApp store={store} />);
  await expect.poll(() => node('t')).not.toBeNull();
  await edit('t');
  await userEvent.keyboard('{End} approach');
  expect(editor()?.textContent).toBe('Our approach');

  await userEvent.keyboard('{Control>}z{/Control}');

  await expect.poll(() => editor()?.textContent).toBe('Our');
  expect(editor()).not.toBeNull();
  await userEvent.keyboard('{Escape}');
  await expect
    .poll(async () => plainText((await storedText(store)) ?? textFromString('')), { timeout: 3000 })
    .toBe('Our');
});

test('Given the history of an open deck, When the deck is left and opened again, Then the history is empty', async () => {
  const store = createTestStore();
  const first = await openWith(store, 1, rect('a'));
  await select('a');
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(undoButton(first)).toBeEnabled();
  await first.unmount();

  window.location.hash = '#/deck/deck';
  const second = await render(<EditorApp store={store} />);

  await expect.element(second.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  await expect.element(undoButton(second)).toBeDisabled();
});
