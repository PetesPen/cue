import fc from 'fast-check';
import { applyPatches } from 'immer';
import { describe, expect, test } from 'vitest';
import { CommandError, applyCommand, type Command } from './commands';
import { createSlide, type Deck } from './deck';
import { createShape, SHAPE_KINDS, type ShapeKind, type SlideElement } from './elements';
import { parseDeck } from './parse';

function deckWithElements(...ids: string[]): Deck {
  const slide = {
    ...createSlide('s1'),
    elements: ids.map((id) =>
      createShape(id, 'rectangle', { x: 0, y: 0, width: 100, height: 100 }),
    ),
  };
  return {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1000,
    updatedAt: 1000,
    slides: [slide, createSlide('s2')],
  };
}

const idsOn = (deck: Deck, slideId = 's1') =>
  deck.slides.find((s) => s.id === slideId)?.elements.map((e) => e.id) ?? [];

describe('addElement (EL-3, ZO-1)', () => {
  test('Given a slide with elements, When one is added, Then it is on top of the others', () => {
    const { deck } = applyCommand(deckWithElements('a', 'b'), {
      type: 'addElement',
      slideId: 's1',
      element: createShape('c', 'ellipse', { x: 5, y: 6, width: 7, height: 8 }),
      at: 2000,
    });

    expect(idsOn(deck)).toEqual(['a', 'b', 'c']);
    expect(deck.updatedAt).toBe(2000);
  });

  test('Given two slides, When an element is added to one, Then the other is untouched', () => {
    const before = deckWithElements('a');

    const { deck } = applyCommand(before, {
      type: 'addElement',
      slideId: 's1',
      element: createShape('b', 'rectangle', { x: 0, y: 0, width: 1, height: 1 }),
      at: 2000,
    });

    expect(deck.slides[1]).toBe(before.slides[1]);
  });

  test('Given an element id already on the slide, When it is added again, Then the command fails', () => {
    expect(() =>
      applyCommand(deckWithElements('a'), {
        type: 'addElement',
        slideId: 's1',
        element: createShape('a', 'rectangle', { x: 0, y: 0, width: 1, height: 1 }),
        at: 2000,
      }),
    ).toThrow(/already on slide s1/);
  });

  test('Given a slide that is not in the deck, When an element is added to it, Then the command fails', () => {
    expect(() =>
      applyCommand(deckWithElements(), {
        type: 'addElement',
        slideId: 'nope',
        element: createShape('a', 'rectangle', { x: 0, y: 0, width: 1, height: 1 }),
        at: 2000,
      }),
    ).toThrow(CommandError);
  });
});

describe('updateElements (EL-5, TR-1)', () => {
  test('Given two elements, When both are moved in one command, Then each has its own new position and nothing else changes', () => {
    const before = deckWithElements('a', 'b');

    const { deck } = applyCommand(before, {
      type: 'updateElements',
      slideId: 's1',
      changes: [
        { id: 'a', props: { x: 10, y: 20 } },
        { id: 'b', props: { x: 30 } },
      ],
      at: 3000,
    });

    const [a, b] = deck.slides[0]?.elements ?? [];
    expect(a).toMatchObject({ x: 10, y: 20, width: 100 });
    expect(b).toMatchObject({ x: 30, y: 0, width: 100 });
  });

  test('Given an opacity above 100%, When it is set, Then it is held at 1', () => {
    const { deck } = applyCommand(deckWithElements('a'), {
      type: 'updateElements',
      slideId: 's1',
      changes: [{ id: 'a', props: { opacity: 7 } }],
      at: 3000,
    });

    expect(deck.slides[0]?.elements[0]?.opacity).toBe(1);
  });

  test('Given a change to an element that is not on the slide, When it runs, Then it fails and the deck is not changed', () => {
    const before = deckWithElements('a');

    expect(() =>
      applyCommand(before, {
        type: 'updateElements',
        slideId: 's1',
        changes: [
          { id: 'a', props: { x: 1 } },
          { id: 'ghost', props: { x: 1 } },
        ],
        at: 3000,
      }),
    ).toThrow(/Element ghost is not on slide s1/);
    expect(before.slides[0]?.elements[0]?.x).toBe(0);
  });

  test('Given an unknown slide, When elements are updated, Then it fails', () => {
    expect(() =>
      applyCommand(deckWithElements('a'), {
        type: 'updateElements',
        slideId: 'nope',
        changes: [],
        at: 3000,
      }),
    ).toThrow(CommandError);
  });
});

describe('reorderElements (ZO-1)', () => {
  test('Given a b c, When a is brought to the front, Then the order is b c a', () => {
    const { deck } = applyCommand(deckWithElements('a', 'b', 'c'), {
      type: 'reorderElements',
      slideId: 's1',
      ids: ['a'],
      mode: 'front',
      at: 3000,
    });

    expect(idsOn(deck)).toEqual(['b', 'c', 'a']);
  });

  test('Given a command that would change nothing, When it runs, Then the elements are the same objects in the same order', () => {
    const before = deckWithElements('a', 'b');

    const { deck } = applyCommand(before, {
      type: 'reorderElements',
      slideId: 's1',
      ids: ['b'],
      mode: 'front',
      at: 3000,
    });

    expect(deck.slides[0]?.elements).toEqual(before.slides[0]?.elements);
  });

  test('Given an unknown slide, When elements are reordered, Then it fails', () => {
    expect(() =>
      applyCommand(deckWithElements('a'), {
        type: 'reorderElements',
        slideId: 'nope',
        ids: ['a'],
        mode: 'back',
        at: 3000,
      }),
    ).toThrow(CommandError);
  });
});

describe('element commands as a whole (EL-8 groundwork)', () => {
  const shapeArb: fc.Arbitrary<SlideElement> = fc
    .tuple(
      fc.stringMatching(/^[a-z0-9]{1,4}$/),
      fc.constantFrom<ShapeKind>(...SHAPE_KINDS),
      fc.double({ min: -500, max: 2500, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    )
    .map(([id, shape, x, opacity]) => ({
      ...createShape(id, shape, {
        x: x + 0,
        y: x / 2 + 0,
        width: 120,
        height: 80,
        rotation: (x % 180) + 0,
      }),
      opacity,
    }));

  const deckArb = fc
    .uniqueArray(shapeArb, { selector: (e) => e.id, minLength: 1, maxLength: 8 })
    .map((elements): Deck => ({
      schemaVersion: 1,
      id: 'deck',
      title: 'Deck',
      createdAt: 1,
      updatedAt: 1,
      slides: [{ ...createSlide('s1'), elements }],
    }));

  const commandArb = (deck: Deck): fc.Arbitrary<Command> => {
    const ids = deck.slides[0]?.elements.map((e) => e.id) ?? [];
    return fc.oneof(
      fc.record({
        type: fc.constant<'addElement'>('addElement'),
        slideId: fc.constant('s1'),
        element: fc.constant(createShape('fresh', 'triangle', { x: 1, y: 2, width: 3, height: 4 })),
        at: fc.nat(),
      }),
      fc.record({
        type: fc.constant<'updateElements'>('updateElements'),
        slideId: fc.constant('s1'),
        changes: fc
          .subarray(ids, { minLength: 1 })
          .map((subset) =>
            subset.map((id) => ({ id, props: { x: 99, rotation: 45, opacity: 0.5 } })),
          ),
        at: fc.nat(),
      }),
      fc.record({
        type: fc.constant<'reorderElements'>('reorderElements'),
        slideId: fc.constant('s1'),
        ids: fc.subarray(ids),
        mode: fc.constantFrom('front', 'forward', 'backward', 'back' as const),
        at: fc.nat(),
      }),
    );
  };

  test('Given any element command, When it is applied and its inverse patches are applied, Then the original deck comes back (undo)', () => {
    fc.assert(
      fc.property(
        deckArb.chain((deck) => fc.tuple(fc.constant(deck), commandArb(deck))),
        ([deck, command]) => {
          const { deck: next, inverse, patches } = applyCommand(deck, command);

          expect(applyPatches(next, inverse)).toEqual(deck);
          expect(applyPatches(deck, patches)).toEqual(next);
        },
      ),
    );
  });

  test('Given any element command, When it is applied, Then the result is still a deck that parseDeck accepts (nothing stored is nonsense)', () => {
    fc.assert(
      fc.property(
        deckArb.chain((deck) => fc.tuple(fc.constant(deck), commandArb(deck))),
        ([deck, command]) => {
          const { deck: next } = applyCommand(deck, command);

          expect(parseDeck(JSON.parse(JSON.stringify(next)) as unknown)).toEqual(next);
        },
      ),
    );
  });
});
