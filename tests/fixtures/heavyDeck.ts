// Decks for the performance suite (UX-3, `perf/`): one slide of 50 mixed elements, and a deck of 50
// slides. Plain data in the stored deck format, like the Autumn Launch fixture, so the numbers a run
// reports always come from the same slides.

import {
  FOREST,
  GREEN,
  MINT,
  MUTED,
  SAGE,
  WHITE,
  YELLOW,
  autumnLaunchSlides,
  doc,
  line,
  paragraph,
  run,
  shape,
  text,
  transition,
  type Json,
} from './autumnLaunch';

const FILLS = [MINT, YELLOW, SAGE, GREEN, FOREST];
const KINDS = ['rectangle', 'ellipse', 'roundedRectangle', 'triangle'];

/**
 * One slide with 50 elements in a grid of 10 columns by 5 rows: 20 shapes with transparency, 20 text
 * boxes of two lines and 10 rules. The first shape is `heavy-shape-0` (top left): the one the drag
 * and resize tests pick up.
 */
export function fiftyElementSlide(id = 'heavy'): Json {
  const elements: Json[] = [];
  const cell = { width: 192, height: 216 };
  for (let n = 0; n < 20; n++) {
    const column = n % 10;
    const row = Math.floor(n / 10);
    elements.push({
      ...shape(
        `${id}-shape-${String(n)}`,
        KINDS[n % KINDS.length] ?? 'rectangle',
        { x: column * cell.width + 20, y: row * cell.height + 20, width: 150, height: 150 },
        FILLS[n % FILLS.length] ?? MINT,
        0.6 + (n % 5) * 0.1,
      ),
    });
  }
  for (let n = 0; n < 20; n++) {
    const column = n % 10;
    const row = 2 + Math.floor(n / 10);
    elements.push(
      text(
        `${id}-text-${String(n)}`,
        { x: column * cell.width + 14, y: row * cell.height + 20, width: 170, height: 90 },
        doc(
          paragraph(
            undefined,
            run(`Item ${String(n + 1)} `, 30, FOREST, ['bold']),
            run('with a few more words', 30, MUTED),
          ),
        ),
      ),
    );
  }
  for (let n = 0; n < 10; n++) {
    elements.push(
      line(`${id}-rule-${String(n)}`, n * cell.width + 20, 4 * cell.height + 40, 150, FOREST),
    );
  }
  return { id, background: WHITE, notes: '', elements, animations: [], transition: transition() };
}

/** The same data with the id of every slide, element and step ("id" and "element") given `suffix`. */
function withSuffix(value: unknown, suffix: string): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => withSuffix(item, suffix));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]: [string, unknown]) => [
      key,
      (key === 'id' || key === 'element') && typeof item === 'string'
        ? item + suffix
        : withSuffix(item, suffix),
    ]),
  );
}

function renamed(slide: Json, suffix: string): Json {
  const copy = withSuffix(slide, suffix);
  if (typeof copy !== 'object' || copy === null || Array.isArray(copy)) {
    throw new Error('A slide is not an object');
  }
  return Object.fromEntries(Object.entries(copy));
}

export const HEAVY_SLIDE_ID = 'heavy';

/** A deck of just the fifty-element slide. */
export function fiftyElementDeck(): Json {
  return {
    schemaVersion: 1,
    id: 'fifty-elements',
    title: 'Fifty elements',
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    slides: [fiftyElementSlide(HEAVY_SLIDE_ID)],
  };
}

/** A deck of 50 slides: the fifty-element slide, then the slides of Autumn Launch over and over. */
export function fiftySlideDeck(): Json {
  const launch = autumnLaunchSlides();
  const slides: Json[] = [fiftyElementSlide(HEAVY_SLIDE_ID)];
  for (let n = 0; slides.length < 50; n++) {
    const original = launch[n % launch.length];
    if (original) slides.push(renamed(original, `-c${String(Math.floor(n / launch.length))}`));
  }
  return {
    schemaVersion: 1,
    id: 'fifty-slides',
    title: 'Fifty slides',
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    slides,
  };
}

/** The worst case: 50 slides, each of them the fifty-element slide (2,500 elements in all). */
export function fiftyHeavySlidesDeck(): Json {
  const slides: Json[] = [];
  for (let n = 0; n < 50; n++) {
    const slide = fiftyElementSlide(n === 0 ? HEAVY_SLIDE_ID : `heavy-${String(n)}`);
    slides.push(slide);
  }
  return {
    schemaVersion: 1,
    id: 'fifty-heavy-slides',
    title: 'Fifty heavy slides',
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    slides,
  };
}
