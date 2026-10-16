import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { createStep, type Step, type StepEffect, type Trigger } from './animation';
import { createSlide, type Slide } from './deck';
import { clickCount, clickOfStep, clicksOf, playsFor, resolve, stepsOf } from './motion';

const step = (id: string, element: string, effect: StepEffect, trigger: Trigger = 'click'): Step =>
  createStep(id, element, effect, trigger);

const slideWith = (...steps: Step[]): Slide => ({ ...createSlide('s'), animations: steps });
const hiddenAt = (slide: Slide, click: number) => [...resolve(slide, click).hidden].sort();

describe('the motion resolver: what is shown after each click (AN-1, AN-2)', () => {
  // Each row: the steps, then the hidden elements after click 0, 1, 2 and 3.
  test.each<{
    readonly name: string;
    readonly steps: Step[];
    readonly hidden: readonly (readonly string[])[];
  }>([
    {
      name: 'no steps: everything is shown at every click',
      steps: [],
      hidden: [[], [], [], []],
    },
    {
      name: 'Appear first: hidden until its click, then shown',
      steps: [step('1', 'a', 'appear')],
      hidden: [['a'], [], [], []],
    },
    {
      name: 'Disappear first: shown until its click, then hidden',
      steps: [step('1', 'a', 'disappear')],
      hidden: [[], ['a'], ['a'], ['a']],
    },
    {
      name: 'Appear then a later Disappear: shown only between them',
      steps: [step('1', 'a', 'appear'), step('2', 'a', 'disappear')],
      hidden: [['a'], [], ['a'], ['a']],
    },
    {
      name: 'Disappear then Appear: shown, gone, shown again',
      steps: [step('1', 'a', 'disappear'), step('2', 'a', 'appear')],
      hidden: [[], ['a'], [], []],
    },
    {
      name: 'two elements in one click: With previous plays on the same click',
      steps: [step('1', 'a', 'appear'), step('2', 'b', 'appear', 'with-previous')],
      hidden: [['a', 'b'], [], [], []],
    },
    {
      name: 'one click each, in the order of the list',
      steps: [step('1', 'a', 'appear'), step('2', 'b', 'appear'), step('3', 'c', 'appear')],
      hidden: [['a', 'b', 'c'], ['b', 'c'], ['c'], []],
    },
    {
      name: 'a With previous step first still makes the first click',
      steps: [step('1', 'a', 'appear', 'with-previous'), step('2', 'b', 'appear')],
      hidden: [['a', 'b'], ['b'], [], []],
    },
    {
      name: 'another element is not touched by an element that disappears',
      steps: [step('1', 'a', 'disappear'), step('2', 'b', 'appear')],
      hidden: [['b'], ['a', 'b'], ['a'], ['a']],
    },
  ])('Given $name', ({ steps, hidden }) => {
    const slide = slideWith(...steps);

    expect([0, 1, 2, 3].map((click) => hiddenAt(slide, click))).toEqual(hidden);
  });

  test('Given a click beyond the last, When it is resolved, Then the last state holds; a negative click is the start', () => {
    const slide = slideWith(step('1', 'a', 'appear'));

    expect(hiddenAt(slide, 99)).toEqual([]);
    expect(hiddenAt(slide, -3)).toEqual(['a']);
  });
});

describe('clicks and plays (AN-5)', () => {
  const steps = [
    step('1', 'a', 'appear'),
    step('2', 'b', 'appear', 'with-previous'),
    step('3', 'c', 'disappear'),
    step('4', 'd', 'appear', 'with-previous'),
    step('5', 'e', 'appear', 'with-previous'),
  ];

  test('Given five steps, When they are grouped, Then each On click step starts a click and the rest join it', () => {
    const clicks = clicksOf(steps).map((click) => click.map((s) => s.id));

    expect(clicks).toEqual([
      ['1', '2'],
      ['3', '4', '5'],
    ]);
    expect(clickCount(slideWith(...steps))).toBe(2);
  });

  test("Given a click number from 1, When its plays are asked for, Then they are that click's steps; no such click plays nothing", () => {
    const slide = slideWith(...steps);

    expect(playsFor(slide, 2).map((s) => s.id)).toEqual(['3', '4', '5']);
    expect(playsFor(slide, 0)).toEqual([]);
    expect(playsFor(slide, 3)).toEqual([]);
  });

  test('Given each step of the list, When its click is asked for, Then it is the click it plays on', () => {
    expect(steps.map((_, i) => clickOfStep(steps, i))).toEqual([1, 1, 2, 2, 2]);
    expect(clickOfStep(steps, 9)).toBe(0);
  });

  test('Given steps for several elements, When one element is asked for, Then only its steps come back, in order', () => {
    const slide = slideWith(
      step('1', 'a', 'appear'),
      step('2', 'b', 'appear'),
      step('3', 'a', 'disappear'),
    );

    expect(stepsOf(slide, 'a').map((s) => s.id)).toEqual(['1', '3']);
    expect(stepsOf(slide, 'zzz')).toEqual([]);
  });
});

describe('any list of steps (property)', () => {
  const effects = fc.constantFrom<StepEffect>('appear', 'disappear');
  const triggers = fc.constantFrom<Trigger>('click', 'with-previous');
  const lists = fc.array(
    fc.record({
      element: fc.constantFrom('a', 'b', 'c', 'd'),
      effect: effects,
      trigger: triggers,
    }),
    { maxLength: 14 },
  );
  const build = (list: readonly { element: string; effect: StepEffect; trigger: Trigger }[]) =>
    list.map((s, i) => step(String(i), s.element, s.effect, s.trigger));

  test('Given any steps, When all clicks have played, Then an element is hidden exactly when its last step is a Disappear', () => {
    fc.assert(
      fc.property(lists, (list) => {
        const steps = build(list);
        const slide = slideWith(...steps);
        const hidden = resolve(slide, clickCount(slide)).hidden;

        for (const id of ['a', 'b', 'c', 'd']) {
          const mine = steps.filter((s) => s.element === id);
          const last = mine[mine.length - 1];
          expect(hidden.has(id)).toBe(last?.effect === 'disappear');
        }
      }),
    );
  });

  test('Given any steps, When the slide opens, Then exactly the elements whose first step is Appear are hidden', () => {
    fc.assert(
      fc.property(lists, (list) => {
        const steps = build(list);
        const hidden = resolve(slideWith(...steps), 0).hidden;

        for (const id of ['a', 'b', 'c', 'd']) {
          const first = steps.find((s) => s.element === id);
          expect(hidden.has(id)).toBe(first?.effect === 'appear');
        }
      }),
    );
  });

  test('Given any steps, When they are grouped into clicks, Then the groups hold every step once, in the same order', () => {
    fc.assert(
      fc.property(lists, (list) => {
        const steps = build(list);
        const flat = clicksOf(steps).flat();

        expect(flat).toEqual(steps);
        for (const [i, click] of clicksOf(steps).entries()) {
          if (i > 0) expect(click[0]?.trigger).toBe('click');
        }
      }),
    );
  });

  test('Given any steps, When one click plays, Then only elements with a step in that click change', () => {
    fc.assert(
      fc.property(lists, (list) => {
        const slide = slideWith(...build(list));

        for (let click = 1; click <= clickCount(slide); click++) {
          const before = resolve(slide, click - 1).hidden;
          const after = resolve(slide, click).hidden;
          const touched = new Set(playsFor(slide, click).map((s) => s.element));
          for (const id of ['a', 'b', 'c', 'd']) {
            if (before.has(id) !== after.has(id)) expect(touched.has(id)).toBe(true);
          }
        }
      }),
    );
  });
});

describe('Move in the resolver (AN-3)', () => {
  const move = (
    id: string,
    element: string,
    x: number,
    y: number,
    trigger: Trigger = 'click',
  ): Step => createStep(id, element, 'move', trigger, { x, y });
  const where = (slide: Slide, click: number, element: string) =>
    resolve(slide, click).positions.get(element);

  test('Given a Move, When the slide opens, Then the element is at its own place (not in the positions)', () => {
    const slide = slideWith(move('1', 'a', 500, 300));

    expect(where(slide, 0, 'a')).toBeUndefined();
    expect(where(slide, 1, 'a')).toEqual({ x: 500, y: 300 });
  });

  test('Given a Move, When later clicks play, Then the element stays where it ended', () => {
    const slide = slideWith(move('1', 'a', 500, 300), step('2', 'b', 'appear'));

    expect(where(slide, 2, 'a')).toEqual({ x: 500, y: 300 });
  });

  test('Given two Moves of one element, When the second plays, Then it ends at the second place, and is at the first before it', () => {
    const slide = slideWith(move('1', 'a', 500, 300), move('2', 'a', 900, 100));

    expect(where(slide, 1, 'a')).toEqual({ x: 500, y: 300 });
    expect(where(slide, 2, 'a')).toEqual({ x: 900, y: 100 });
  });

  test('Given a Move and an Appear for one element, Then the Move does not decide whether it starts hidden', () => {
    const slide = slideWith(move('1', 'a', 500, 300), step('2', 'a', 'appear'));

    expect(hiddenAt(slide, 0)).toEqual(['a']);
    expect(hiddenAt(slide, 1)).toEqual(['a']);
    expect(hiddenAt(slide, 2)).toEqual([]);
    expect(where(slide, 2, 'a')).toEqual({ x: 500, y: 300 });
  });

  test('Given a Move and a Disappear in one click, Then it both ends hidden and has moved', () => {
    const slide = slideWith(step('1', 'a', 'disappear'), move('2', 'a', 10, 20, 'with-previous'));

    expect(hiddenAt(slide, 1)).toEqual(['a']);
    expect(where(slide, 1, 'a')).toEqual({ x: 10, y: 20 });
  });

  test('Given any run of Moves, When all clicks have played, Then each element is at the end of its last Move', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            element: fc.constantFrom('a', 'b', 'c'),
            x: fc.integer({ min: -500, max: 2500 }),
            y: fc.integer({ min: -500, max: 1500 }),
            trigger: fc.constantFrom<Trigger>('click', 'with-previous'),
          }),
          { maxLength: 12 },
        ),
        (list) => {
          const steps = list.map((m, i) => move(String(i), m.element, m.x, m.y, m.trigger));
          const slide = slideWith(...steps);
          const state = resolve(slide, clickCount(slide));

          for (const id of ['a', 'b', 'c']) {
            const mine = steps.filter((s) => s.element === id);
            const last = mine[mine.length - 1];
            const at = state.positions.get(id);
            if (last?.effect === 'move') expect(at).toEqual({ x: last.x, y: last.y });
            else expect(at).toBeUndefined();
          }
        },
      ),
    );
  });
});
