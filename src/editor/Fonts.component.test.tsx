import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { FONTS, textRuns, type RichText, type TextMark } from '@/model';
import { createTestStore } from './test-helpers';
import {
  edit,
  editor,
  must,
  openWith,
  resetEditorTest,
  selectAll,
  selectFirst,
  storedText,
  textBox,
  toolbar,
  toolbarButton,
} from './text-test-helpers';

afterEach(resetEditorTest);

/** A paragraph of this text in this font, with these other marks. */
const inFont = (
  family: string,
  text = 'Our approach',
  marks: TextMark[] = [],
): RichText['content'][number] => ({
  type: 'paragraph',
  content: [
    {
      type: 'text',
      text,
      marks: [...marks, { type: 'textStyle', attrs: { fontFamily: family } }],
    },
  ],
});
const doc = (...content: RichText['content'][number][]): RichText => ({ type: 'doc', content });

const fontButton = (screen: Awaited<ReturnType<typeof openWith>>) =>
  toolbar(screen).getByRole('button', { name: /^Font:/ });

/** The font the first styled words of the editor are drawn in, without quotes. */
const family = () => editor()?.querySelector('span')?.style.fontFamily.replaceAll('"', '');

/** The marks of every run of the saved text, as plain names. */
const savedMarks = async (store: ReturnType<typeof createTestStore>) =>
  textRuns((await storedText(store)) ?? doc()).map((run) => run.marks?.map((m) => m.type) ?? []);

// EL-2: choosing fonts

test('Given the font picker, When it opens, Then every bundled font is listed in its own typeface with its kind', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');

  await fontButton(screen).click();

  const options = [
    ...document.querySelectorAll<HTMLElement>(
      '[role="listbox"][aria-label="Fonts"] [role="option"]',
    ),
  ];
  expect(options.map((o) => o.querySelector('.font-option-name')?.textContent)).toEqual(
    FONTS.map((f) => f.family),
  );
  for (const [index, font] of FONTS.entries()) {
    expect(
      options[index]
        ?.querySelector<HTMLElement>('.font-option-name')
        ?.style.fontFamily.replaceAll('"', ''),
    ).toBe(font.family);
    expect(options[index]?.querySelector('.font-option-kind')?.textContent).toBe(font.kind);
  }
  await expect.element(screen.getByText('Bundled fonts travel with exported files.')).toBeVisible();
});

test('Given the font picker, When something is typed, Then the list narrows to the names that match', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await fontButton(screen).click();

  await screen.getByRole('combobox', { name: 'Search fonts' }).fill('serif');

  const names = [...document.querySelectorAll('.font-option-name')].map((n) => n.textContent);
  expect(names).toEqual(['DM Serif Display']);
});

test('Given a search with no match, Then the picker says so', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await fontButton(screen).click();

  await screen.getByRole('combobox', { name: 'Search fonts' }).fill('comic');

  await expect.element(screen.getByText('No font matches “comic”.')).toBeVisible();
});

test('Given a deck that uses Caveat, When the picker opens, Then Caveat is listed first under "Fonts in this deck"', async () => {
  const store = createTestStore();
  const screen = await openWith(
    store,
    textBox('t', 'Our approach'),
    textBox('c', doc(inFont('Caveat')), 200, 600),
  );
  await edit('t');

  await fontButton(screen).click();

  const groups = [...document.querySelectorAll('[role="group"][aria-label]')]
    .filter((g) => g.closest('[role="listbox"]'))
    .map((g) => [
      g.getAttribute('aria-label'),
      [...g.querySelectorAll('.font-option-name')].map((n) => n.textContent),
    ]);
  expect(groups[0]).toEqual(['Fonts in this deck', ['Instrument Sans', 'Caveat']]);
  expect(groups[1]?.[0]).toBe('All fonts');
  expect(groups[1]?.[1]).not.toContain('Caveat');
});

test('Given the picker, When Down and Enter are pressed, Then the next font is chosen without the mouse', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await selectAll();
  await fontButton(screen).click();

  await userEvent.keyboard('{ArrowDown}{Enter}');
  await expect.poll(() => family()).toBe('Figtree');
  await userEvent.keyboard('{Escape}');

  await expect
    .poll(async () =>
      textRuns((await storedText(store)) ?? doc()).map((r) =>
        r.marks?.find((m) => m.type === 'textStyle'),
      ),
    )
    .toEqual([{ type: 'textStyle', attrs: { fontFamily: 'Figtree' } }]);
});

test('Given words selected, When a font is chosen, Then only those words have it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await selectFirst(3);

  await fontButton(screen).click();
  await screen.getByRole('option', { name: /^Caveat/ }).click();
  await expect.poll(() => family()).toBe('Caveat');
  await userEvent.keyboard('{Escape}');

  await expect
    .poll(async () =>
      textRuns((await storedText(store)) ?? doc()).map((r) => [
        r.text,
        r.marks?.find((m) => m.type === 'textStyle'),
      ]),
    )
    .toEqual([
      ['Our', { type: 'textStyle', attrs: { fontFamily: 'Caveat' } }],
      [' approach', undefined],
    ]);
});

test('Given a whole box selected but not edited, When a font is chosen in the Design panel, Then all its words have it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await userEvent.click(must('t'));

  await screen.getByRole('button', { name: /^Font:/ }).click();
  await screen.getByRole('option', { name: /^Figtree/ }).click();

  await expect
    .poll(async () =>
      textRuns((await storedText(store)) ?? doc()).map((r) =>
        r.marks?.find((m) => m.type === 'textStyle'),
      ),
    )
    .toEqual([{ type: 'textStyle', attrs: { fontFamily: 'Figtree' } }]);
});

// EL-2 and decision 20: only the styles a font really has

test.each(FONTS)(
  'Given text in $family, When it is edited, Then Bold is offered: $bold, and Italic: $italic',
  async ({ family, bold, italic }) => {
    const store = createTestStore();
    const screen = await openWith(store, textBox('t', doc(inFont(family))));
    await edit('t');
    await selectAll();

    expect(toolbarButton(screen, 'Bold').query() !== null).toBe(bold);
    expect(toolbarButton(screen, 'Italic').query() !== null).toBe(italic);
    // Underline and strikethrough are drawn by the browser, so every font has them.
    await expect.element(toolbarButton(screen, 'Underline')).toBeVisible();
    await expect.element(toolbarButton(screen, 'Strikethrough')).toBeVisible();
  },
);

test('Given a selection across a font with italic and one without, Then the font reads Mixed and Italic is not offered', async () => {
  const store = createTestStore();
  const screen = await openWith(
    store,
    textBox('t', doc(inFont('Figtree', 'One '), inFont('Caveat', 'Two'))),
  );
  await edit('t');
  await selectAll();

  await expect.element(fontButton(screen)).toHaveAccessibleName('Font: Mixed');
  await expect.element(toolbarButton(screen, 'Bold')).toBeVisible();
  expect(toolbarButton(screen, 'Italic').query()).toBeNull();
});

test('Given italic text, When its font is changed to one without italic, Then the italic is taken off', async () => {
  const store = createTestStore();
  const screen = await openWith(
    store,
    textBox('t', doc(inFont('Figtree', 'Slanted', [{ type: 'italic' }]))),
  );
  await edit('t');
  await selectAll();
  expect(editor()?.querySelector('em')).not.toBeNull();

  await fontButton(screen).click();
  await screen.getByRole('option', { name: /^Caveat/ }).click();
  await expect.poll(() => editor()?.querySelector('em')).toBeNull();
  await userEvent.keyboard('{Escape}');

  await expect.poll(() => savedMarks(store)).toEqual([['textStyle']]);
});

test('Given bold text, When its font is changed to DM Serif Display, Then the bold is taken off', async () => {
  const store = createTestStore();
  const screen = await openWith(
    store,
    textBox('t', doc(inFont('Figtree', 'Heavy', [{ type: 'bold' }]))),
  );
  await edit('t');
  await selectAll();

  await fontButton(screen).click();
  await screen.getByRole('option', { name: /^DM Serif Display/ }).click();
  await expect.poll(() => editor()?.querySelector('strong')).toBeNull();
  await userEvent.keyboard('{Escape}');

  await expect.poll(() => savedMarks(store)).toEqual([['textStyle']]);
});

test('Given text in Caveat, When Ctrl+I is pressed, Then nothing slants: the font has no italic', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', doc(inFont('Caveat'))));
  await edit('t');
  await selectAll();

  await userEvent.keyboard('{Control>}i{/Control}');
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(editor()?.querySelector('em')).toBeNull();
});

test('Given text in Caveat, When bold text in Figtree is pasted into it, Then it keeps the bold but not an italic it never had', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', doc(inFont('Caveat'))));
  await edit('t');
  await selectAll();

  const data = new DataTransfer();
  data.setData('text/html', '<span data-cue-font="Caveat"><b><em>Both</em></b></span>');
  editor()?.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(editor()?.querySelector('em')).toBeNull();
  expect(editor()?.querySelector('strong')).not.toBeNull();
});
