import { applyPatches } from 'immer';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_DELAY,
  DEFAULT_DURATION,
  DEFAULT_EASING,
  changeStep,
  clampDelay,
  clampDuration,
  createStep,
} from './animation';
import { CommandError, applyCommand } from './commands';
import { createSlide, duplicateDeck, type Deck } from './deck';
import { createShape } from './elements';
import { InvalidDeckError, parseDeck } from './parse';

const shape = (id: string) => createShape(id, 'rectangle', { x: 0, y: 0, width: 100, height: 100 });

function deckWith(...ids: string[]): Deck {
  return {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1,
    updatedAt: 1,
    slides: [{ ...createSlide('s1'), elements: ids.map(shape) }, createSlide('s2')],
  };
}

describe('a new step (AN-4)', () => {
  test('Given a new step, Then it has 0.5 s, no delay and ease out, and fades', () => {
    const step = createStep('x', 'a', 'appear');

    expect(step).toMatchObject({
      effect: 'appear',
      style: 'fade',
      trigger: 'click',
      duration: DEFAULT_DURATION,
      delay: DEFAULT_DELAY,
      easing: DEFAULT_EASING,
    });
    expect(DEFAULT_DURATION).toBe(0.5);
    expect(DEFAULT_EASING).toBe('ease-out');
  });
});

describe('timing (AN-4)', () => {
  test.each([
    [0, 0.1],
    [0.04, 0.1],
    [0.8, 0.8],
    [0.84, 0.8],
    [2.26, 2.3],
    [5, 5],
    [60, 5],
    [Number.NaN, 0.5],
  ])('Given a duration of %f s, When it is kept, Then it is %f', (given, kept) => {
    expect(clampDuration(given)).toBe(kept);
  });

  test.each([
    [-1, 0],
    [0, 0],
    [0.34, 0.3],
    [5, 5],
    [9, 5],
    [Number.POSITIVE_INFINITY, 0],
  ])('Given a delay of %f s, When it is kept, Then it is %f', (given, kept) => {
    expect(clampDelay(given)).toBe(kept);
  });
});

describe('changing a step (AN-1, AN-2)', () => {
  test('Given an Appear step with rise, When its effect becomes Disappear, Then it takes the style Disappear has', () => {
    const rise = changeStep(createStep('x', 'a', 'appear'), { style: 'rise' });

    const gone = changeStep(rise, { effect: 'disappear' });

    expect(gone).toMatchObject({ effect: 'disappear', style: 'fade' });
  });

  test('Given a Disappear step with instant, When its effect becomes Appear and back, Then it never holds a style its effect lacks', () => {
    const instant = changeStep(createStep('x', 'a', 'disappear'), { style: 'instant' });

    expect(changeStep(instant, { effect: 'appear' }).style).toBe('fade');
    expect(changeStep(instant, { style: 'rise' }).style).toBe('fade');
  });

  test('Given a step, When only its timing changes, Then its effect, style and element stay', () => {
    const rise = changeStep(createStep('x', 'a', 'appear'), { style: 'rise' });

    const slower = changeStep(rise, { duration: 1.5, delay: 0.3, easing: 'linear' });

    expect(slower).toEqual({ ...rise, duration: 1.5, delay: 0.3, easing: 'linear' });
  });
});

describe('addStep, updateStep, removeStep', () => {
  const step = createStep('st1', 'a', 'appear');

  test('Given an element on the slide, When a step is added, Then it is at the end of the list', () => {
    const first = applyCommand(deckWith('a', 'b'), {
      type: 'addStep',
      slideId: 's1',
      step,
      at: 5,
    }).deck;

    const { deck } = applyCommand(first, {
      type: 'addStep',
      slideId: 's1',
      step: createStep('st2', 'b', 'disappear'),
      at: 6,
    });

    expect(deck.slides[0]?.animations.map((s) => s.id)).toEqual(['st1', 'st2']);
  });

  test('Given an element that is not on the slide, When a step for it is added, Then the command fails', () => {
    expect(() =>
      applyCommand(deckWith('a'), {
        type: 'addStep',
        slideId: 's1',
        step: createStep('st1', 'zzz', 'appear'),
        at: 5,
      }),
    ).toThrow(CommandError);
  });

  test('Given a step id already used, When it is added again, Then the command fails', () => {
    const once = applyCommand(deckWith('a'), { type: 'addStep', slideId: 's1', step, at: 5 }).deck;

    expect(() => applyCommand(once, { type: 'addStep', slideId: 's1', step, at: 6 })).toThrow(
      CommandError,
    );
  });

  test('Given a step, When it is changed, Then only that step changes, and the change can be undone', () => {
    const before = applyCommand(deckWith('a', 'b'), {
      type: 'addStep',
      slideId: 's1',
      step,
      at: 5,
    }).deck;

    const { deck, inverse } = applyCommand(before, {
      type: 'updateStep',
      slideId: 's1',
      stepId: 'st1',
      change: { effect: 'disappear', duration: 2 },
      at: 6,
    });

    expect(deck.slides[0]?.animations[0]).toMatchObject({ effect: 'disappear', duration: 2 });
    expect(applyPatches(deck, inverse)).toEqual(before);
  });

  test('Given a step that is not on the slide, When it is changed or removed, Then the command fails', () => {
    expect(() =>
      applyCommand(deckWith('a'), {
        type: 'updateStep',
        slideId: 's1',
        stepId: 'nope',
        change: { duration: 1 },
        at: 5,
      }),
    ).toThrow(CommandError);
    expect(() =>
      applyCommand(deckWith('a'), { type: 'removeStep', slideId: 's1', stepId: 'nope', at: 5 }),
    ).toThrow(CommandError);
  });

  test('Given a step, When it is removed, Then the list is empty, and Undo puts it back', () => {
    const before = applyCommand(deckWith('a'), {
      type: 'addStep',
      slideId: 's1',
      step,
      at: 5,
    }).deck;

    const { deck, inverse } = applyCommand(before, {
      type: 'removeStep',
      slideId: 's1',
      stepId: 'st1',
      at: 6,
    });

    expect(deck.slides[0]?.animations).toEqual([]);
    expect(applyPatches(deck, inverse)).toEqual(before);
  });
});

describe('an element and its steps (AN-5)', () => {
  const withSteps = (): Deck => {
    let deck = deckWith('a', 'b');
    for (const s of [
      createStep('st1', 'a', 'appear'),
      createStep('st2', 'b', 'appear'),
      createStep('st3', 'a', 'disappear'),
    ]) {
      deck = applyCommand(deck, { type: 'addStep', slideId: 's1', step: s, at: 5 }).deck;
    }
    return deck;
  };

  test("Given steps for two elements, When one is deleted, Then its steps go and the other's stay", () => {
    const { deck } = applyCommand(withSteps(), {
      type: 'removeElements',
      slideId: 's1',
      ids: ['a'],
      at: 9,
    });

    expect(deck.slides[0]?.animations.map((s) => s.id)).toEqual(['st2']);
  });

  test('Given a deleted element with steps, When the step is undone, Then the element and its steps are back, in order', () => {
    const before = withSteps();

    const { deck, inverse } = applyCommand(before, {
      type: 'removeElements',
      slideId: 's1',
      ids: ['a'],
      at: 9,
    });

    expect(applyPatches(deck, inverse)).toEqual(before);
  });

  test('Given a slide with steps, When it is duplicated, Then the copy has the steps on the copied elements, with new ids', () => {
    const { deck } = applyCommand(withSteps(), {
      type: 'duplicateSlide',
      slideId: 's1',
      newSlideId: 's1b',
      elementIds: ['a2', 'b2'],
      stepIds: ['x1', 'x2', 'x3'],
      at: 9,
    });

    const copy = deck.slides[1];
    expect(copy?.id).toBe('s1b');
    expect(copy?.animations.map((s) => [s.id, s.element, s.effect])).toEqual([
      ['x1', 'a2', 'appear'],
      ['x2', 'b2', 'appear'],
      ['x3', 'a2', 'disappear'],
    ]);
    expect(deck.slides[0]?.animations.map((s) => s.id)).toEqual(['st1', 'st2', 'st3']);
  });

  test('Given a slide with steps, When it is duplicated without ids for them, Then the command fails', () => {
    expect(() =>
      applyCommand(withSteps(), {
        type: 'duplicateSlide',
        slideId: 's1',
        newSlideId: 's1b',
        elementIds: ['a2', 'b2'],
        stepIds: [],
        at: 9,
      }),
    ).toThrow(CommandError);
  });

  test('Given a deck with steps, When the deck is duplicated, Then the copy has its own ids and steps on its own elements', () => {
    let n = 0;
    const copy = duplicateDeck(withSteps(), { newId: () => `n${String(n++)}`, now: () => 9 });

    const slide = copy.slides[0];
    const elementIds = new Set(slide?.elements.map((e) => e.id));
    expect(slide?.animations).toHaveLength(3);
    for (const s of slide?.animations ?? []) {
      expect(elementIds.has(s.element)).toBe(true);
      expect(['st1', 'st2', 'st3']).not.toContain(s.id);
    }
  });
});

describe('opening a deck with steps (SV-1)', () => {
  test('Given a deck with steps, When it is saved as JSON and parsed, Then it is the same', () => {
    const deck = applyCommand(deckWith('a'), {
      type: 'addStep',
      slideId: 's1',
      step: changeStep(createStep('st1', 'a', 'appear'), { style: 'rise', duration: 1.2 }),
      at: 5,
    }).deck;

    expect(parseDeck(JSON.parse(JSON.stringify(deck)))).toEqual(deck);
  });

  /** A deck as it is stored, with the given steps on its first slide. */
  function stored(steps: unknown[]): unknown {
    const deck = deckWith('a');
    return {
      ...deck,
      slides: deck.slides.map((slide, i) => ({ ...slide, animations: i === 0 ? steps : [] })),
    };
  }

  test('Given a deck saved before animations existed, When it is parsed, Then every slide has no steps', () => {
    const deck = deckWith('a');
    const old = {
      ...deck,
      slides: deck.slides.map((slide) => ({
        id: slide.id,
        background: slide.background,
        notes: slide.notes,
        elements: slide.elements,
      })),
    };

    expect(parseDeck(old).slides.map((s) => s.animations)).toEqual([[], []]);
  });

  test('Given a step for an element that is gone, When the deck is parsed, Then that step is dropped and the rest kept', () => {
    const raw = stored([createStep('st1', 'a', 'appear'), createStep('st2', 'gone', 'appear')]);

    expect(parseDeck(raw).slides[0]?.animations.map((s) => s.id)).toEqual(['st1']);
  });

  test('Given odd values in a step, When the deck is parsed, Then they fall back to the defaults instead of losing the deck', () => {
    const raw = stored([
      {
        id: 'st1',
        element: 'a',
        effect: 'appear',
        style: 'spin',
        trigger: 'sometimes',
        duration: 'long',
        delay: 99,
        easing: 'wobble',
      },
    ]);

    expect(parseDeck(raw).slides[0]?.animations[0]).toEqual({
      id: 'st1',
      element: 'a',
      effect: 'appear',
      style: 'fade',
      trigger: 'click',
      duration: DEFAULT_DURATION,
      delay: 5,
      easing: DEFAULT_EASING,
    });
  });

  test('Given a step that is not an object, When the deck is parsed, Then it is refused', () => {
    expect(() => parseDeck(stored(['nonsense']))).toThrow(InvalidDeckError);
  });
});
