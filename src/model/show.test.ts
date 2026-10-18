import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { createStep, type Step } from './animation';
import { createDeck, createSlide, type Deck, type Slide, type Env } from './deck';
import {
  back,
  clampPlace,
  forward,
  jumpTo,
  movement,
  startShow,
  toEnd,
  toggleBlank,
  toStart,
  upcoming,
  upcomingLabel,
  type ShowPlace,
} from './show';
import { changeTransition, DEFAULT_TRANSITION, type TransitionKind } from './transition';

const env: Env = { newId: () => 'id', now: () => 0 };

/** A slide with `clicks` clicks of one step each, and a transition into it. */
function slide(id: string, clicks = 0, kind: TransitionKind = 'none'): Slide {
  const animations: Step[] = Array.from({ length: clicks }, (_, i) =>
    createStep(`${id}-${String(i)}`, `${id}-e${String(i)}`, 'appear', 'click'),
  );
  return {
    ...createSlide(id),
    animations,
    transition: changeTransition(DEFAULT_TRANSITION, { kind }),
  };
}

const deckOf = (...slides: Slide[]): Deck => ({ ...createDeck(env), slides });
const at = (slide: number, click = 0, blank: ShowPlace['blank'] = 'none'): ShowPlace => ({
  slide,
  click,
  blank,
});

// Slide 0 has no clicks, slide 1 has two, slide 2 has none, slide 3 has one.
const talk = deckOf(
  slide('a'),
  slide('b', 2, 'slide'),
  slide('c', 0, 'zoom'),
  slide('d', 1, 'fade'),
);

describe('forward: one click, then the next slide (PM-6)', () => {
  test.each<{ readonly name: string; readonly from: ShowPlace; readonly to: ShowPlace }>([
    { name: 'a slide with no clicks goes to the next slide', from: at(0), to: at(1) },
    { name: 'a slide with clicks plays the first', from: at(1), to: at(1, 1) },
    { name: 'then the second', from: at(1, 1), to: at(1, 2) },
    { name: 'then the next slide, as it opens', from: at(1, 2), to: at(2) },
    { name: 'the last slide with a click left plays it', from: at(3), to: at(3, 1) },
    { name: 'the end of the last slide stays where it is', from: at(3, 1), to: at(3, 1) },
    { name: 'a blank screen only comes back', from: at(1, 1, 'black'), to: at(1, 1) },
    { name: 'a white screen only comes back', from: at(0, 0, 'white'), to: at(0) },
  ])('Given $name', ({ from, to }) => {
    expect(forward(talk, from)).toEqual(to);
  });

  test('Given a deck of one slide with no clicks, When forward is pressed, Then it stays', () => {
    const one = deckOf(slide('only'));

    expect(forward(one, startShow(one))).toEqual(at(0));
  });
});

describe('back: one click, then the slide before as it was left (PM-6)', () => {
  test.each<{ readonly name: string; readonly from: ShowPlace; readonly to: ShowPlace }>([
    { name: 'a click played goes back one click', from: at(1, 2), to: at(1, 1) },
    { name: 'the first click goes back to the slide as it opens', from: at(1, 1), to: at(1) },
    {
      name: 'a slide as it opens goes back to the one before, all its clicks played',
      from: at(2),
      to: at(1, 2),
    },
    { name: 'and one with no clicks to its only state', from: at(1), to: at(0) },
    { name: 'the very start stays', from: at(0), to: at(0) },
    { name: 'a blank screen only comes back', from: at(2, 0, 'black'), to: at(2) },
  ])('Given $name', ({ from, to }) => {
    expect(back(talk, from)).toEqual(to);
  });
});

describe('jumps, blanks and the places of a deck', () => {
  test('Given any slide number, When jumped to, Then it is that slide as it opens, and out of range numbers are the nearest slide', () => {
    expect(jumpTo(talk, 2)).toEqual(at(2));
    expect(jumpTo(talk, -5)).toEqual(at(0));
    expect(jumpTo(talk, 99)).toEqual(at(3));
    expect(jumpTo(talk, Number.NaN)).toEqual(at(0));
    expect(jumpTo(talk, 1.9)).toEqual(at(1));
  });

  test('Given a show, When Home or End is pressed, Then it is the first or the last slide as it opens', () => {
    expect(toStart(talk)).toEqual(at(0));
    expect(toEnd(talk)).toEqual(at(3));
  });

  test('Given the screen, When B or W is pressed, Then it blanks, and the same key brings the slide back', () => {
    const shown = at(1, 1);

    const black = toggleBlank(shown, 'black');
    expect(black).toEqual(at(1, 1, 'black'));
    expect(toggleBlank(black, 'black')).toEqual(shown);
    // The other colour switches rather than clearing.
    expect(toggleBlank(black, 'white')).toEqual(at(1, 1, 'white'));
  });

  test('Given a place past the deck or its clicks, When it is clamped, Then it is the nearest place that exists', () => {
    expect(clampPlace(talk, at(9, 9))).toEqual(at(3, 1));
    expect(clampPlace(talk, at(1, 7, 'black'))).toEqual(at(1, 2, 'black'));
    expect(clampPlace(talk, at(-1, -1))).toEqual(at(0));
    expect(clampPlace(talk, at(1, 1))).toEqual(at(1, 1));
  });

  test('Given a deck with no slides, When a place is made, Then it is the first slide and nothing throws', () => {
    const empty = deckOf();

    expect(startShow(empty)).toEqual(at(0));
    expect(forward(empty, at(0))).toEqual(at(0));
    expect(back(empty, at(0))).toEqual(at(0));
    expect(upcoming(empty, at(0))).toEqual({ kind: 'end' });
  });
});

describe('upcoming: what the next press shows (PM-5)', () => {
  test.each<{
    readonly name: string;
    readonly from: ShowPlace;
    readonly next: ReturnType<typeof upcoming>;
  }>([
    {
      name: 'clicks left: the next click',
      from: at(1),
      next: { kind: 'click', slide: 1, click: 1 },
    },
    { name: 'the last click: the next slide', from: at(1, 2), next: { kind: 'slide', slide: 2 } },
    {
      name: 'a slide with no clicks: the next slide',
      from: at(0),
      next: { kind: 'slide', slide: 1 },
    },
    { name: 'the end of the last slide: the end', from: at(3, 1), next: { kind: 'end' } },
  ])('Given $name', ({ from, next }) => {
    expect(upcoming(talk, from)).toEqual(next);
  });
});

describe('upcomingLabel: the words for the next press (PM-5)', () => {
  test.each<[string, ShowPlace, string]>([
    ['clicks left', at(1), 'Next · Click 1 of 2'],
    ['the last click', at(1, 1), 'Next · Click 2 of 2'],
    ['all clicks played', at(1, 2), 'Next · Slide 3'],
    ['a slide with no clicks', at(0), 'Next · Slide 2'],
    ['the end of the last slide', at(3, 1), 'Next'],
  ])('Given %s, Then the label is %j', (_name, from, label) => {
    expect(upcomingLabel(talk, from)).toBe(label);
  });
});

describe('movement: how one place gives way to another (TN-5, AN-7)', () => {
  test('Given the same place, When it is compared, Then nothing moves', () => {
    expect(movement(talk, at(1, 1), at(1, 1))).toEqual({ kind: 'still' });
  });

  test('Given a click forward on a slide, Then that click plays', () => {
    expect(movement(talk, at(1), at(1, 1))).toEqual({ kind: 'click', slide: 1, click: 1 });
  });

  test('Given a step back or a skip of clicks, Then it is shown at once (AN-7)', () => {
    expect(movement(talk, at(1, 2), at(1, 1))).toEqual({ kind: 'cut' });
    expect(movement(talk, at(1), at(1, 2))).toEqual({ kind: 'cut' });
  });

  test('Given the next slide with a transition, When it arrives, Then its own transition plays forward', () => {
    expect(movement(talk, at(0), at(1))).toEqual({
      kind: 'transition',
      transition: talk.slides[1]?.transition,
      reversed: false,
    });
    expect(movement(talk, at(1, 2), at(2))).toMatchObject({
      kind: 'transition',
      transition: { kind: 'zoom' },
      reversed: false,
    });
  });

  test('Given the next slide with no transition, When it arrives, Then it is a cut', () => {
    expect(movement(talk, at(3), at(3, 1))).toEqual({ kind: 'click', slide: 3, click: 1 });
    expect(movement(deckOf(slide('a'), slide('b')), at(0), at(1))).toEqual({ kind: 'cut' });
  });

  test('Given a step back to the slide before, Then the transition of the slide being left plays reversed', () => {
    expect(movement(talk, at(2), at(1, 2))).toMatchObject({
      kind: 'transition',
      transition: { kind: 'fade' },
      reversed: true,
    });
    expect(movement(talk, at(1), at(0))).toMatchObject({
      kind: 'transition',
      transition: { kind: 'slide' },
      reversed: true,
    });
  });

  test('Given Zoom reversed, Then it is a plain fade of the same length', () => {
    const quick = deckOf(slide('a'), {
      ...slide('b'),
      transition: changeTransition(DEFAULT_TRANSITION, { kind: 'zoom', duration: 1.4 }),
    });

    expect(movement(quick, at(1), at(0))).toEqual({
      kind: 'transition',
      transition: { kind: 'fade', from: 'right', duration: 1.4 },
      reversed: true,
    });
  });

  test('Given a jump past a neighbour, or while blanked, Then it is shown at once', () => {
    expect(movement(talk, at(0), at(2))).toEqual({ kind: 'cut' });
    expect(movement(talk, at(3), at(1))).toEqual({ kind: 'cut' });
    expect(movement(talk, at(1), at(1, 0, 'black'))).toEqual({ kind: 'still' });
    expect(movement(talk, at(1, 0, 'black'), at(2))).toEqual({ kind: 'cut' });
  });

  test('Given a back step that lands part way through the slide before, Then it is shown at once', () => {
    // Going back from the middle of a slide goes click by click, never to another slide.
    expect(movement(talk, at(2, 0), at(1, 1))).toEqual({ kind: 'cut' });
  });
});

describe('properties of the moves', () => {
  const decks = fc
    .array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 6 })
    .map((clicks) => deckOf(...clicks.map((n, i) => slide(`s${String(i)}`, n))));
  const places = (deck: Deck) =>
    fc.record({
      slide: fc.integer({ min: 0, max: deck.slides.length - 1 }),
      click: fc.integer({ min: 0, max: 3 }),
      blank: fc.constantFrom<ShowPlace['blank']>('none', 'black', 'white'),
    });

  test('Given any deck and place, When forward is pressed enough times, Then the show ends at the last click of the last slide and never leaves the deck', () => {
    fc.assert(
      fc.property(decks, (deck) => {
        let place = startShow(deck);
        for (let press = 0; press < 40; press += 1) {
          const next = forward(deck, place);
          expect(next).toEqual(clampPlace(deck, next));
          place = next;
        }
        const last = deck.slides.length - 1;
        expect(place.slide).toBe(last);
        expect(place.click).toBe(deck.slides[last]?.animations.length);
      }),
    );
  });

  test('Given any place not blanked, When forward then back, Then it returns, except at the end where forward stays', () => {
    fc.assert(
      fc.property(
        decks.chain((deck) => fc.tuple(fc.constant(deck), places(deck))),
        ([deck, raw]) => {
          const place = clampPlace(deck, { ...raw, blank: 'none' });
          const next = forward(deck, place);

          if (next === place) return;
          // Going forward over a slide boundary and back lands on the last click of the slide left, which is
          // where it was only if it was on its last click already (it was: forward crosses only from there).
          expect(back(deck, next)).toEqual(place);
        },
      ),
    );
  });

  test('Given any two places, When the movement is asked, Then a click is only ever one more click on the same slide', () => {
    fc.assert(
      fc.property(
        decks.chain((deck) => fc.tuple(fc.constant(deck), places(deck), places(deck))),
        ([deck, a, b]) => {
          const from = clampPlace(deck, a);
          const to = clampPlace(deck, b);
          const move = movement(deck, from, to);

          if (move.kind === 'click') {
            expect(to.slide).toBe(from.slide);
            expect(to.click).toBe(from.click + 1);
          }
          if (move.kind === 'transition') expect(Math.abs(to.slide - from.slide)).toBe(1);
          if (move.kind === 'still') expect([to.slide, to.click]).toEqual([from.slide, from.click]);
        },
      ),
    );
  });
});
