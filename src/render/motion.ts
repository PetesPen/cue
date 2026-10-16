import { playsFor, resolve, type Id, type Slide, type Step } from '@/model';

/**
 * The motion engine (AN-1, AN-2, TR-3): the pure resolver in `model` says what is shown at a click;
 * this plays the difference between two clicks with the Web Animations API, using only `opacity` and
 * `transform`. Whatever happens to an animation, the slide's own static state is already the end
 * state, so a cancelled or interrupted play can never leave an element in the wrong place.
 */

/** How a slide's animations show. */
export type Look =
  /** Every element as it is: thumbnails and cards. */
  | { readonly mode: 'plain' }
  /** The editor: elements that begin hidden are drawn faded, so they can still be seen and edited. */
  | { readonly mode: 'editing' }
  /** The state after `click` clicks have played: Preview and the show. */
  | { readonly mode: 'click'; readonly click: number };

export const PLAIN: Look = { mode: 'plain' };
export const EDITING: Look = { mode: 'editing' };

/** Elements that begin hidden are shown at this share of their own opacity in the editor (AN-1). */
export const EDITING_FADE = 0.45;
/** "Fade and rise": the distance an element rises as it appears, in slide pixels. */
export const RISE_DISTANCE = 28;

const NOBODY: ReadonlySet<Id> = new Set();

/** The elements a look hides (their opacity is 0) and the ones it only fades. */
export function lookSets(
  slide: Slide,
  look: Look,
): { readonly hidden: ReadonlySet<Id>; readonly faded: ReadonlySet<Id> } {
  if (look.mode === 'plain' || slide.animations.length === 0) {
    return { hidden: NOBODY, faded: NOBODY };
  }
  if (look.mode === 'editing') return { hidden: NOBODY, faded: resolve(slide, 0).hidden };
  return { hidden: resolve(slide, look.click).hidden, faded: NOBODY };
}

/** The opacity an element is drawn at in a look: its own, faded, or nothing (TR-3). */
export function drawnOpacity(
  base: number,
  id: Id,
  sets: { readonly hidden: ReadonlySet<Id>; readonly faded: ReadonlySet<Id> },
): number {
  if (sets.hidden.has(id)) return 0;
  return sets.faded.has(id) ? base * EDITING_FADE : base;
}

const EASING: Record<Step['easing'], string> = {
  linear: 'linear',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
};

/** An instant change happens at its delay: a one-millisecond animation that jumps when it ends. */
const JUMP = 'steps(1, end)';

function keyframesFor(step: Step, base: number, transform: string): Keyframe[] {
  const still = transform === '' ? 'none' : transform;
  if (step.effect === 'appear') {
    const from: Keyframe = { opacity: 0 };
    const to: Keyframe = { opacity: base };
    if (step.style === 'rise') {
      from.transform = `translateY(${String(RISE_DISTANCE)}px) ${transform}`.trim();
      to.transform = still;
    }
    return [from, to];
  }
  return [{ opacity: base }, { opacity: 0 }];
}

/**
 * Play click `click` of `slide`: one animation for each step on it, all starting together, each with
 * its own delay, duration and easing. Call it after the slide has been drawn in the state AFTER the
 * click; an animation only shows the way there (it fills backwards, so a delayed step still shows its
 * starting state while it waits). Returns the animations, so they can be cancelled.
 */
export function playClick(
  slide: Slide,
  click: number,
  nodeFor: (id: Id) => HTMLElement | undefined,
): Animation[] {
  const animations: Animation[] = [];
  for (const step of playsFor(slide, click)) {
    const node = nodeFor(step.element);
    const element = slide.elements.find((e) => e.id === step.element);
    if (!node || !element) continue;
    const instant = step.style === 'instant';
    // An instant step with no delay is just the end state, which is already drawn.
    if (instant && step.delay === 0) continue;
    animations.push(
      node.animate(keyframesFor(step, element.opacity, node.style.transform), {
        duration: instant ? 1 : step.duration * 1000,
        delay: step.delay * 1000,
        easing: instant ? JUMP : EASING[step.easing],
        fill: 'backwards',
      }),
    );
  }
  return animations;
}
