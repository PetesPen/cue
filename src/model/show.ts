import type { Deck } from './deck';
import { clickCount } from './motion';
import type { Transition } from './transition';

/**
 * Where a show is (PM-1, PM-2, PM-6) and the moves between places: pure, so every edge is a table
 * test. A place is the slide, the click on it and whether the screen is blanked; the two windows of a
 * show pass nothing but a place to each other (PM-3), and each draws it from the stored deck.
 */

/** The screen the audience sees instead of the slide: black (B) or white (W). */
export type Blank = 'none' | 'black' | 'white';

export interface ShowPlace {
  /** The index of the slide in the deck, from 0. */
  readonly slide: number;
  /** How many clicks of its steps have played, from 0 (the slide as it opens). */
  readonly click: number;
  readonly blank: Blank;
}

/** The place a show starts at: the slide as it opens (Present: slide 1; from current slide: this one). */
export function startShow(deck: Deck, slide = 0): ShowPlace {
  return { slide: clampIndex(deck, slide), click: 0, blank: 'none' };
}

/** A place that exists in the deck: a stray slide or click is brought to the nearest one that does. */
export function clampPlace(deck: Deck, place: ShowPlace): ShowPlace {
  const slide = clampIndex(deck, place.slide);
  const clicks = clicksAt(deck, slide);
  const click = Math.min(clicks, Math.max(0, Math.trunc(place.click)));
  return { slide, click, blank: place.blank };
}

/**
 * Forward by one: the next click of this slide, then the next slide as it opens. At the end it stays.
 * While the screen is blanked, the first press only brings the slide back.
 */
export function forward(deck: Deck, place: ShowPlace): ShowPlace {
  if (place.blank !== 'none') return { ...place, blank: 'none' };
  if (place.click < clicksAt(deck, place.slide)) return { ...place, click: place.click + 1 };
  if (place.slide < lastIndex(deck)) return { slide: place.slide + 1, click: 0, blank: 'none' };
  return place;
}

/**
 * Back by one: the click before, then the slide before in the state it was left (every click played).
 * At the very start it stays. While the screen is blanked, the first press only brings the slide back.
 */
export function back(deck: Deck, place: ShowPlace): ShowPlace {
  if (place.blank !== 'none') return { ...place, blank: 'none' };
  if (place.click > 0) return { ...place, click: place.click - 1 };
  if (place.slide > 0) {
    const slide = place.slide - 1;
    return { slide, click: clicksAt(deck, slide), blank: 'none' };
  }
  return place;
}

/** Jump to a slide, shown as it opens (a number typed, a click on the navigator). */
export function jumpTo(deck: Deck, slide: number): ShowPlace {
  return startShow(deck, slide);
}

/** The first slide as it opens (Home). */
export function toStart(deck: Deck): ShowPlace {
  return startShow(deck, 0);
}

/** The last slide as it opens (End). */
export function toEnd(deck: Deck): ShowPlace {
  return startShow(deck, lastIndex(deck));
}

/** B or W: blank the screen, or bring the slide back when that colour is already showing. */
export function toggleBlank(place: ShowPlace, colour: 'black' | 'white'): ShowPlace {
  return { ...place, blank: place.blank === colour ? 'none' : colour };
}

/** What the next press of "forward" shows, for the preview in the presenter view (PM-5). */
export type Upcoming =
  | { readonly kind: 'click'; readonly slide: number; readonly click: number }
  | { readonly kind: 'slide'; readonly slide: number }
  | { readonly kind: 'end' };

export function upcoming(deck: Deck, place: ShowPlace): Upcoming {
  if (place.click < clicksAt(deck, place.slide)) {
    return { kind: 'click', slide: place.slide, click: place.click + 1 };
  }
  if (place.slide < lastIndex(deck)) return { kind: 'slide', slide: place.slide + 1 };
  return { kind: 'end' };
}

/** What the next press of "forward" is called in the presenter view and the page's notes (PM-5). */
export function upcomingLabel(deck: Deck, place: ShowPlace): string {
  const next = upcoming(deck, place);
  if (next.kind === 'click') {
    return `Next · Click ${String(next.click)} of ${String(clicksAt(deck, place.slide))}`;
  }
  return next.kind === 'slide' ? `Next · Slide ${String(next.slide + 1)}` : 'Next';
}

/**
 * How one place gives way to another, for the window to play it (TN-5, AN-7).
 *
 * - `still`: nothing moves (the screen was blanked or brought back, or the place did not change).
 * - `click`: the steps of one more click play, on the same slide.
 * - `transition`: the show moved to the next slide (or back to the one before) and its transition
 *   plays: forward, the incoming slide's own; back, the one being left, reversed. Reversed, Zoom has no
 *   sensible reverse and is a plain Fade. A slide whose transition is None is a `cut`.
 * - `cut`: the new place is shown at once: a step back, a jump, a slide that has no transition.
 */
export type Movement =
  | { readonly kind: 'still' }
  | { readonly kind: 'click'; readonly slide: number; readonly click: number }
  | { readonly kind: 'transition'; readonly transition: Transition; readonly reversed: boolean }
  | { readonly kind: 'cut' };

export function movement(deck: Deck, from: ShowPlace, to: ShowPlace): Movement {
  if (from.slide === to.slide && from.click === to.click) return { kind: 'still' };
  if (from.blank !== 'none' || to.blank !== 'none') return { kind: 'cut' };
  if (from.slide === to.slide) {
    return to.click === from.click + 1
      ? { kind: 'click', slide: to.slide, click: to.click }
      : { kind: 'cut' };
  }
  const entered = deck.slides[to.slide];
  const left = deck.slides[from.slide];
  if (
    to.slide === from.slide + 1 &&
    to.click === 0 &&
    entered &&
    entered.transition.kind !== 'none'
  ) {
    return { kind: 'transition', transition: entered.transition, reversed: false };
  }
  const leavesOpening = from.click === 0 && to.click === clicksAt(deck, to.slide);
  if (to.slide === from.slide - 1 && leavesOpening && left && left.transition.kind !== 'none') {
    const transition =
      left.transition.kind === 'zoom'
        ? { ...left.transition, kind: 'fade' as const }
        : left.transition;
    return { kind: 'transition', transition, reversed: true };
  }
  return { kind: 'cut' };
}

function lastIndex(deck: Deck): number {
  return Math.max(0, deck.slides.length - 1);
}

function clampIndex(deck: Deck, slide: number): number {
  return Math.min(lastIndex(deck), Math.max(0, Math.trunc(Number.isFinite(slide) ? slide : 0)));
}

function clicksAt(deck: Deck, slide: number): number {
  const at = deck.slides[slide];
  return at ? clickCount(at) : 0;
}
