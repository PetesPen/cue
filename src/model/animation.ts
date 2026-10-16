import { SLIDE_HEIGHT, SLIDE_WIDTH } from './deck';
import type { Id } from './elements';

/**
 * Animation steps (AN-1, AN-2, AN-3, AN-4, AN-5). A slide holds one ordered list of them; clicks are
 * derived from it (see `motion.ts`): a new click starts at each On click step, and a With previous
 * step plays along with the click before it.
 */

export const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;
export type Easing = (typeof EASINGS)[number];

export const TRIGGERS = ['click', 'with-previous'] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const APPEAR_STYLES = ['instant', 'fade', 'rise'] as const;
export type AppearStyle = (typeof APPEAR_STYLES)[number];

export const DISAPPEAR_STYLES = ['instant', 'fade'] as const;
export type DisappearStyle = (typeof DISAPPEAR_STYLES)[number];

export const MIN_DURATION = 0.1;
export const MAX_DURATION = 5;
export const MAX_DELAY = 5;
/** Sensible defaults mean most steps need no tuning (AN-4). */
export const DEFAULT_DURATION = 0.5;
export const DEFAULT_DELAY = 0;
export const DEFAULT_EASING: Easing = 'ease-out';
export const DEFAULT_APPEAR_STYLE: AppearStyle = 'fade';
export const DEFAULT_DISAPPEAR_STYLE: DisappearStyle = 'fade';

/** A new Move step starts with its end this far to the right and down of the element (AN-3). */
export const DEFAULT_MOVE_OFFSET = { x: 160, y: 80 } as const;

interface StepBase {
  readonly id: Id;
  /** The element this step plays on. */
  readonly element: Id;
  readonly trigger: Trigger;
  /** Seconds. */
  readonly duration: number;
  /** Seconds, from the start of the click. */
  readonly delay: number;
  readonly easing: Easing;
}

export interface AppearStep extends StepBase {
  readonly effect: 'appear';
  readonly style: AppearStyle;
}

export interface DisappearStep extends StepBase {
  readonly effect: 'disappear';
  readonly style: DisappearStyle;
}

/**
 * Move an element to a new place (AN-3): `x` and `y` are where its top left ends, in slide pixels. They
 * do not depend on where the element starts, so moving the element later changes the path, not the end.
 * Position only: size and turn do not change.
 */
export interface MoveStep extends StepBase {
  readonly effect: 'move';
  readonly x: number;
  readonly y: number;
}

export type Step = AppearStep | DisappearStep | MoveStep;
export type StepEffect = Step['effect'];

/** What can be changed about a step. Timing is clamped; a style that does not fit the effect is reset. */
export interface StepChange {
  readonly effect?: StepEffect;
  readonly style?: string;
  readonly trigger?: Trigger;
  readonly duration?: number;
  readonly delay?: number;
  readonly easing?: Easing;
  /** Where a Move ends. */
  readonly x?: number;
  readonly y?: number;
}

/** The box of an element, for working out where a new Move should end. */
export interface Place {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const tenths = (value: number) => Math.round(value * 10) / 10;

/** Durations run from 0.1 to 5 seconds and delays from 0 to 5, in tenths (AN-4). */
export function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_DURATION;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, tenths(seconds)));
}

export function clampDelay(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_DELAY;
  return Math.min(MAX_DELAY, Math.max(0, tenths(seconds)));
}

export function isAppearStyle(value: unknown): value is AppearStyle {
  return APPEAR_STYLES.some((style) => style === value);
}

export function isDisappearStyle(value: unknown): value is DisappearStyle {
  return DISAPPEAR_STYLES.some((style) => style === value);
}

export function isEasing(value: unknown): value is Easing {
  return EASINGS.some((easing) => easing === value);
}

export function isTrigger(value: unknown): value is Trigger {
  return TRIGGERS.some((trigger) => trigger === value);
}

export function isStepEffect(value: unknown): value is StepEffect {
  return value === 'appear' || value === 'disappear' || value === 'move';
}

/** Where a new Move ends: a little to the right and down of the element, kept inside the slide. */
export function defaultMoveEnd(place: Place): { readonly x: number; readonly y: number } {
  const room = (limit: number, size: number, start: number, by: number) =>
    Math.max(0, Math.min(start + by, limit - size));
  return {
    x: room(SLIDE_WIDTH, place.width, place.x, DEFAULT_MOVE_OFFSET.x),
    y: room(SLIDE_HEIGHT, place.height, place.y, DEFAULT_MOVE_OFFSET.y),
  };
}

/** Positions are kept to a hundredth of a pixel, and never lost to a stray value. */
function position(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.round(value * 100) / 100 : fallback;
}

/**
 * A new step with the defaults: 0.5 s, no delay, ease out (AN-4). A Move needs its end (`end`); it
 * is the origin when none is given.
 */
export function createStep(
  id: Id,
  element: Id,
  effect: StepEffect,
  trigger: Trigger = 'click',
  end: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
): Step {
  const base = {
    id,
    element,
    trigger,
    duration: DEFAULT_DURATION,
    delay: DEFAULT_DELAY,
    easing: DEFAULT_EASING,
  };
  if (effect === 'appear') return { ...base, effect, style: DEFAULT_APPEAR_STYLE };
  if (effect === 'disappear') return { ...base, effect, style: DEFAULT_DISAPPEAR_STYLE };
  return { ...base, effect, x: position(end.x, 0), y: position(end.y, 0) };
}

/**
 * The step with `change` applied. Changing the effect gives the new effect's default style, or, for a
 * Move, an end a little beside the element (`place`) unless the change says where.
 */
export function changeStep(step: Step, change: StepChange, place?: Place): Step {
  const effect = change.effect ?? step.effect;
  const base = {
    id: step.id,
    element: step.element,
    trigger: change.trigger ?? step.trigger,
    duration: clampDuration(change.duration ?? step.duration),
    delay: clampDelay(change.delay ?? step.delay),
    easing: change.easing ?? step.easing,
  };
  if (effect === 'move') {
    const from =
      step.effect === 'move'
        ? { x: step.x, y: step.y }
        : place
          ? defaultMoveEnd(place)
          : { x: 0, y: 0 };
    return { ...base, effect, x: position(change.x, from.x), y: position(change.y, from.y) };
  }
  const wanted =
    change.style ?? (effect === step.effect && 'style' in step ? step.style : undefined);
  if (effect === 'appear') {
    return { ...base, effect, style: isAppearStyle(wanted) ? wanted : DEFAULT_APPEAR_STYLE };
  }
  return { ...base, effect, style: isDisappearStyle(wanted) ? wanted : DEFAULT_DISAPPEAR_STYLE };
}
