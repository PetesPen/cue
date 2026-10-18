// A deck made to be awkward for the renderer (SV-5): every bundled font, mixed bold, italic, underline and
// colours in one line, lists, long lines that wrap, every alignment, line spacing, shapes that are turned,
// transparent or dashed, text inside a shape, layers that overlap, and animation steps at every click. The
// fidelity test draws it in the editor, in the audience window and in the exported web page and compares
// where everything is. Plain data in the stored deck format, like Autumn Launch.

import {
  FOREST,
  GREEN,
  MINT,
  MUTED,
  WHITE,
  YELLOW,
  doc,
  line,
  paragraph,
  shape,
  text,
  transition,
  type Json,
} from './autumnLaunch';
import { fontCapabilities } from '../../src/model';

const FAMILIES = [
  'Instrument Sans',
  'Figtree',
  'Bricolage Grotesque',
  'DM Serif Display',
  'Space Grotesk',
  'JetBrains Mono',
  'Caveat',
] as const;

/** A run of text in a font, with the flags that font has (the model removes the ones it has not). */
function run(
  words: string,
  fontFamily: string,
  fontSize: number,
  color: string,
  flags: readonly string[] = [],
): Json {
  return {
    type: 'text',
    text: words,
    marks: [
      ...flags.map((type) => ({ type })),
      { type: 'textStyle', attrs: { fontFamily, fontSize, color } },
    ],
  };
}

const LONG =
  'The quick brown fox jumps over the lazy dog while the five boxing wizards jump quickly, and Cue sets every line in the same place wherever the slide is shown.';

/** Every font, one line each, with a long line that wraps. */
function fonts(): Json {
  return {
    id: 'a01',
    background: WHITE,
    notes: 'Every bundled font.',
    elements: FAMILIES.map((family, index) =>
      text(
        `a01-${String(index)}`,
        { x: 80 + (index % 2) * 930, y: 60 + Math.floor(index / 2) * 250, width: 880, height: 230 },
        doc(
          paragraph(
            undefined,
            run(`${family}: `, family, 40, GREEN, fontCapabilities(family).bold ? ['bold'] : []),
            run(LONG, family, 34, FOREST),
          ),
        ),
      ),
    ),
    animations: [],
    transition: transition(),
  };
}

/** Mixed formatting, lists, every alignment and line spacing. */
function paragraphs(): Json {
  const mixed = paragraph(
    undefined,
    run('Bold ', 'Instrument Sans', 52, FOREST, ['bold']),
    run('italic ', 'Instrument Sans', 52, GREEN, ['italic']),
    run('underlined ', 'Instrument Sans', 52, MUTED, ['underline']),
    run('struck ', 'Instrument Sans', 52, FOREST, ['strike']),
    run('and big', 'Instrument Sans', 96, FOREST),
    run(' then small again, wrapping onto a second line.', 'Instrument Sans', 40, FOREST),
  );
  const aligned = (align: string, words: string): Json =>
    paragraph(align === '' ? undefined : align, run(words, 'Figtree', 36, FOREST));
  return {
    id: 'a02',
    background: '#F4F8F1',
    notes: '',
    elements: [
      text('a02-mixed', { x: 80, y: 60, width: 1100, height: 330 }, doc(mixed)),
      text(
        'a02-bullets',
        { x: 80, y: 430, width: 560, height: 420 },
        doc({
          type: 'bulletList',
          content: [
            'One thing that is short',
            'A second thing, long enough that it has to wrap onto another line',
            'Third',
          ].map((item) => ({
            type: 'listItem',
            content: [paragraph(undefined, run(item, 'Figtree', 34, FOREST))],
          })),
        }),
      ),
      text(
        'a02-numbers',
        { x: 700, y: 430, width: 500, height: 420 },
        doc({
          type: 'orderedList',
          attrs: { start: 3 },
          content: ['Third', 'Fourth, which is a little longer than the rest of them', 'Fifth'].map(
            (item) => ({
              type: 'listItem',
              content: [paragraph(undefined, run(item, 'Figtree', 34, FOREST))],
            }),
          ),
        }),
      ),
      text(
        'a02-aligned',
        { x: 1240, y: 60, width: 600, height: 780 },
        doc(
          aligned('', 'Left aligned text that wraps around.'),
          aligned('center', 'Centred text that wraps around.'),
          aligned('right', 'Right aligned text that wraps around.'),
          aligned('justify', 'Justified text that wraps around and around and around and around.'),
          {
            type: 'paragraph',
            attrs: { lineHeight: 2 },
            content: [run('Double spaced and wrapping.', 'Figtree', 36, FOREST)],
          },
          {
            type: 'paragraph',
            attrs: { indent: 2 },
            content: [run('Indented twice.', 'Figtree', 36, FOREST)],
          },
        ),
      ),
    ],
    animations: [],
    transition: transition('fade'),
  };
}

/** Shapes: turned, transparent, dashed, with words inside, overlapping. */
function shapes(): Json {
  const turned = {
    ...shape('a03-turned', 'rectangle', { x: 200, y: 200, width: 500, height: 260 }, YELLOW),
    rotation: 30,
  };
  const faint = shape(
    'a03-faint',
    'ellipse',
    { x: 450, y: 250, width: 500, height: 500 },
    GREEN,
    0.4,
  );
  const dashed = {
    ...shape(
      'a03-dashed',
      'roundedRectangle',
      { x: 1000, y: 140, width: 640, height: 300 },
      'none',
    ),
    cornerRadius: 40,
    border: { color: FOREST, width: 8, dash: 'dashed' },
  };
  const triangle = {
    ...shape('a03-triangle', 'triangle', { x: 1180, y: 560, width: 400, height: 360 }, MINT),
    rotation: -15,
  };
  const withWords = {
    ...shape('a03-words', 'ellipse', { x: 120, y: 640, width: 620, height: 340 }, FOREST),
    text: doc(
      paragraph(
        'center',
        run('Words inside a shape, centred and wrapping', 'Bricolage Grotesque', 44, WHITE, [
          'bold',
        ]),
      ),
    ),
  };
  return {
    id: 'a03',
    background: WHITE,
    notes: '',
    elements: [
      turned,
      faint,
      dashed,
      triangle,
      withWords,
      line('a03-line', 800, 900, 800, FOREST),
      {
        ...shape('a03-arrow', 'arrow', { x: 800, y: 760, width: 300, height: 120 }, 'none'),
        border: { color: GREEN, width: 10, dash: 'solid' },
      },
      text(
        'a03-note',
        { x: 800, y: 960, width: 900, height: 80 },
        doc(paragraph(undefined, run('Layers overlap in this order', 'Space Grotesk', 40, MUTED))),
      ),
    ],
    animations: [],
    transition: transition('zoom'),
  };
}

/** Steps at every click: elements that appear, one that disappears, and one that moves. */
function clicks(): Json {
  const step = (
    id: string,
    element: string,
    effect: string,
    style: string,
    trigger = 'click',
  ): Json => ({
    id,
    element,
    effect,
    ...(style === '' ? {} : { style }),
    trigger,
    duration: 0.3,
    delay: 0,
    easing: 'ease-out',
  });
  return {
    id: 'a04',
    background: FOREST,
    notes: '',
    elements: [
      text(
        'a04-title',
        { x: 140, y: 100, width: 1400, height: 160 },
        doc(paragraph(undefined, run('Clicks', 'DM Serif Display', 120, WHITE))),
      ),
      shape('a04-one', 'rectangle', { x: 140, y: 360, width: 360, height: 360 }, YELLOW),
      shape('a04-two', 'ellipse', { x: 620, y: 360, width: 360, height: 360 }, MINT),
      shape('a04-three', 'triangle', { x: 1100, y: 360, width: 360, height: 360 }, WHITE, 0.7),
      text(
        'a04-tag',
        { x: 140, y: 800, width: 1400, height: 100 },
        doc(
          paragraph(
            undefined,
            run('Appear, appear together, move, disappear', 'JetBrains Mono', 44, WHITE),
          ),
        ),
      ),
    ],
    animations: [
      step('a04-s1', 'a04-one', 'appear', 'rise'),
      step('a04-s2', 'a04-two', 'appear', 'fade'),
      step('a04-s3', 'a04-three', 'appear', 'instant', 'with-previous'),
      { ...step('a04-s4', 'a04-tag', 'move', ''), x: 600, y: 860 },
      step('a04-s5', 'a04-one', 'disappear', 'fade'),
    ],
    transition: transition('push'),
  };
}

export function awkwardDeck(): Json {
  return {
    schemaVersion: 1,
    id: 'autumn-launch',
    title: 'Awkward',
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    slides: [fonts(), paragraphs(), shapes(), clicks()],
  };
}
