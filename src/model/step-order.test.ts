import fc from 'fast-check';
import { applyPatches } from 'immer';
import { describe, expect, test } from 'vitest';
import { createStep, type Step } from './animation';
import { CommandError, applyCommand } from './commands';
import { createSlide, type Deck } from './deck';
import { createShape } from './elements';
import { clickCount, clicksOf } from './motion';
import { parseDeck } from './parse';

// The order of the steps of a slide, and which of them play together (AN-5).

const ELEMENTS = ['a', 'b', 'c', 'd'];

/** "A:c" is a step called A that is On click; "B:w" is With previous. */
const steps = (...notes: string[]): Step[] =>
  notes.map((note) => {
    const [id = '', how] = note.split(':');
    return createStep(id, id.toLowerCase(), 'appear', how === 'w' ? 'with-previous' : 'click');
  });

const deckWith = (list: Step[]): Deck => ({
  schemaVersion: 1,
  id: 'deck',
  title: 'Deck',
  createdAt: 1,
  updatedAt: 1,
  slides: [
    {
      ...createSlide('s1'),
      elements: ELEMENTS.map((id) =>
        createShape(id, 'rectangle', { x: 0, y: 0, width: 100, height: 100 }),
      ),
      animations: list,
    },
  ],
});

const written = (deck: Deck) =>
  (deck.slides[0]?.animations ?? []).map((s) => `${s.id}:${s.trigger === 'click' ? 'c' : 'w'}`);

const move = (deck: Deck, stepId: string, toIndex: number) =>
  applyCommand(deck, { type: 'moveStep', slideId: 's1', stepId, toIndex, at: 9 });

describe('moveStep (AN-5)', () => {
  // Each row: the list, the step moved, where to, and the list afterwards. A step that ends up first
  // is On click, because the first step always is (decision 26).
  test.each([
    ['the first to the last', ['A:c', 'B:w', 'C:c', 'D:w'], 'A', 3, ['B:c', 'C:c', 'D:w', 'A:c']],
    ['the last to the first', ['A:c', 'B:w', 'C:c', 'D:w'], 'D', 0, ['D:c', 'A:c', 'B:w', 'C:c']],
    ['a With previous step to the front', ['A:c', 'B:w', 'C:c'], 'B', 0, ['B:c', 'A:c', 'C:c']],
    [
      'a step into the middle of a click',
      ['A:c', 'B:w', 'C:c', 'D:w'],
      'C',
      1,
      ['A:c', 'C:c', 'B:w', 'D:w'],
    ],
    ['a step to its own place', ['A:c', 'B:w', 'C:c'], 'B', 1, ['A:c', 'B:w', 'C:c']],
    ['the only step', ['A:c'], 'A', 5, ['A:c']],
    ['past the end', ['A:c', 'B:c', 'C:c'], 'A', 99, ['B:c', 'C:c', 'A:c']],
    ['before the start', ['A:c', 'B:c', 'C:c'], 'C', -4, ['C:c', 'A:c', 'B:c']],
    ['two with previous, one back', ['A:c', 'B:w', 'C:w'], 'C', 1, ['A:c', 'C:w', 'B:w']],
  ])('Given %s, When it is moved, Then the list is as written', (_name, before, id, to, after) => {
    const { deck } = move(deckWith(steps(...before)), id, to);

    expect(written(deck)).toEqual(after);
  });

  test('Given a reorder, Then clicks are derived from the new order', () => {
    const { deck } = move(deckWith(steps('A:c', 'B:w', 'C:c', 'D:w')), 'C', 1);

    const clicks = clicksOf(deck.slides[0]?.animations ?? []).map((c) => c.map((s) => s.id));

    expect(clicks).toEqual([['A'], ['C', 'B', 'D']]);
  });

  test('Given a reorder, When it is undone, Then the list is as it was, with its old triggers', () => {
    const before = deckWith(steps('A:c', 'B:w', 'C:c'));
    const { deck, inverse } = move(before, 'B', 0);

    expect(written(deck)).toEqual(['B:c', 'A:c', 'C:c']);
    expect(applyPatches(deck, inverse)).toEqual(before);
  });

  test('Given a step that is not on the slide, When it is moved, Then the command fails', () => {
    expect(() => move(deckWith(steps('A:c')), 'Z', 0)).toThrow(CommandError);
  });
});

describe('the first step is always On click (AN-5)', () => {
  test('Given a list, When its first step is removed, Then the next one becomes On click', () => {
    const { deck } = applyCommand(deckWith(steps('A:c', 'B:w', 'C:c')), {
      type: 'removeStep',
      slideId: 's1',
      stepId: 'A',
      at: 9,
    });

    expect(written(deck)).toEqual(['B:c', 'C:c']);
  });

  test('Given a list, When the element of its first step is deleted, Then the next one becomes On click', () => {
    const { deck } = applyCommand(deckWith(steps('A:c', 'B:w', 'C:c')), {
      type: 'removeElements',
      slideId: 's1',
      ids: ['a'],
      at: 9,
    });

    expect(written(deck)).toEqual(['B:c', 'C:c']);
  });

  test('Given the first step, When it is set to With previous, Then it stays On click', () => {
    const { deck } = applyCommand(deckWith(steps('A:c', 'B:c')), {
      type: 'updateStep',
      slideId: 's1',
      stepId: 'A',
      change: { trigger: 'with-previous' },
      at: 9,
    });

    expect(written(deck)).toEqual(['A:c', 'B:c']);
  });

  test('Given a deck stored with a first step that is With previous, When it is parsed, Then it is On click', () => {
    const stored = JSON.parse(JSON.stringify(deckWith(steps('A:w', 'B:w')))) as unknown;

    expect(written(parseDeck(stored))).toEqual(['A:c', 'B:w']);
  });

  test('Given any run of added, moved and removed steps, Then the first step is On click and every step has an element', () => {
    type Op =
      | { kind: 'add'; element: string; with: boolean }
      | { kind: 'move'; at: number; to: number }
      | { kind: 'remove'; at: number };
    const ops = fc.array(
      fc.oneof(
        fc.record({
          kind: fc.constant<'add'>('add'),
          element: fc.constantFrom(...ELEMENTS),
          with: fc.boolean(),
        }),
        fc.record({
          kind: fc.constant<'move'>('move'),
          at: fc.nat(8),
          to: fc.integer({ min: -2, max: 10 }),
        }),
        fc.record({ kind: fc.constant<'remove'>('remove'), at: fc.nat(8) }),
      ),
      { maxLength: 25 },
    );

    fc.assert(
      fc.property(ops, (list: Op[]) => {
        let deck = deckWith([]);
        let counter = 0;
        for (const op of list) {
          const current = deck.slides[0]?.animations ?? [];
          if (op.kind === 'add') {
            const step = createStep(
              `s${String(counter++)}`,
              op.element,
              'appear',
              op.with ? 'with-previous' : 'click',
            );
            deck = applyCommand(deck, { type: 'addStep', slideId: 's1', step, at: 9 }).deck;
          } else if (current.length > 0) {
            const target = current[op.at % current.length];
            if (!target) continue;
            deck =
              op.kind === 'move'
                ? move(deck, target.id, op.to).deck
                : applyCommand(deck, {
                    type: 'removeStep',
                    slideId: 's1',
                    stepId: target.id,
                    at: 9,
                  }).deck;
          }
          const after = deck.slides[0]?.animations ?? [];
          expect(after[0]?.trigger ?? 'click').toBe('click');
          expect(new Set(after.map((s) => s.id)).size).toBe(after.length);
          expect(clickCount(deck.slides[0] ?? createSlide('x'))).toBeLessThanOrEqual(after.length);
        }
      }),
    );
  });
});
