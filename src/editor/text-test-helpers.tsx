import { expect, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import {
  createText,
  isTextBox,
  textFromString,
  type Deck,
  type RichText,
  type SlideElement,
  type TextElement,
} from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, deckWithSlides } from './test-helpers';

/** Shared by the editor's text component tests. Not part of the app. */

/** Call this from each test file's `afterEach`. */
export function resetEditorTest(): void {
  closeTestStores();
  vi.restoreAllMocks();
  window.location.hash = '';
}

/** A text box at x, y, 800 wide, with this text. */
export const textBox = (id: string, text: string | RichText, x = 200, y = 200): TextElement =>
  createText(id, { x, y, width: 800 }, typeof text === 'string' ? textFromString(text) : text);

/** Open a deck whose first slide holds these elements, in the editor. */
export async function openWith(store: DeckStore, ...elements: SlideElement[]) {
  const base = deckWithSlides(1);
  const deck: Deck = { ...base, slides: base.slides.map((slide) => ({ ...slide, elements })) };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  return screen;
}

export type Screen = Awaited<ReturnType<typeof openWith>>;

export const stored = async (store: DeckStore) => (await store.load('deck'))?.slides[0]?.elements;

export const storedText = async (store: DeckStore, index = 0): Promise<RichText | undefined> => {
  const element = (await stored(store))?.[index];
  if (!element) return undefined;
  return isTextBox(element) ? element.doc : element.text;
};

export const elementNode = (id: string) =>
  document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);

/** The drawn element, which a test cannot go on without. */
export function must(id: string): HTMLElement {
  const node = elementNode(id);
  if (!node) throw new Error(`no ${id}`);
  return node;
}

export const editor = () => document.querySelector<HTMLElement>('.text-edit-box .ProseMirror');

/**
 * Double-click an element to edit its text, and wait for the editor (it loads on first use). Then wait
 * a moment more: for about 50 ms after it puts the cursor in place, ProseMirror puts back any cursor
 * movement it did not make itself, and keys pressed in that moment would seem to do nothing. No one
 * presses a key that fast; a test does.
 */
export async function edit(id: string) {
  await userEvent.dblClick(must(id));
  await expect.poll(editor, { timeout: 5000 }).not.toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** Select the first `count` characters of the text being edited. */
export async function selectFirst(count: number) {
  await userEvent.keyboard(
    `{Control>}{Home}{/Control}{Shift>}${'{ArrowRight}'.repeat(count)}{/Shift}`,
  );
}

/** Select all the text being edited. */
export async function selectAll() {
  await userEvent.keyboard('{Control>}a{/Control}');
}

export const toolbar = (screen: Screen) => screen.getByRole('toolbar', { name: 'Text formatting' });

export const toolbarButton = (screen: Screen, name: string) =>
  toolbar(screen).getByRole('button', { name, exact: true });
