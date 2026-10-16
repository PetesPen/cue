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
