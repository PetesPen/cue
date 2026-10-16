import { afterEach, beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import {
  createShape,
  createText,
  isTextBox,
  parseElements,
  textFromString,
  type Deck,
  type SlideElement,
} from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';
import { ELEMENTS_MIME, PASTE_OFFSET, clearInternalClipboard } from './useClipboard';

beforeEach(clearInternalClipboard);
afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

const rectangle = (id: string, x: number, y: number) => ({
  ...createShape(id, 'rectangle', { x, y, width: 300, height: 200 }),
  fill: '#F5C542',
  opacity: 0.6,
});
const ellipse = (id: string, x: number, y: number) =>
  createShape(id, 'ellipse', { x, y, width: 300, height: 200 });
const words = (id: string, x: number, y: number) =>
  createText(id, { x, y, width: 600, height: 68 }, textFromString('Our approach'));

/** A deck of `slides` slides; the first holds these elements. */
async function openWith(store: DeckStore, slides: number, ...elements: SlideElement[]) {
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

const stored = async (store: DeckStore, slide = 0) =>
  (await store.load('deck'))?.slides[slide]?.elements ?? [];
const node = (id: string) =>
  document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);
const drawnIds = () =>
  [...document.querySelectorAll<HTMLElement>('.slide-frame .cue-element')].map(
    (n) => n.dataset.elementId ?? '',
  );
const selectedBoxes = () => document.querySelectorAll('.sel-member, .sel-box').length;

/** A right click in the middle of an element: the browser's contextmenu event at that point. */
function rightClick(target: HTMLElement) {
  const box = target.getBoundingClientRect();
  target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }),
  );
}

async function click(id: string) {
  const target = node(id);
  if (!target) throw new Error(`no ${id}`);
  await userEvent.click(target);
}

async function addToSelection(id: string) {
  await userEvent.keyboard('{Shift>}');
  await click(id);
  await userEvent.keyboard('{/Shift}');
}

/** What the browser does for Ctrl+C: a copy event that carries the clipboard. */
function copyEvent(): DataTransfer {
  const data = new DataTransfer();
  (document.activeElement ?? document.body).dispatchEvent(
    new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }),
  );
  return data;
}

function pasteEvent(data: DataTransfer) {
  (document.activeElement ?? document.body).dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

const withoutPlace = (element: SlideElement) => ({ ...element, id: '', x: 0, y: 0 });

// EL-7: copy, paste and delete

test('Given two shapes and a text box selected, When they are copied, Then the clipboard holds all three, formatting and all, and the words as plain text', async () => {
  const store = createTestStore();
  const originals = [rectangle('a', 100, 100), ellipse('b', 500, 100), words('t', 100, 500)];
  await openWith(store, 1, ...originals);
  await click('a');
  await addToSelection('b');
  await addToSelection('t');

  const data = copyEvent();

  expect(parseElements(data.getData(ELEMENTS_MIME))?.map((e) => e.id)).toEqual(['a', 'b', 't']);
  expect(parseElements(data.getData(ELEMENTS_MIME))).toEqual(originals);
  expect(data.getData('text/plain')).toBe('Our approach');
});

test('Given three elements copied, When they are pasted on another slide, Then three new elements appear there, formatted the same, slightly offset and selected', async () => {
  const store = createTestStore();
  const originals = [rectangle('a', 100, 100), ellipse('b', 500, 100), words('t', 100, 500)];
  const screen = await openWith(store, 2, ...originals);
  await click('a');
  await addToSelection('b');
  await addToSelection('t');
  const data = copyEvent();
  await screen.getByRole('option', { name: 'Slide 2', exact: true }).click();
  await userEvent.click(document.querySelector<HTMLElement>('.slide-frame') ?? document.body, {
    position: { x: 4, y: 4 },
  });

  pasteEvent(data);

  await expect.poll(async () => (await stored(store, 1)).length).toBe(3);
  const pasted = await stored(store, 1);
  expect(pasted.map((e) => e.id)).not.toContain('a');
  expect(new Set(pasted.map((e) => e.id)).size).toBe(3);
  expect(pasted.map((e) => [e.x, e.y])).toEqual([
    [100 + PASTE_OFFSET, 100 + PASTE_OFFSET],
    [500 + PASTE_OFFSET, 100 + PASTE_OFFSET],
    [100 + PASTE_OFFSET, 500 + PASTE_OFFSET],
  ]);
  expect(pasted.map(withoutPlace)).toEqual(originals.map(withoutPlace));
  // Slide 1 still has its own three, and the three new ones are selected.
  expect((await stored(store, 0)).length).toBe(3);
  await expect.poll(selectedBoxes).toBeGreaterThanOrEqual(3);
});

test('Given a copy, When it is pasted twice, Then each paste sits a little further on', async () => {
  const store = createTestStore();
  await openWith(store, 1, rectangle('a', 100, 100));
  await click('a');
  const data = copyEvent();

  pasteEvent(data);
  await expect.poll(async () => (await stored(store)).length).toBe(2);
  pasteEvent(data);

  await expect.poll(async () => (await stored(store)).length).toBe(3);
  expect((await stored(store)).map((e) => e.x)).toEqual([
    100,
    100 + PASTE_OFFSET,
    100 + 2 * PASTE_OFFSET,
  ]);
});

test('Given a selection, When it is cut, Then it is gone from the slide, and pasting brings it back', async () => {
  const store = createTestStore();
  await openWith(store, 1, rectangle('a', 100, 100), ellipse('b', 500, 100));
  await click('a');

  const data = new DataTransfer();
  (document.activeElement ?? document.body).dispatchEvent(
    new ClipboardEvent('cut', { clipboardData: data, bubbles: true, cancelable: true }),
  );

  await expect.poll(async () => (await stored(store)).map((e) => e.id)).toEqual(['b']);
  pasteEvent(data);
  await expect.poll(async () => (await stored(store)).length).toBe(2);
  expect((await stored(store))[1]).toMatchObject({
    kind: 'shape',
    shape: 'rectangle',
    fill: '#F5C542',
  });
});

test('Given a selection, When Delete is pressed, Then it is removed', async () => {
  const store = createTestStore();
  await openWith(store, 1, rectangle('a', 100, 100), ellipse('b', 500, 100));
  await click('a');

  await userEvent.keyboard('{Delete}');

  await expect.poll(async () => (await stored(store)).map((e) => e.id)).toEqual(['b']);
  expect(node('a')).toBeNull();
});

test('Given a selection, When Backspace is pressed, Then it is removed too', async () => {
  const store = createTestStore();
  await openWith(store, 1, rectangle('a', 100, 100), ellipse('b', 500, 100));
  await click('b');

  await userEvent.keyboard('{Backspace}');

  await expect.poll(async () => (await stored(store)).map((e) => e.id)).toEqual(['a']);
});

test('Given a shape selected and the deck title being edited, When Backspace is pressed, Then it edits the title, not the slide', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rectangle('a', 100, 100));
  await click('a');

  await screen.getByRole('textbox', { name: 'Deck title' }).click();
  await userEvent.keyboard('{Backspace}');

  expect(node('a')).not.toBeNull();
  expect((await stored(store)).length).toBe(1);
});

test('Given a selection, When Ctrl+D is pressed, Then copies appear at once, offset, on top and selected, and the originals stay', async () => {
  const store = createTestStore();
  await openWith(store, 1, rectangle('a', 100, 100), words('t', 100, 500));
  await click('a');
  await addToSelection('t');

  await userEvent.keyboard('{Control>}d{/Control}');

  await expect.poll(async () => (await stored(store)).length).toBe(4);
  const all = await stored(store);
  expect(all.slice(0, 2).map((e) => e.id)).toEqual(['a', 't']);
  expect(all.slice(2).map((e) => [e.x, e.y])).toEqual([
    [124, 124],
    [124, 524],
  ]);
  expect(all.slice(2).some((e) => isTextBox(e))).toBe(true);
  expect(drawnIds().slice(2)).toEqual(all.slice(2).map((e) => e.id));
});

test('Given text being edited, When Delete is pressed, Then it deletes a letter and the element stays', async () => {
  const store = createTestStore();
  await openWith(store, 1, words('t', 100, 200));
  const target = node('t');
  if (!target) throw new Error('no text box');
  await userEvent.dblClick(target);
  await expect
    .poll(() => document.querySelector('.text-edit-box .ProseMirror'), { timeout: 5000 })
    .not.toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 300));

  await userEvent.keyboard('{Control>}{Home}{/Control}{Delete}');

  expect(document.querySelector('.text-edit-box .ProseMirror')?.textContent).toBe('ur approach');
  expect(node('t')).not.toBeNull();
});

test('Given text copied from another program, When it is pasted onto the slide, Then it becomes a text box that fits its words, and is selected', async () => {
  const store = createTestStore();
  await openWith(store, 1);
  await userEvent.click(document.querySelector<HTMLElement>('.slide-frame') ?? document.body, {
    position: { x: 4, y: 4 },
  });
  const data = new DataTransfer();
  data.setData('text/plain', 'Pasted from a web page\nsecond line');

  pasteEvent(data);

  await expect.poll(async () => (await stored(store)).length).toBe(1);
  const [box] = await stored(store);
  expect(box && isTextBox(box)).toBe(true);
  // Two lines of the default size, with the usual line spacing.
  expect(box?.height).toBeGreaterThan(120);
  expect(document.querySelector('.sel-box')).not.toBeNull();
});

test('Given something in our format that is damaged, When it is pasted, Then it is treated as the words it comes with, and nothing breaks', async () => {
  const store = createTestStore();
  await openWith(store, 1);
  const data = new DataTransfer();
  data.setData(ELEMENTS_MIME, '{"format":"cue-elements","version":1,"elements":[{"id":"x"}]}');
  data.setData('text/plain', 'Fallback words');

  pasteEvent(data);

  await expect.poll(async () => (await stored(store)).length).toBe(1);
  const [box] = await stored(store);
  expect(box && isTextBox(box) && box.doc.content.length).toBe(1);
});

test('Given nothing on the clipboard, When Paste is pressed, Then nothing happens', async () => {
  const store = createTestStore();
  await openWith(store, 1);

  pasteEvent(new DataTransfer());
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect((await stored(store)).length).toBe(0);
});

test('Given a text box being edited, When copy and paste are used, Then the editor handles them, not the element commands', async () => {
  const store = createTestStore();
  await openWith(store, 1, words('t', 100, 200), rectangle('a', 800, 200));
  const target = node('t');
  if (!target) throw new Error('no text box');
  await userEvent.dblClick(target);
  await expect
    .poll(() => document.querySelector('.text-edit-box .ProseMirror'), { timeout: 5000 })
    .not.toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 300));

  const data = copyEvent();

  // The editor, not the element commands, handled the event: no element format was written.
  expect(data.getData(ELEMENTS_MIME)).toBe('');
});

// The context menu

test('Given an element, When it is right-clicked, Then the menu offers cut, copy, paste, duplicate and delete before arrange, and Paste waits for something copied', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rectangle('a', 100, 100));
  const target = node('a');
  if (!target) throw new Error('no shape');

  await userEvent.click(target);
  rightClick(target);

  await expect.element(screen.getByRole('menu', { name: 'Element actions' })).toBeVisible();
  const labels = [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent);
  expect(labels.slice(0, 5)).toEqual([
    'CutCtrl+X',
    'CopyCtrl+C',
    'PasteCtrl+V',
    'DuplicateCtrl+D',
    'DeleteDel',
  ]);
  await expect.element(screen.getByRole('menuitem', { name: /^Paste/ })).toBeDisabled();
});

test('Given the menu, When Duplicate is chosen, Then a copy appears at once', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rectangle('a', 100, 100));
  const target = node('a');
  if (!target) throw new Error('no shape');
  await userEvent.click(target);
  rightClick(target);

  await screen.getByRole('menuitem', { name: /^Duplicate/ }).click();

  await expect.poll(async () => (await stored(store)).length).toBe(2);
});

test('Given the menu, When Copy and then Paste are chosen, Then the copy is pasted', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rectangle('a', 100, 100));
  const target = node('a');
  if (!target) throw new Error('no shape');
  await userEvent.click(target);
  const open = () => {
    rightClick(target);
  };
  open();
  await screen.getByRole('menuitem', { name: /^Copy/ }).click();
  open();

  await screen.getByRole('menuitem', { name: /^Paste/ }).click();

  await expect.poll(async () => (await stored(store)).length).toBe(2);
});

test('Given the menu, When Delete is chosen, Then the element is removed', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1, rectangle('a', 100, 100), ellipse('b', 500, 100));
  const target = node('a');
  if (!target) throw new Error('no shape');
  await userEvent.click(target);
  rightClick(target);

  await screen.getByRole('menuitem', { name: /^Delete/ }).click();

  await expect.poll(async () => (await stored(store)).map((e) => e.id)).toEqual(['b']);
});
