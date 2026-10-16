import type { Id } from './elements';

/**
 * Animation steps (AN-1, AN-2, AN-4, AN-5). A slide holds one ordered list of them; clicks are derived
 * from it (see `motion.ts`): a new click starts at each On click step, and a With previous step plays
 * along with the click before it.
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

export type Step = AppearStep | DisappearStep;
export type StepEffect = Step['effect'];

/** What can be changed about a step. Timing is clamped; a style that does not fit the effect is reset. */
export interface StepChange {
  readonly effect?: StepEffect;
  readonly style?: string;
  readonly trigger?: Trigger;
  readonly duration?: number;
  readonly delay?: number;
  readonly easing?: Easing;
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
  return value === 'appear' || value === 'disappear';
}

/** A new step with the defaults: 0.5 s, no delay, ease out (AN-4). */
export function createStep(
  id: Id,
  element: Id,
  effect: StepEffect,
  trigger: Trigger = 'click',
): Step {
  const base = {
    id,
    element,
    trigger,
    duration: DEFAULT_DURATION,
    delay: DEFAULT_DELAY,
    easing: DEFAULT_EASING,
  };
  return effect === 'appear'
    ? { ...base, effect, style: DEFAULT_APPEAR_STYLE }
    : { ...base, effect, style: DEFAULT_DISAPPEAR_STYLE };
}

/** The step with `change` applied. Changing the effect gives the new effect's default style. */
export function changeStep(step: Step, change: StepChange): Step {
  const effect = change.effect ?? step.effect;
  const base = {
    id: step.id,
    element: step.element,
    trigger: change.trigger ?? step.trigger,
    duration: clampDuration(change.duration ?? step.duration),
    delay: clampDelay(change.delay ?? step.delay),
    easing: change.easing ?? step.easing,
  };
  const wanted = change.style ?? (effect === step.effect ? step.style : undefined);
  if (effect === 'appear') {
    return { ...base, effect, style: isAppearStyle(wanted) ? wanted : DEFAULT_APPEAR_STYLE };
  }
  return { ...base, effect, style: isDisappearStyle(wanted) ? wanted : DEFAULT_DISAPPEAR_STYLE };
}
