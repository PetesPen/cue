import {
  playsFor,
  resolve,
  type Id,
  type Slide,
  type SlideElement,
  type Step,
} from '@/model';

/**
 * The motion engine (AN-1, AN-2, AN-3, TR-3): the pure resolver in `model` says what is shown at a
 * click; this plays the difference between two clicks with the Web Animations API, using only
 * `opacity` and `transform`. Whatever happens to an animation, the slide's own static state is
 * already the end state, so a cancelled or interrupted play can never leave an element in the wrong
 * place.
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
const NOWHERE: ReadonlyMap<Id, Spot> = new Map();

interface Spot {
  readonly x: number;
  readonly y: number;
}

/** What a look changes: elements it hides (opacity 0), elements it only fades, and elements it moves. */
export interface LookSets {
  readonly hidden: ReadonlySet<Id>;
  readonly faded: ReadonlySet<Id>;
  readonly positions: ReadonlyMap<Id, Spot>;
}

export function lookSets(slide: Slide, look: Look): LookSets {
  if (look.mode === 'plain' || slide.animations.length === 0) {
    return { hidden: NOBODY, faded: NOBODY, positions: NOWHERE };
  }
  if (look.mode === 'editing') {
    return { hidden: NOBODY, faded: resolve(slide, 0).hidden, positions: NOWHERE };
  }
  const state = resolve(slide, look.click);
  return { hidden: state.hidden, faded: NOBODY, positions: state.positions };
}

/** The opacity an element is drawn at in a look: its own, faded, or nothing (TR-3). */
export function drawnOpacity(base: number, id: Id, sets: LookSets): number {
  if (sets.hidden.has(id)) return 0;
  return sets.faded.has(id) ? base * EDITING_FADE : base;
}

/**
 * The transform of an element: its turn, and, when an animation has moved it, a shift from its own
 * place to `at` (AN-3). The shift comes first, so the element still turns about its own centre.
 */
export function drawnTransform(
  element: { readonly x: number; readonly y: number; readonly rotation: number },
  at?: Spot,
): string {
  const turn = element.rotation === 0 ? '' : `rotate(${String(element.rotation)}deg)`;
  if (!at || (at.x === element.x && at.y === element.y)) return turn;
  const shift = `translate(${String(at.x - element.x)}px, ${String(at.y - element.y)}px)`;
  return turn === '' ? shift : `${shift} ${turn}`;
}

const EASING: Record<Step['easing'], string> = {
  linear: 'linear',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
};

/** An instant change happens at its delay: a one-millisecond animation that jumps when it ends. */
const JUMP = 'steps(1, end)';

function keyframesFor(
  step: Step,
  element: SlideElement,
  transform: string,
  before: Spot | undefined,
): Keyframe[] {
  const still = transform === '' ? 'none' : transform;
  if (step.effect === 'move') {
    const from = before ?? { x: element.x, y: element.y };
    const shown = (at: Spot) => drawnTransform(element, at) || 'none';
    return [{ transform: shown(from) }, { transform: shown({ x: step.x, y: step.y }) }];
  }
  if (step.effect === 'appear') {
    const from: Keyframe = { opacity: 0 };
    const to: Keyframe = { opacity: element.opacity };
    if (step.style === 'rise') {
      from.transform = `translateY(${String(RISE_DISTANCE)}px) ${transform}`.trim();
      to.transform = still;
    }
    return [from, to];
  }
  return [{ opacity: element.opacity }, { opacity: 0 }];
}

/**
 * Play click `click` of `slide`: one animation for each step on it, all starting together, each with
 * its own delay, duration and easing. Call it after the slide has been drawn in the state AFTER the
 * click; an animation only shows the way there (it fills backwards, so a delayed step still shows its
 * starting state while it waits). A Move starts from where the click before left the element. Returns
 * the animations, so they can be cancelled.
 */
export function playClick(
  slide: Slide,
  click: number,
  nodeFor: (id: Id) => HTMLElement | undefined,
): Animation[] {
  const animations: Animation[] = [];
  const earlier = resolve(slide, click - 1).positions;
  for (const step of playsFor(slide, click)) {
    const node = nodeFor(step.element);
    const element = slide.elements.find((e) => e.id === step.element);
    if (!node || !element) continue;
    const instant = step.effect !== 'move' && step.style === 'instant';
    // An instant step with no delay is just the end state, which is already drawn.
    if (instant && step.delay === 0) continue;
    animations.push(
      node.animate(keyframesFor(step, element, node.style.transform, earlier.get(step.element)), {
        duration: instant ? 1 : step.duration * 1000,
        delay: step.delay * 1000,
        easing: instant ? JUMP : EASING[step.easing],
        fill: 'backwards',
      }),
    );
  }
  return animations;
}
