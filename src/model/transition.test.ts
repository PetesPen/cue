import { applyPatches } from 'immer';
import { describe, expect, test } from 'vitest';
import { CommandError, applyCommand } from './commands';
import { createSlide, duplicateDeck, type Deck } from './deck';
import { createShape } from './elements';
import { parseDeck } from './parse';
import {
  DEFAULT_TRANSITION,
  changeTransition,
  clampTransitionDuration,
  isTransitionKind,
} from './transition';

// How a slide arrives (TN-1).

const deckOf = (...ids: string[]): Deck => ({
  schemaVersion: 1,
  id: 'deck',
  title: 'Deck',
  createdAt: 1,
  updatedAt: 1,
  slides: ids.map((id) => createSlide(id)),
});

describe('the transition of a slide (TN-1)', () => {
  test('Given a new slide, Then it has no transition, coming from the right in 0.6 s when one is chosen', () => {
    expect(createSlide('s').transition).toEqual({ kind: 'none', from: 'right', duration: 0.6 });
    expect(DEFAULT_TRANSITION.kind).toBe('none');
  });

  test.each(['none', 'fade', 'slide', 'push', 'zoom'])(
    'Given %s, Then it is a kind of transition',
    (kind) => {
      expect(isTransitionKind(kind)).toBe(true);
    },
  );

  test.each(['wipe', '', 3, undefined])(
    'Given %j, Then it is not a kind of transition',
    (value) => {
      expect(isTransitionKind(value)).toBe(false);
    },
  );

  test.each([
    [0, 0.2],
    [0.34, 0.3],
    [1.26, 1.3],
    [3, 3],
    [10, 3],
    [Number.NaN, 0.6],
  ])('Given a duration of %f s, When it is kept, Then it is %f', (given, kept) => {
    expect(clampTransitionDuration(given)).toBe(kept);
  });

  test('Given a transition, When one part changes, Then the rest stays, and a stray value is ignored', () => {
    const slide = changeTransition(DEFAULT_TRANSITION, { kind: 'slide' });

    expect(slide).toEqual({ kind: 'slide', from: 'right', duration: 0.6 });
    expect(changeTransition(slide, { from: 'top', duration: 1.5 })).toEqual({
      kind: 'slide',
      from: 'top',
      duration: 1.5,
    });
    // @ts-expect-error a kind that does not exist is ignored, not stored
    expect(changeTransition(slide, { kind: 'wipe' })).toEqual(slide);
  });
});

describe('setTransition', () => {
  test('Given three slides, When one gets a transition, Then only that one changes', () => {
    const { deck } = applyCommand(deckOf('a', 'b', 'c'), {
      type: 'setTransition',
      slideId: 'b',
      change: { kind: 'push' },
      at: 5,
    });

    expect(deck.slides.map((s) => s.transition.kind)).toEqual(['none', 'push', 'none']);
  });

  test('Given a transition set, When the step is undone, Then the slide has none again', () => {
    const before = deckOf('a');
    const { deck, inverse } = applyCommand(before, {
      type: 'setTransition',
      slideId: 'a',
      change: { kind: 'zoom' },
      at: 5,
    });

    expect(applyPatches(deck, inverse)).toEqual(before);
  });

  test('Given a slide that is not in the deck, When a transition is set, Then the command fails', () => {
    expect(() =>
      applyCommand(deckOf('a'), {
        type: 'setTransition',
        slideId: 'zzz',
        change: { kind: 'fade' },
        at: 5,
      }),
    ).toThrow(CommandError);
  });

  test('Given a slide with a transition, When it is duplicated, Then the copy has the same transition', () => {
    let deck = deckOf('a');
    deck = applyCommand(deck, {
      type: 'setTransition',
      slideId: 'a',
      change: { kind: 'slide', from: 'left', duration: 1.2 },
      at: 5,
    }).deck;

    const copy = applyCommand(deck, {
      type: 'duplicateSlide',
      slideId: 'a',
      newSlideId: 'a2',
      elementIds: [],
      stepIds: [],
      at: 6,
    }).deck;

    expect(copy.slides[1]?.transition).toEqual({ kind: 'slide', from: 'left', duration: 1.2 });
  });

  test('Given a deck with transitions, When the deck is duplicated, Then every copied slide keeps its transition', () => {
    const deck = applyCommand(deckOf('a', 'b'), {
      type: 'setTransition',
      slideId: 'b',
      change: { kind: 'fade' },
      at: 5,
    }).deck;
    const withShape: Deck = {
      ...deck,
      slides: deck.slides.map((s) => ({
        ...s,
        elements: [createShape(`${s.id}-e`, 'rectangle', { x: 0, y: 0, width: 5, height: 5 })],
      })),
    };
    let n = 0;

    const copy = duplicateDeck(withShape, { newId: () => `n${String(n++)}`, now: () => 9 });

    expect(copy.slides.map((s) => s.transition.kind)).toEqual(['none', 'fade']);
  });
});

describe('setAllTransitions (TN-3)', () => {
  const slide = { kind: 'slide', from: 'left', duration: 1.2 } as const;

  test('Given four slides, When a transition is applied to all, Then every slide but the first has it, and the first is left alone', () => {
    const { deck } = applyCommand(deckOf('a', 'b', 'c', 'd'), {
      type: 'setAllTransitions',
      transition: slide,
      at: 5,
    });

    expect(deck.slides.map((s) => s.transition)).toEqual([DEFAULT_TRANSITION, slide, slide, slide]);
  });

  test('Given slides with their own transitions, When one is applied to all, Then each is replaced, direction and duration included', () => {
    let deck = deckOf('a', 'b', 'c');
    deck = applyCommand(deck, {
      type: 'setTransition',
      slideId: 'b',
      change: { kind: 'zoom', duration: 3 },
      at: 5,
    }).deck;

    deck = applyCommand(deck, { type: 'setAllTransitions', transition: slide, at: 6 }).deck;

    expect(deck.slides.slice(1).map((s) => s.transition)).toEqual([slide, slide]);
  });

  test('Given a transition applied to all, When the step is undone, Then every slide is as it was, in one step', () => {
    const before = applyCommand(deckOf('a', 'b', 'c'), {
      type: 'setTransition',
      slideId: 'c',
      change: { kind: 'fade' },
      at: 5,
    }).deck;
    const { deck, inverse } = applyCommand(before, {
      type: 'setAllTransitions',
      transition: slide,
      at: 6,
    });

    expect(applyPatches(deck, inverse)).toEqual(before);
  });

  test('Given a stray value, When it is applied to all, Then it is brought to what a transition can be', () => {
    const { deck } = applyCommand(deckOf('a', 'b'), {
      type: 'setAllTransitions',
      transition: { kind: 'slide', from: 'left', duration: 99 },
      at: 5,
    });

    expect(deck.slides[1]?.transition.duration).toBe(3);
  });

  test('Given a deck of one slide, When a transition is applied to all, Then nothing changes', () => {
    const before = deckOf('a');

    const { deck } = applyCommand(before, { type: 'setAllTransitions', transition: slide, at: 5 });

    expect(deck.slides).toEqual(before.slides);
  });
});

describe('opening a deck with transitions (SV-1)', () => {
  test('Given a deck with transitions, When it is saved as JSON and parsed, Then it is the same', () => {
    const deck = applyCommand(deckOf('a', 'b'), {
      type: 'setTransition',
      slideId: 'a',
      change: { kind: 'push', from: 'bottom', duration: 2 },
      at: 5,
    }).deck;

    expect(parseDeck(JSON.parse(JSON.stringify(deck)))).toEqual(deck);
  });

  test('Given a deck saved before transitions existed, When it is parsed, Then every slide has none', () => {
    const deck = deckOf('a');
    const old = {
      ...deck,
      slides: deck.slides.map((slide) => ({
        id: slide.id,
        background: slide.background,
        notes: slide.notes,
        elements: slide.elements,
        animations: slide.animations,
      })),
    };

    expect(parseDeck(old).slides.map((s) => s.transition)).toEqual([DEFAULT_TRANSITION]);
  });

  test('Given odd values in a transition, When the deck is parsed, Then they fall back to the defaults', () => {
    const deck = deckOf('a');
    const odd = {
      ...deck,
      slides: deck.slides.map((slide) => ({
        ...slide,
        transition: { kind: 'wipe', from: 'diagonal', duration: 99 },
      })),
    };

    expect(parseDeck(odd).slides[0]?.transition).toEqual({
      kind: 'none',
      from: 'right',
      duration: 3,
    });
  });
});
