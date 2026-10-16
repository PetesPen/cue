import type { Slide } from './deck';
import type { Id } from './elements';
import type { Step } from './animation';

/**
 * The motion resolver (AN-1, AN-2): a pure function from a slide and a click to what is shown. No
 * DOM, so it carries the table and property tests, and stepping back is "resolve the click before".
 * The Web Animations API plays the difference between two clicks (`render`).
 */

/** What is true of the slide after some number of clicks. */
export interface SlideState {
  /** Elements that are not shown. Everything else on the slide is. */
  readonly hidden: ReadonlySet<Id>;
}

/**
 * The steps grouped by click, in play order. A click starts at each On click step; a With previous
 * step joins the click before it. The first step always starts the first click, whatever its trigger.
 */
export function clicksOf(steps: readonly Step[]): readonly (readonly Step[])[] {
  const clicks: Step[][] = [];
  for (const step of steps) {
    const last = clicks[clicks.length - 1];
    if (last === undefined || step.trigger === 'click') clicks.push([step]);
    else last.push(step);
  }
  return clicks;
}

/** How many clicks a slide's steps need. */
export function clickCount(slide: Slide): number {
  return clicksOf(slide.animations).length;
}

/** The step's click number, from 1, in the order of the list. */
export function clickOfStep(steps: readonly Step[], index: number): number {
  let click = 0;
  for (const [i, step] of steps.entries()) {
    if (i === 0 || step.trigger === 'click') click += 1;
    if (i === index) return click;
  }
  return 0;
}

/** Elements that begin hidden: those whose first step is Appear. */
function startingHidden(steps: readonly Step[]): Set<Id> {
  const seen = new Set<Id>();
  const hidden = new Set<Id>();
  for (const step of steps) {
    if (seen.has(step.element)) continue;
    seen.add(step.element);
    if (step.effect === 'appear') hidden.add(step.element);
  }
  return hidden;
}

/**
 * What is shown after `click` clicks have played (0: the slide as it opens). A later step overrides an
 * earlier one for the same element, so the state after the last click depends only on each element's
 * last step.
 */
export function resolve(slide: Slide, click: number): SlideState {
  const hidden = startingHidden(slide.animations);
  const played = clicksOf(slide.animations).slice(0, Math.max(0, click));
  for (const steps of played) {
    for (const step of steps) {
      if (step.effect === 'appear') hidden.delete(step.element);
      else hidden.add(step.element);
    }
  }
  return { hidden };
}

/** The steps that play on click `click` (from 1): none when there is no such click. */
export function playsFor(slide: Slide, click: number): readonly Step[] {
  return clicksOf(slide.animations)[click - 1] ?? [];
}

/** The steps of one element, in play order. */
export function stepsOf(slide: Slide, element: Id): readonly Step[] {
  return slide.animations.filter((step) => step.element === element);
}
