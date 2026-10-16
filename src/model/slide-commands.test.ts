import fc from 'fast-check';
import { applyPatches } from 'immer';
import { describe, expect, test } from 'vitest';
import { CommandError, applyCommand } from './commands';
import { createSlide, type Deck } from './deck';
import { createShape, createText } from './elements';
import { parseDeck } from './parse';
import { textFromString } from './richtext';

const deckOf = (...ids: string[]): Deck => ({
  schemaVersion: 1,
  id: 'deck',
  title: 'Deck',
  createdAt: 1000,
  updatedAt: 1000,
  slides: ids.map((id) => createSlide(id)),
});

const order = (deck: Deck) => deck.slides.map((s) => s.id);

describe('deleteSlide (SL-4)', () => {
  test('Given a deck of three slides, When the middle one is deleted, Then the others stay in order', () => {
    const { deck } = applyCommand(deckOf('a', 'b', 'c'), {
      type: 'deleteSlide',
      slideId: 'b',
      replacementId: 'unused',
      at: 5,
    });

    expect(order(deck)).toEqual(['a', 'c']);
  });

  test('Given the only slide with elements, When it is deleted, Then a blank slide with the new id remains', () => {
    const slide = {
      ...createSlide('a'),
      notes: 'notes',
      elements: [createShape('s', 'ellipse', { x: 0, y: 0, width: 5, height: 5 })],
    };
    const only: Deck = { ...deckOf('a'), slides: [slide] };

    const { deck } = applyCommand(only, {
      type: 'deleteSlide',
      slideId: 'a',
      replacementId: 'fresh',
      at: 5,
    });

    expect(deck.slides).toEqual([createSlide('fresh')]);
  });

  test('Given a slide that is not in the deck, When it is deleted, Then the command fails', () => {
    expect(() =>
      applyCommand(deckOf('a'), { type: 'deleteSlide', slideId: 'zzz', replacementId: 'r', at: 5 }),
    ).toThrow(CommandError);
  });

  test('Given a deleted slide, When the step is undone, Then the slide is back in the same place with everything on it', () => {
    const text = createText('t', { x: 1, y: 2 }, textFromString('Hello'));
    const full: Deck = {
      ...deckOf('a', 'b', 'c'),
      slides: [
        createSlide('a'),
        { ...createSlide('b'), notes: 'keep me', elements: [text] },
        createSlide('c'),
      ],
    };

    const { deck, inverse } = applyCommand(full, {
      type: 'deleteSlide',
      slideId: 'b',
      replacementId: 'r',
      at: 5,
    });

    expect(applyPatches(deck, inverse)).toEqual(full);
  });
});

describe('moveSlide (SL-3)', () => {
  test.each([
    ['a', 2, ['b', 'c', 'a']],
    ['c', 0, ['c', 'a', 'b']],
    ['b', 1, ['a', 'b', 'c']],
    ['a', 99, ['b', 'c', 'a']],
    ['c', -4, ['c', 'a', 'b']],
  ])(
    'Given slides a, b, c, When %s is moved to place %i, Then the order is %j',
    (slideId, toIndex, expected) => {
      const { deck } = applyCommand(deckOf('a', 'b', 'c'), {
        type: 'moveSlide',
        slideId,
        toIndex,
        at: 5,
      });

      expect(order(deck)).toEqual(expected);
    },
  );

  test('Given a slide that is not in the deck, When it is moved, Then the command fails', () => {
    expect(() =>
      applyCommand(deckOf('a', 'b'), { type: 'moveSlide', slideId: 'zzz', toIndex: 0, at: 5 }),
    ).toThrow(CommandError);
  });

  test('Given any move, When it is undone, Then the order is as before (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), fc.integer({ min: -2, max: 8 }), (from, to) => {
        const deck = deckOf('a', 'b', 'c', 'd', 'e', 'f');
        const slideId = deck.slides[from]?.id ?? 'a';

        const applied = applyCommand(deck, { type: 'moveSlide', slideId, toIndex: to, at: 5 });

        expect(order(applied.deck).slice().sort()).toEqual(order(deck));
        expect(applyPatches(applied.deck, applied.inverse)).toEqual(deck);
      }),
    );
  });
});

describe('duplicateSlide (SL-4)', () => {
  const rect = createShape('r', 'rectangle', { x: 10, y: 20, width: 30, height: 40 });
  const text = createText('t', { x: 50, y: 60 }, textFromString('Hello'));
  const source: Deck = {
    ...deckOf('a', 'b'),
    slides: [
      { ...createSlide('a'), background: '#E8F0E4', notes: 'Say this', elements: [rect, text] },
      createSlide('b'),
    ],
  };

  test('Given a slide with elements and notes, When it is duplicated, Then the copy follows it with everything, under new ids', () => {
    const { deck } = applyCommand(source, {
      type: 'duplicateSlide',
      slideId: 'a',
      newSlideId: 'a2',
      elementIds: ['r2', 't2'],
      at: 5,
    });

    expect(order(deck)).toEqual(['a', 'a2', 'b']);
    const copy = deck.slides[1];
    expect(copy).toMatchObject({ background: '#E8F0E4', notes: 'Say this' });
    expect(copy?.elements.map((e) => e.id)).toEqual(['r2', 't2']);
    expect(copy?.elements.map((e) => ({ ...e, id: '' }))).toEqual(
      source.slides[0]?.elements.map((e) => ({ ...e, id: '' })),
    );
    // The original is untouched, and the copy shares nothing with it that could be changed alone.
    expect(deck.slides[0]).toEqual(source.slides[0]);
  });

  test('Given a copy, When one of its elements is changed, Then the original does not change', () => {
    const { deck } = applyCommand(source, {
      type: 'duplicateSlide',
      slideId: 'a',
      newSlideId: 'a2',
      elementIds: ['r2', 't2'],
      at: 5,
    });

    const { deck: changed } = applyCommand(deck, {
      type: 'updateElements',
      slideId: 'a2',
      changes: [{ id: 'r2', props: { x: 999 } }],
      at: 6,
    });

    expect(changed.slides[0]?.elements[0]).toMatchObject({ x: 10 });
    expect(changed.slides[1]?.elements[0]).toMatchObject({ x: 999 });
  });

  test('Given fewer new ids than elements, When a slide is duplicated, Then the command fails', () => {
    expect(() =>
      applyCommand(source, {
        type: 'duplicateSlide',
        slideId: 'a',
        newSlideId: 'a2',
        elementIds: ['r2'],
        at: 5,
      }),
    ).toThrow(CommandError);
  });

  test('Given a duplicated slide, When the step is undone, Then the deck is as before; and the result still passes the deck check', () => {
    const { deck, inverse } = applyCommand(source, {
      type: 'duplicateSlide',
      slideId: 'a',
      newSlideId: 'a2',
      elementIds: ['r2', 't2'],
      at: 5,
    });

    expect(applyPatches(deck, inverse)).toEqual(source);
    expect(parseDeck(JSON.parse(JSON.stringify(deck)))).toEqual(deck);
  });
});
