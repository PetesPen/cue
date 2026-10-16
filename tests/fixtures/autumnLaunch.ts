// The fixture deck "Autumn Launch": 12 slides in the look of the design (design/README.md, Main.png,
// Presenter.png): dark, white, yellow and mint backgrounds, a green eyebrow, big bold titles, rule lines
// with numbered rows, circles and blocks. It feeds the end-to-end, screenshot and performance tests, so a
// failure points at the same slides every time (CLAUDE.md, testing rules).
//
// It is plain data in the stored deck format (schema version 1), so any test can write it straight into
// the browser's database. `tests/autumn-launch.test.ts` checks that the app reads it.

export const FOREST = '#14281B';
export const GREEN = '#17803F';
export const MINT = '#7FC8A0';
export const YELLOW = '#F5C542';
export const SAGE = '#E8F0E4';
export const WHITE = '#FFFFFF';
export const MUTED = '#5B6F61';

export type Json = Record<string, unknown>;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const border = (width = 0) => ({ color: FOREST, width, dash: 'solid' });

export function run(
  text: string,
  fontSize: number,
  color: string,
  extra: readonly string[] = [],
): Json {
  return {
    type: 'text',
    text,
    marks: [...extra.map((type) => ({ type })), { type: 'textStyle', attrs: { fontSize, color } }],
  };
}

export function paragraph(align: string | undefined, ...runs: Json[]): Json {
  return { type: 'paragraph', ...(align ? { attrs: { align } } : {}), content: runs };
}

/** A paragraph with tight line spacing, for big titles. */
function tight(...runs: Json[]): Json {
  return { type: 'paragraph', attrs: { lineHeight: 1 }, content: runs };
}

export const doc = (...content: Json[]): Json => ({ type: 'doc', content });

export function text(id: string, box: Box, content: Json): Json {
  return {
    id,
    kind: 'text',
    ...box,
    rotation: 0,
    opacity: 1,
    fill: 'none',
    border: border(),
    padding: 0,
    doc: content,
  };
}

export function shape(id: string, kind: string, box: Box, fill: string, opacity = 1): Json {
  return {
    id,
    kind: 'shape',
    shape: kind,
    ...box,
    rotation: 0,
    opacity,
    fill,
    border: border(),
    cornerRadius: 0,
  };
}

export function line(id: string, x: number, y: number, width: number, color: string): Json {
  return {
    id,
    kind: 'shape',
    shape: 'line',
    x,
    y,
    width,
    height: 0,
    rotation: 0,
    opacity: 1,
    fill: 'none',
    border: { color, width: 3, dash: 'solid' },
    cornerRadius: 0,
  };
}

/** An animation step in the stored form: 0.5 s, no delay, ease out (the defaults). */
function step(
  id: string,
  element: string,
  effect: 'appear' | 'disappear',
  trigger: 'click' | 'with-previous' = 'click',
): Json {
  return {
    id,
    element,
    effect,
    style: 'fade',
    trigger,
    duration: 0.5,
    delay: 0,
    easing: 'ease-out',
  };
}

/** A transition in the stored form: the kind, coming in from the right, 0.6 s (the defaults). */
export function transition(kind = 'none'): Json {
  return { kind, from: 'right', duration: 0.6 };
}

/** A Move step in the stored form: where the element's top left ends. */
function moveStep(id: string, element: string, x: number, y: number): Json {
  return {
    id,
    element,
    effect: 'move',
    trigger: 'click',
    duration: 0.8,
    delay: 0,
    easing: 'ease-out',
    x,
    y,
  };
}

/** One slide: a coloured background, a headline, a line of support and a coloured circle. */
function simple(
  n: number,
  background: string,
  ink: string,
  title: string,
  subtitle: string,
  circle: string,
  notes: string,
  arrives = 'none',
): Json {
  const id = `s${String(n).padStart(2, '0')}`;
  return {
    id,
    background,
    notes,
    elements: [
      text(
        `${id}-title`,
        { x: 140, y: 360, width: 1100, height: 150 },
        doc(paragraph(undefined, run(title, 120, ink, ['bold']))),
      ),
      text(
        `${id}-sub`,
        { x: 140, y: 560, width: 1000, height: 70 },
        doc(paragraph(undefined, run(subtitle, 52, ink))),
      ),
      shape(`${id}-dot`, 'ellipse', { x: 1420, y: 640, width: 320, height: 320 }, circle),
    ],
    animations: [],
    transition: transition(arrives),
  };
}

/** The hero slide, "Our approach" (design: Main, Presenter, Editor-Text). */
function approach(): Json {
  const rows = ['Listen first', 'Ship in small steps', 'Measure what matters'];
  return {
    id: 's03',
    background: WHITE,
    notes:
      'Open with the customer problem, not the product. Click once to bring in the image, then pause for questions before moving to the three pillars.',
    elements: [
      text(
        's03-eyebrow',
        { x: 130, y: 120, width: 700, height: 50 },
        doc(paragraph(undefined, run('03 — STRATEGY', 32, GREEN, ['bold']))),
      ),
      text(
        's03-title',
        { x: 130, y: 190, width: 900, height: 340 },
        doc(tight(run('Our approach', 150, FOREST, ['bold']))),
      ),
      shape('s03-image', 'rectangle', { x: 920, y: 150, width: 730, height: 650 }, MINT, 0.6),
      shape('s03-block', 'rectangle', { x: 1340, y: 280, width: 440, height: 550 }, YELLOW),
      shape('s03-circle', 'ellipse', { x: 810, y: 560, width: 300, height: 300 }, FOREST),
      ...rows.flatMap((row, i) => [
        line(`s03-rule-${String(i)}`, 130, 740 + i * 100, 640, FOREST),
        text(
          `s03-row-${String(i)}`,
          { x: 130, y: 762 + i * 100, width: 640, height: 60 },
          doc(paragraph(undefined, run(`0${String(i + 1)}   `, 44, MUTED), run(row, 44, FOREST))),
        ),
      ]),
    ],
    // Click 1: the picture comes in, with the three rows. Click 2: the circle moves up and to the
    // right. Click 3: the yellow block leaves (the Editor-Animate board).
    animations: [
      step('s03-step-1', 's03-image', 'appear'),
      step('s03-step-2', 's03-row-0', 'appear', 'with-previous'),
      step('s03-step-3', 's03-row-1', 'appear', 'with-previous'),
      step('s03-step-4', 's03-row-2', 'appear', 'with-previous'),
      moveStep('s03-step-5', 's03-circle', 1010, 400),
      step('s03-step-6', 's03-block', 'disappear'),
    ],
    transition: transition('slide'),
  };
}

/** A slide with a bulleted list of points. */
function points(n: number, background: string, ink: string, title: string, items: string[]): Json {
  const id = `s${String(n).padStart(2, '0')}`;
  return {
    id,
    background,
    notes: '',
    elements: [
      text(
        `${id}-title`,
        { x: 140, y: 120, width: 1500, height: 140 },
        doc(paragraph(undefined, run(title, 96, ink, ['bold']))),
      ),
      text(
        `${id}-list`,
        { x: 140, y: 340, width: 1300, height: 500 },
        doc({
          type: 'bulletList',
          content: items.map((item) => ({
            type: 'listItem',
            content: [paragraph(undefined, run(item, 56, ink))],
          })),
        }),
      ),
      shape(`${id}-bar`, 'rectangle', { x: 1600, y: 0, width: 320, height: 1080 }, MINT, 0.5),
    ],
    animations: [],
    transition: transition(),
  };
}

/** The 12 slides of the deck, in order. */
export function autumnLaunchSlides(): Json[] {
  return [
    simple(
      1,
      FOREST,
      WHITE,
      'Autumn Launch',
      'Q4 plan for everyone in the room',
      YELLOW,
      'Welcome people, then ask them to put phones away.',
    ),
    simple(
      2,
      WHITE,
      FOREST,
      'Why now',
      'Customers asked for this twice',
      MINT,
      'Two customer quotes, then the number.',
      'fade',
    ),
    approach(),
    simple(
      4,
      YELLOW,
      FOREST,
      'What we heard',
      'Three things, in their own words',
      WHITE,
      '',
      'push',
    ),
    simple(5, WHITE, FOREST, 'The product', 'Faster, calmer, easier to share', YELLOW, ''),
    simple(
      6,
      SAGE,
      FOREST,
      'The numbers',
      'Up 42% since spring',
      GREEN,
      'Say the Q2 number out loud.',
      'zoom',
    ),
    simple(7, FOREST, WHITE, 'Roadmap', 'October to December', MINT, ''),
    points(8, WHITE, FOREST, 'Launch week', [
      'Monday: press and partners',
      'Wednesday: the live demo',
      'Friday: customer webinar',
    ]),
    simple(9, SAGE, FOREST, 'Risks', 'What could go wrong, and what we do', FOREST, ''),
    points(10, WHITE, FOREST, 'What we need', [
      'Two more engineers',
      'A date for legal review',
      'Budget for the launch event',
    ]),
    simple(11, FOREST, YELLOW, 'The ask', 'A yes by Friday', WHITE, ''),
    simple(12, YELLOW, FOREST, 'Thank you', 'Questions?', FOREST, ''),
  ];
}

export function autumnLaunch(): Json {
  const slides = autumnLaunchSlides();
  return {
    schemaVersion: 1,
    id: 'autumn-launch',
    title: 'Autumn Launch',
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    slides,
  };
}
