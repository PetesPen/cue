import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Block, Inline, RichText, TextMark } from '@/model';
import { createTestStore } from './test-helpers';
import {
  edit,
  editor,
  elementNode,
  must,
  openWith,
  resetEditorTest,
  selectAll,
  stored,
  textBox,
  toolbarButton,
} from './text-test-helpers';

afterEach(resetEditorTest);

// EL-1 (spike SP-2): text is drawn by the editor while it is edited and by our own static renderer
// everywhere else (thumbnails, the presenter, the export). Lines must break in the same places, so
// the words do not move when editing starts or ends. These compare where every piece of text sits.

const run = (text: string, ...marks: TextMark[]): Inline =>
  marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
const para = (attrs: object | undefined, ...content: Inline[]): Block => ({
  type: 'paragraph',
  ...(attrs ? { attrs } : {}),
  content,
});
const style = (fontFamily?: string, fontSize?: number, color?: string): TextMark => ({
  type: 'textStyle',
  attrs: {
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(color ? { color } : {}),
  },
});
const doc = (...content: Block[]): RichText => ({ type: 'doc', content });

const LONG =
  'The quick brown fox jumps over the lazy dog while the autumn launch plan comes together, and every sentence runs on long enough to wrap onto several lines of the box.';

const SAMPLES: [string, RichText][] = [
  ['one long paragraph in the default font', doc(para(undefined, run(LONG)))],
  [
    'bold and italic words inside a wrapped paragraph',
    doc(
      para(
        undefined,
        run('Plain words and '),
        run('bold words that go on a while', { type: 'bold' }),
        run(' then '),
        run('italic words that also wrap around', { type: 'italic' }),
        run(' and an ending that is long enough to need another line to finish.'),
      ),
    ),
  ],
  [
    'sizes and fonts mixed on one line',
    doc(
      para(
        undefined,
        run('Big ', style('Figtree', 96)),
        run('small ', style(undefined, 28)),
        run('serif ', style('DM Serif Display', 64)),
        run('hand written words that wrap', style('Caveat', 72)),
        run(' mono text here', style('JetBrains Mono', 40)),
      ),
    ),
  ],
  [
    'centred, right aligned and widely spaced paragraphs',
    doc(
      para({ align: 'center', lineHeight: 1.6 }, run(LONG)),
      para({ align: 'right' }, run('Right aligned words that wrap onto a second line as well.')),
      para(
        { indent: 2 },
        run('An indented paragraph that is long enough to wrap onto another line.'),
      ),
    ),
  ],
  [
    'a soft return, a final soft return and an empty paragraph',
    doc(
      para(undefined, run('First line'), { type: 'hardBreak' }, run('after the return')),
      para(undefined),
      para(undefined, run('Ends with a soft return'), { type: 'hardBreak' }),
    ),
  ],
  [
    'bullet and numbered lists with a nested list',
    doc(
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [para(undefined, run('One ' + LONG.slice(0, 60)))] },
          {
            type: 'listItem',
            content: [
              para(undefined, run('Two')),
              {
                type: 'orderedList',
                content: [{ type: 'listItem', content: [para(undefined, run('Nested'))] }],
              },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [para(undefined, run('First numbered'))] },
          { type: 'listItem', content: [para(undefined, run('Second numbered'))] },
        ],
      },
    ),
  ],
  [
    'underlined, struck and coloured words',
    doc(
      para(
        undefined,
        run('Underlined words ', { type: 'underline' }),
        run('struck words ', { type: 'strike' }),
        run('coloured words that run on', style(undefined, undefined, '#17803F')),
        run(' and then more plain text to fill the line ' + LONG.slice(0, 50)),
      ),
    ),
  ],
];

type Rect = readonly [number, number, number, number];

/** Where each piece of text sits, relative to its container, in slide pixels (to 0.01). */
function textRects(root: HTMLElement, scale: number): Rect[][] {
  const base = root.getBoundingClientRect();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Rect[][] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node.textContent ?? '').trim() === '') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    out.push(
      [...range.getClientRects()].map((r): Rect => [
        Math.round(((r.left - base.left) / scale) * 100) / 100,
        Math.round(((r.top - base.top) / scale) * 100) / 100,
        Math.round((r.width / scale) * 100) / 100,
        Math.round((r.height / scale) * 100) / 100,
      ]),
    );
  }
  return out;
}

const slideScale = () => {
  const frame = document.querySelector<HTMLElement>('.slide-frame');
  return (frame?.getBoundingClientRect().width ?? 1920) / 1920;
};

test.each(SAMPLES)(
  'Given %s, When it is edited and when it is drawn, Then every piece of text sits in the same place',
  async (_name, sample) => {
    const store = createTestStore();
    await openWith(store, textBox('t', sample));
    // Wait for the drawn text to be shown (its fonts have loaded).
    await expect.poll(() => elementNode('t')?.dataset.fonts, { timeout: 5000 }).toBeUndefined();
    const drawn = must('t').querySelector<HTMLElement>('.cue-text');
    if (!drawn) throw new Error('the text is not drawn');
    const scale = slideScale();
    const drawnRects = textRects(drawn, scale);
    const drawnHeight = drawn.getBoundingClientRect().height / scale;

    await edit('t');
    const live = editor();
    if (!live) throw new Error('the editor is not open');
    await expect.poll(() => document.fonts.status, { timeout: 5000 }).toBe('loaded');
    const editedRects = textRects(live, scale);
    const editedHeight = live.getBoundingClientRect().height / scale;

    expect(editedRects).toEqual(drawnRects);
    expect(editedHeight).toBeCloseTo(drawnHeight, 1);
  },
);

test('Given a text box, When it is drawn and the box height is kept, Then the saved height is what the text needs', async () => {
  const store = createTestStore();
  await openWith(store, textBox('t', doc(para(undefined, run(LONG)))));
  await edit('t');

  await userEvent.keyboard('{Control>}{End}{/Control} More words.{Escape}');

  await expect.poll(async () => (await stored(store))?.[0]?.height).toBeGreaterThan(100);
  const saved = (await stored(store))?.[0]?.height ?? 0;
  const box = must('t').getBoundingClientRect().height / slideScale();
  expect(Math.abs(box - saved)).toBeLessThan(1);
});

// EL-1: box fill, border and padding

test('Given a text box, When a fill, a border and padding are set in the Design panel, Then the box shows them and the text keeps clear of the edge', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Padded words'));
  await userEvent.click(must('t'));

  await screen.getByRole('textbox', { name: 'Padding' }).fill('40');
  await userEvent.keyboard('{Enter}');
  await screen.getByRole('textbox', { name: 'Border width' }).fill('6');
  await userEvent.keyboard('{Enter}');
  await screen.getByRole('textbox', { name: 'Fill as hex' }).fill('e8f0e4');
  await userEvent.keyboard('{Enter}');

  await expect.poll(() => must('t').style.padding).toBe('40px');
  await expect.poll(() => must('t').style.border).toContain('6px');
  await expect.poll(() => must('t').style.background).toContain('rgb(232, 240, 228)');
  const box = must('t').getBoundingClientRect();
  const words = must('t').querySelector('.cue-text p')?.getBoundingClientRect();
  if (!words) throw new Error('the words are not drawn');
  // The words begin one padding and one border in from the edge: (40 + 6) slide pixels.
  expect((words.left - box.left) / slideScale()).toBeCloseTo(46, 0);
  expect((words.top - box.top) / slideScale()).toBeCloseTo(46, 0);
  // The box is taller by the padding and border on both sides.
  await expect
    .poll(async () => (await stored(store))?.[0]?.height)
    .toBe(Math.ceil(56 * 1.2) + 2 * 46);
});

// EL-1: paragraph options

test('Given words being edited, When alignment, a list, an indent and line spacing are chosen in the panel, Then they apply to the paragraphs touched', async () => {
  const store = createTestStore();
  const screen = await openWith(
    store,
    textBox('t', doc(para(undefined, run('One')), para(undefined, run('Two')))),
  );
  await edit('t');
  await selectAll();
  const panel = screen.getByRole('group', { name: 'Paragraph' });

  await panel.getByRole('button', { name: 'Align centre' }).click();
  await screen.getByRole('textbox', { name: 'Line spacing' }).fill('2');
  await userEvent.keyboard('{Enter}');

  const paragraphs = () => [...(editor()?.querySelectorAll('p') ?? [])];
  await expect.poll(() => paragraphs().map((p) => p.style.textAlign)).toEqual(['center', 'center']);
  expect(paragraphs().map((p) => p.style.lineHeight)).toEqual(['2', '2']);

  await panel.getByRole('button', { name: 'Bulleted list' }).click();
  await expect.poll(() => editor()?.querySelectorAll('ul > li').length).toBe(2);
  await panel.getByRole('button', { name: 'Numbered list' }).click();
  await expect.poll(() => editor()?.querySelectorAll('ol > li').length).toBe(2);
  await panel.getByRole('button', { name: 'Numbered list' }).click();
  await expect.poll(() => editor()?.querySelectorAll('li').length).toBe(0);

  await panel.getByRole('button', { name: 'Indent more' }).click();
  await expect.poll(() => paragraphs().map((p) => p.style.marginLeft)).toEqual(['48px', '48px']);
  await panel.getByRole('button', { name: 'Indent less' }).click();
  await expect.poll(() => paragraphs().map((p) => p.style.marginLeft)).toEqual(['', '']);
});

test('Given a text box not being edited, When alignment, a list and an indent are chosen in the panel, Then all its paragraphs change and the box refits', async () => {
  const store = createTestStore();
  const screen = await openWith(
    store,
    textBox('t', doc(para(undefined, run('One')), para(undefined, run('Two')))),
  );
  await userEvent.click(must('t'));
  const panel = screen.getByRole('group', { name: 'Paragraph' });

  await panel.getByRole('button', { name: 'Align right' }).click();
  await panel.getByRole('button', { name: 'Indent more' }).click();
  await panel.getByRole('button', { name: 'Bulleted list' }).click();

  await expect.poll(() => must('t').querySelectorAll('ul > li').length).toBe(2);
  await expect
    .poll(async () => JSON.stringify((await stored(store))?.[0]))
    .toMatch(/"bulletList".*"align":"right"/);
});

test('Given words selected, When a bold style the font has is pressed, Then the button shows it is on, and pressing again turns it off', async () => {
  const store = createTestStore();
  const screen = await openWith(store, textBox('t', 'Our approach'));
  await edit('t');
  await selectAll();

  await toolbarButton(screen, 'Bold').click();
  await expect.element(toolbarButton(screen, 'Bold')).toHaveAttribute('aria-pressed', 'true');
  await toolbarButton(screen, 'Bold').click();

  await expect.element(toolbarButton(screen, 'Bold')).toHaveAttribute('aria-pressed', 'false');
});
