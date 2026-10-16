import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createShape, isShape, plainText, textFromString, textRuns } from '@/model';
import { createTestStore } from './test-helpers';
import {
  edit,
  editor,
  elementNode,
  must,
  openWith,
  resetEditorTest,
  selectFirst,
  stored,
  storedText,
  textBox,
  toolbarButton,
} from './text-test-helpers';

afterEach(resetEditorTest);

// EL-1: adding and editing text in place

test('Given a text box, When it is double-clicked, Then it is edited in place over the same words, with a toolbar', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));

  await edit('t');

  expect(editor()?.textContent).toBe('Our approach');
  await expect.element(screen.getByRole('toolbar', { name: 'Text formatting' })).toBeVisible();
  expect(document.activeElement).toBe(editor());
  // The drawn copy of the words steps aside, so there are never two sets of words on screen.
  expect(elementNode('t')?.querySelector('.cue-text')?.textContent).toBe('');
});

test('Given a text box being edited, When Escape is pressed, Then editing ends and the words are drawn again', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Our approach'));
  await edit('t');

  await userEvent.keyboard('{Escape}');

  await expect.poll(editor).toBeNull();
  expect(elementNode('t')?.querySelector('.cue-text')?.textContent).toBe('Our approach');
  expect(document.querySelector('.sel-box')).not.toBeNull();
  expect(document.querySelector('.slide-frame')?.contains(document.activeElement)).toBe(true);
});

test('Given a selected text box, When Enter is pressed, Then it is edited with the cursor at the end', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Our'));
  await userEvent.click(must('t'));

  await userEvent.keyboard('{Enter}');
  await expect.poll(editor, { timeout: 5000 }).not.toBeNull();
  await userEvent.keyboard(' approach');

  expect(editor()?.textContent).toBe('Our approach');
});

test('Given a text box being edited, When words are typed and Escape pressed, Then the words are saved in the deck', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Our'));
  await edit('t');

  await userEvent.keyboard('{End} approach{Escape}');

  await expect
    .poll(async () => plainText((await storedText(store)) ?? textFromString('')))
    .toBe('Our approach');
});

test('Given words typed, When the typing pauses, Then they are saved without leaving the box', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Our'));
  await edit('t');

  await userEvent.keyboard('{End} approach');

  await expect
    .poll(async () => plainText((await storedText(store)) ?? textFromString('')), { timeout: 4000 })
    .toBe('Our approach');
  expect(editor()).not.toBeNull();
});

test('Given a text box, When more text than one line holds is typed, Then the box grows in height with its text', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'One line'));
  const before = (await stored(store))?.[0]?.height ?? 0;
  await edit('t');

  await userEvent.keyboard('{End}{Enter}Second{Enter}Third{Escape}');

  await expect
    .poll(async () => (await stored(store))?.[0]?.height ?? 0, { timeout: 4000 })
    .toBeGreaterThan(before * 2.5);
  expect(elementNode('t')?.style.height).toBe(`${String((await stored(store))?.[0]?.height)}px`);
});

test('Given a text box emptied of its words, When editing ends, Then the empty box is removed', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', 'Gone'));
  await edit('t');

  await userEvent.keyboard('{Control>}a{/Control}{Backspace}{Escape}');

  await expect.poll(async () => (await stored(store))?.length).toBe(0);
  expect(elementNode('t')).toBeNull();
});

test('Given a shape, When Enter is pressed, Then its text is edited, centred in the shape', async () => {
  const store = createTestStore();
  await openWith(store, createShape('s', 'ellipse', { x: 200, y: 200, width: 600, height: 300 }));
  await userEvent.click(must('s'));

  await userEvent.keyboard('{Enter}');
  await expect.poll(editor, { timeout: 5000 }).not.toBeNull();
  await userEvent.keyboard('Centre{Escape}');

  await expect
    .poll(async () => plainText((await storedText(store)) ?? textFromString('')))
    .toBe('Centre');
  const shapeBox = elementNode('s')?.getBoundingClientRect();
  const words = elementNode('s')?.querySelector('.cue-text p')?.getBoundingClientRect();
  if (!shapeBox || !words) throw new Error('the shape or its words are not drawn');
  expect(words.left + words.width / 2).toBeCloseTo(shapeBox.left + shapeBox.width / 2, 0);
});

test('Given a shape whose text is emptied, When editing ends, Then the shape keeps no text at all', async () => {
  const store = createTestStore();
  const shape = {
    ...createShape('s', 'rectangle', { x: 200, y: 200, width: 600, height: 300 }),
    text: textFromString('Old'),
  };
  await openWith(store, shape);
  await edit('s');

  await userEvent.keyboard('{Control>}a{/Control}{Backspace}{Escape}');

  await expect
    .poll(async () => {
      const element = (await stored(store))?.[0];
      return element && isShape(element) ? element.text : 'not a shape';
    })
    .toBeUndefined();
});

// EL-1: formatting parts of the text

test('Given words selected in a box, When Bold is pressed, Then only those words are bold and the rest stay as they were', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await selectFirst(3);

  await toolbarButton(screen, 'Bold').click();
  await userEvent.keyboard('{Escape}');

  await expect
    .poll(async () =>
      textRuns((await storedText(store)) ?? textFromString('')).map((r) => [
        r.text,
        r.marks?.map((m) => m.type) ?? [],
      ]),
    )
    .toEqual([
      ['Our', ['bold']],
      [' approach', []],
    ]);
});

test('Given the toolbar, When a button is pressed, Then the words stay selected and the text keeps focus', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await selectFirst(3);

  await toolbarButton(screen, 'Italic').click();

  expect(document.activeElement).toBe(editor());
  expect(window.getSelection()?.toString()).toBe('Our');
  await expect.element(toolbarButton(screen, 'Italic')).toHaveAttribute('aria-pressed', 'true');
});

test('Given a font size typed in the toolbar, When Enter is pressed, Then the selected words have that size', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await selectFirst(3);

  const size = screen
    .getByRole('toolbar', { name: 'Text formatting' })
    .getByRole('textbox', { name: 'Font size' });
  await size.fill('90');
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{Escape}');

  await expect
    .poll(async () =>
      textRuns((await storedText(store)) ?? textFromString('')).map((r) =>
        r.marks?.find((m) => m.type === 'textStyle'),
      ),
    )
    .toEqual([{ type: 'textStyle', attrs: { fontSize: 90 } }, undefined]);
});

test('Given a text box not being edited, When Bold is pressed in the Design panel, Then all of its words are bold', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await userEvent.click(must('t'));

  await screen
    .getByRole('group', { name: 'Text style' })
    .getByRole('button', { name: 'Bold' })
    .click();

  await expect
    .poll(async () =>
      textRuns((await storedText(store)) ?? textFromString('')).map((r) =>
        r.marks?.map((m) => m.type),
      ),
    )
    .toEqual([['bold']]);
});

test('Given a text box, When its size is changed in the panel, Then the box grows to fit the larger words', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await userEvent.click(must('t'));

  await screen.getByRole('textbox', { name: 'Font size' }).fill('120');
  await userEvent.keyboard('{Enter}');

  // One line of 120 px text at the usual line spacing of 1.2 is 144 px tall.
  await expect.poll(async () => (await stored(store))?.[0]?.height).toBe(144);
});
