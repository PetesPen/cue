import { afterEach, describe, expect, test } from 'vitest';
import {
  createShape,
  createSlide,
  createText,
  textFromString,
  type Block,
  type RichText,
  type ShapeElement,
  type Slide,
  type TextElement,
  type TextMark,
} from '@/model';
import { createSlideRenderer, type SlideRenderer } from './slide';
import { createTextBody, ensureFonts, measureTextHeight, renderText } from './text';

const hosts: HTMLElement[] = [];
const renderers: SlideRenderer[] = [];

function draw(slide: Slide, width = 960) {
  const host = document.createElement('div');
  host.style.width = `${String(width)}px`;
  document.body.append(host);
  hosts.push(host);
  const renderer = createSlideRenderer(host, slide);
  renderers.push(renderer);
  return { host, renderer };
}

afterEach(() => {
  while (renderers.length > 0) renderers.pop()?.destroy();
  while (hosts.length > 0) hosts.pop()?.remove();
});

const doc = (...content: Block[]): RichText => ({ type: 'doc', content });
const run = (text: string, marks?: TextMark[]) =>
  marks ? ({ type: 'text', text, marks } as const) : ({ type: 'text', text } as const);
const slideWith = (...elements: (ShapeElement | TextElement)[]): Slide => ({
  ...createSlide('s1'),
  elements,
});
const html = (doc_: RichText) => {
  const body = document.createElement('div');
  renderText(body, doc_);
  return body.innerHTML;
};

describe("renderText follows the editor's structure (EL-1, SP-2 rule 1)", () => {
  test('Given marks, When text is drawn, Then each is its own tag and the style is a span with inline font, size and colour', () => {
    const output = html(
      doc({
        type: 'paragraph',
        content: [
          run('plain '),
          run('bold', [{ type: 'bold' }]),
          run('x', [
            { type: 'italic' },
            { type: 'underline' },
            { type: 'strike' },
            { type: 'textStyle', attrs: { fontFamily: 'Figtree', fontSize: 72, color: '#17803F' } },
          ]),
        ],
      }),
    );

    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>');
    expect(output).toContain('<u>');
    expect(output).toContain('<s>');
    expect(output).toMatch(
      /<span style="[^"]*font-family: Figtree[^"]*font-size: 72px[^"]*color: rgb\(23, 128, 63\)/,
    );
  });

  test('Given paragraph options, When text is drawn, Then alignment, line spacing and indent are on the paragraph', () => {
    const output = html(
      doc({
        type: 'paragraph',
        attrs: { align: 'center', lineHeight: 1.5, indent: 2 },
        content: [run('a')],
      }),
    );

    expect(output).toContain('text-align: center');
    expect(output).toContain('line-height: 1.5');
    expect(output).toContain('margin-left: 96px');
  });

  test('Given a bulleted and a numbered list, When text is drawn, Then they are ul and ol with li and p inside, and a numbered list keeps its start', () => {
    const output = html(
      doc(
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [run('one')] }] }],
        },
        {
          type: 'orderedList',
          attrs: { start: 4 },
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [run('four')] }] }],
        },
      ),
    );

    expect(output).toContain('<ul><li><p>one</p></li></ul>');
    expect(output).toContain('<ol start="4"><li><p>four</p></li></ol>');
  });

  test('Given an empty paragraph and a paragraph ending in a soft return, When text is drawn, Then each has the break the editor adds (SP-2 rule 4)', () => {
    const output = html(
      doc({ type: 'paragraph' }, { type: 'paragraph', content: [run('a'), { type: 'hardBreak' }] }),
    );

    expect(output).toBe('<p><br></p><p>a<br><br></p>');
  });

  test('Given text typed as plain lines, When it is drawn, Then each line is a paragraph', () => {
    expect(html(textFromString('one\ntwo'))).toBe('<p>one</p><p>two</p>');
  });
});

describe('text boxes on a slide (EL-1)', () => {
  const box = (extra: Partial<TextElement> = {}): TextElement => ({
    ...createText('t', { x: 200, y: 100, width: 800, height: 120 }, textFromString('Our approach')),
    ...extra,
  });
  const node = (host: HTMLElement, id = 't') =>
    host.querySelector<HTMLElement>(`[data-element-id="${id}"]`);

  test('Given a text box, When it is drawn at half size, Then it sits where its box says and shows its words', async () => {
    const { host } = draw(slideWith(box()));
    await ensureFonts(textFromString('Our approach'));

    const rect = node(host)?.getBoundingClientRect();
    const surface = host.querySelector('.cue-slide')?.getBoundingClientRect();
    expect(rect?.x).toBeCloseTo((surface?.x ?? 0) + 100, 1);
    expect(rect?.y).toBeCloseTo((surface?.y ?? 0) + 50, 1);
    expect(rect?.width).toBeCloseTo(400, 1);
    expect(node(host)?.textContent).toBe('Our approach');
    expect(node(host)?.dataset.kind).toBe('text');
  });

  test('Given a fill, a border and padding, When the box is drawn, Then the element carries them and the text keeps clear of the edge', async () => {
    const { host } = draw(
      slideWith(
        box({
          fill: '#FFF6D6',
          padding: 24,
          border: { color: '#14281B', width: 4, dash: 'dashed' },
        }),
      ),
    );
    await ensureFonts(textFromString('Our approach'));

    const style = node(host)?.style;
    expect(style?.background).toBe('rgb(255, 246, 214)');
    expect(style?.padding).toBe('24px');
    expect(style?.border).toContain('dashed');
    const text = node(host)?.querySelector('.cue-text p')?.getBoundingClientRect();
    const outer = node(host)?.getBoundingClientRect();
    // (24 + 4) slide px, at half size, is 14 screen px.
    expect((text?.x ?? 0) - (outer?.x ?? 0)).toBeCloseTo(14, 0);
  });

  test('Given a box with fill and text at 50%, When it is drawn, Then the whole box is 50% (fill and text together)', () => {
    const { host } = draw(slideWith(box({ fill: '#FFF6D6', opacity: 0.5 })));

    expect(node(host)?.style.opacity).toBe('0.5');
    expect(node(host)?.querySelector('.cue-text')?.hasAttribute('style')).toBe(true);
    expect(node(host)?.querySelector('p')?.style.opacity).toBe('');
  });

  test('Given a new text, When it is drawn, Then it is held back until its fonts have loaded, then shown', async () => {
    const { host, renderer } = draw(slideWith(box()));
    const word = (family: string) =>
      doc({
        type: 'paragraph',
        content: [run('Hi', [{ type: 'textStyle', attrs: { fontFamily: family } }])],
      });

    renderer.update(slideWith(box({ doc: word('Caveat') })));

    expect(node(host)?.dataset.fonts).toBe('loading');
    expect(getComputedStyle(node(host)?.querySelector('.cue-text') ?? host).visibility).toBe(
      'hidden',
    );
    await expect.poll(() => node(host)?.dataset.fonts, { timeout: 5000 }).toBeUndefined();
    expect(getComputedStyle(node(host)?.querySelector('.cue-text') ?? host).visibility).toBe(
      'visible',
    );
  });

  test('Given an update that changes the text, When it is drawn, Then an old font load does not unhide the new text early', async () => {
    const { host, renderer } = draw(slideWith(box()));

    renderer.update(slideWith(box({ doc: textFromString('one') })));
    renderer.update(slideWith(box({ doc: textFromString('two') })));
    await expect.poll(() => node(host)?.dataset.fonts, { timeout: 5000 }).toBeUndefined();

    expect(node(host)?.textContent).toBe('two');
  });

  test('Given a box being edited, When the slide is drawn with it hidden, Then it keeps its place but is not shown', () => {
    const { host, renderer } = draw(slideWith(box()));

    renderer.update(slideWith(box()), new Set(['t']));

    expect(node(host)?.style.visibility).toBe('hidden');
    renderer.update(slideWith(box()));
    expect(node(host)?.style.visibility).toBe('');
  });
});

describe('text inside a shape (carried from EL-3)', () => {
  const ellipse = (text?: RichText): ShapeElement => ({
    ...createShape('e', 'ellipse', { x: 200, y: 200, width: 600, height: 400 }),
    ...(text ? { text } : {}),
  });

  test('Given a shape with text, When it is drawn, Then the text is centred in the shape by default', async () => {
    const { host } = draw(slideWith(ellipse(textFromString('Centred'))));
    await ensureFonts(textFromString('Centred'));

    const shape = host.querySelector('[data-element-id="e"]')?.getBoundingClientRect();
    const text = host.querySelector('.cue-shape-text p')?.getBoundingClientRect();
    const textRange = document.createRange();
    const textNode = host.querySelector('.cue-shape-text p')?.firstChild;
    if (textNode) textRange.selectNodeContents(textNode);
    const words = textRange.getBoundingClientRect();
    expect(words.x + words.width / 2).toBeCloseTo((shape?.x ?? 0) + (shape?.width ?? 0) / 2, 0);
    expect(words.y + words.height / 2).toBeCloseTo((shape?.y ?? 0) + (shape?.height ?? 0) / 2, 0);
    expect(text?.width).toBeGreaterThan(0);
  });

  test('Given a shape whose text is taken away, When it is drawn again, Then the text part is gone', () => {
    const { host, renderer } = draw(slideWith(ellipse(textFromString('Hello'))));
    expect(host.querySelector('.cue-shape-text')).not.toBeNull();

    renderer.update(slideWith(ellipse()));

    expect(host.querySelector('.cue-shape-text')).toBeNull();
  });

  test('Given a shape with text at 40%, When it is drawn, Then the text fades with the shape (TR-1)', () => {
    const faded = { ...ellipse(textFromString('Hello')), opacity: 0.4 };
    const { host } = draw(slideWith(faded));

    expect(host.querySelector<HTMLElement>('[data-element-id="e"]')?.style.opacity).toBe('0.4');
    expect(host.querySelector<HTMLElement>('.cue-shape-text')?.style.opacity).toBe('');
  });
});

describe('measureTextHeight (a text box is as tall as its text)', () => {
  const sized = (text: string, extra: Partial<TextElement> = {}): TextElement => ({
    ...createText('m', { x: 0, y: 0, width: 800 }, textFromString(text)),
    ...extra,
  });

  test('Given one line at the default size, When it is measured, Then it is one line high: 56 px at 1.2', async () => {
    const element = sized('One line');
    await ensureFonts(element.doc);

    expect(measureTextHeight(element)).toBeGreaterThanOrEqual(67);
    expect(measureTextHeight(element)).toBeLessThanOrEqual(68);
  });

  test('Given three paragraphs, When they are measured, Then it is three lines high', async () => {
    const one = sized('a');
    const three = sized('a\nb\nc');
    await ensureFonts(three.doc);

    // A line is 67.2 px (56 x 1.2); heights are rounded up to whole pixels.
    expect(measureTextHeight(three)).toBeGreaterThanOrEqual(3 * 67);
    expect(measureTextHeight(three)).toBeLessThanOrEqual(3 * measureTextHeight(one));
  });

  test('Given padding and a border, When the box is measured, Then both are added on every side', async () => {
    const plain = sized('a');
    const boxed = sized('a', {
      padding: 20,
      border: { color: '#000000', width: 5, dash: 'solid' },
    });
    await ensureFonts(plain.doc);

    expect(measureTextHeight(boxed)).toBe(measureTextHeight(plain) + 2 * 20 + 2 * 5);
  });

  test('Given long text, When the box is made narrower, Then it wraps onto more lines and is taller', async () => {
    const words = 'Our approach is to listen first, ship in small steps and measure what matters';
    const wide = sized(words, { width: 1600 });
    const narrow = sized(words, { width: 400 });
    await ensureFonts(wide.doc);

    expect(measureTextHeight(narrow)).toBeGreaterThan(measureTextHeight(wide) * 2);
  });

  test('Given a bigger font size, When the box is measured, Then it is taller in proportion', async () => {
    const big = sized('a');
    const bigger: TextElement = {
      ...big,
      doc: doc({
        type: 'paragraph',
        content: [run('a', [{ type: 'textStyle', attrs: { fontSize: 112 } }])],
      }),
    };
    await ensureFonts(big.doc);

    expect(measureTextHeight(bigger)).toBeGreaterThanOrEqual(2 * measureTextHeight(big) - 2);
  });

  test('Given measuring, When it is done, Then nothing is left in the page', async () => {
    const element = sized('a');
    await ensureFonts(element.doc);

    measureTextHeight(element);

    expect(document.querySelector('.cue-measure-holder')?.childElementCount).toBe(0);
  });
});

describe('ensureFonts and the default body', () => {
  test('Given text in Caveat, When its fonts are ensured, Then the browser reports them loaded', async () => {
    const caveat = doc({
      type: 'paragraph',
      content: [run('Hi', [{ type: 'textStyle', attrs: { fontFamily: 'Caveat' } }])],
    });

    await ensureFonts(caveat);

    expect(document.fonts.check('400 16px "Caveat"')).toBe(true);
  });

  test('Given a new text body, When it is made, Then it has the default font, size, colour and line spacing', () => {
    const body = createTextBody();

    expect(body.style.fontSize).toBe('56px');
    expect(body.style.fontFamily).toContain('Instrument Sans');
    expect(body.style.lineHeight).toBe('1.2');
    expect(body.className).toBe('cue-text');
  });
});
