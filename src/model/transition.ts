/**
 * How a slide arrives (TN-1). A transition belongs to the slide that comes in and plays when the
 * show moves to it. The kind is chosen now; the direction and the duration are stored from the start,
 * with the defaults the stories give, so the controls for them (TN-2) need no change to the file.
 */

export const TRANSITION_KINDS = ['none', 'fade', 'slide', 'push', 'zoom'] as const;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];

/** Where the new slide comes in from (Slide and Push). */
export const TRANSITION_SIDES = ['right', 'left', 'top', 'bottom'] as const;
export type TransitionSide = (typeof TRANSITION_SIDES)[number];

export const MIN_TRANSITION_DURATION = 0.2;
export const MAX_TRANSITION_DURATION = 3;
export const DEFAULT_TRANSITION_DURATION = 0.6;

export interface Transition {
  readonly kind: TransitionKind;
  /** Slide and Push come in from this side. */
  readonly from: TransitionSide;
  /** Seconds. */
  readonly duration: number;
}

/** Slides start with no transition (TN-1), and Slide comes from the right when it is chosen. */
export const DEFAULT_TRANSITION: Transition = {
  kind: 'none',
  from: 'right',
  duration: DEFAULT_TRANSITION_DURATION,
};

export function isTransitionKind(value: unknown): value is TransitionKind {
  return TRANSITION_KINDS.some((kind) => kind === value);
}

export function isTransitionSide(value: unknown): value is TransitionSide {
  return TRANSITION_SIDES.some((side) => side === value);
}

/** From 0.2 to 3 seconds, in tenths (TN-2). */
export function clampTransitionDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_TRANSITION_DURATION;
  return Math.min(
    MAX_TRANSITION_DURATION,
    Math.max(MIN_TRANSITION_DURATION, Math.round(seconds * 10) / 10),
  );
}

/** The transition with `change` applied; a stray value falls back to what it was. */
export function changeTransition(transition: Transition, change: Partial<Transition>): Transition {
  return {
    kind: isTransitionKind(change.kind) ? change.kind : transition.kind,
    from: isTransitionSide(change.from) ? change.from : transition.from,
    duration:
      change.duration === undefined
        ? transition.duration
        : clampTransitionDuration(change.duration),
  };
}
