import { freeze } from 'immer';
import {
  DEFAULT_DELAY,
  DEFAULT_DURATION,
  DEFAULT_EASING,
  clampDelay,
  clampDuration,
  isEasing,
  isStepEffect,
  isTrigger,
  changeStep,
  createStep,
  type Step,
} from './animation';
import { SCHEMA_VERSION, type Deck, type Slide } from './deck';
import {
  DEFAULT_TRANSITION,
  clampTransitionDuration,
  isTransitionKind,
  isTransitionSide,
  type Transition,
} from './transition';
import { DASH_STYLES, SHAPE_KINDS, type Border, type SlideElement } from './elements';
import { sanitiseRichText, type RichText } from './richtext';

/** The stored deck was written by a newer Cue than this one. Say so; never guess (SV-3). */
export class UnsupportedVersionError extends Error {
  override readonly name = 'UnsupportedVersionError';
  constructor(readonly version: number) {
    super(`This deck was saved by a newer version of Cue (schema ${String(version)}).`);
  }
}

export class InvalidDeckError extends Error {
  override readonly name = 'InvalidDeckError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseBorder(value: unknown, id: string): Border {
  if (
    !isRecord(value) ||
    typeof value.color !== 'string' ||
    !isNumber(value.width) ||
    !DASH_STYLES.some((dash) => dash === value.dash)
  ) {
    throw new InvalidDeckError('Slide element ' + id + ' has no valid border');
  }
  return {
    color: value.color,
    width: value.width,
    dash: DASH_STYLES.find((dash) => dash === value.dash) ?? 'solid',
  };
}

function parseText(value: unknown, id: string): RichText {
  try {
    return sanitiseRichText(value);
  } catch {
    throw new InvalidDeckError('Slide element ' + id + ' has text that is not a text document');
  }
}

export function parseElement(value: unknown): SlideElement {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new InvalidDeckError('A slide element has no id');
  }
  const id = value.id;
  if (
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isNumber(value.width) ||
    !isNumber(value.height) ||
    !isNumber(value.rotation) ||
    !isNumber(value.opacity) ||
    typeof value.fill !== 'string'
  ) {
    throw new InvalidDeckError('Slide element ' + id + ' has a box that is not valid');
  }
  const box = {
    id,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    rotation: value.rotation,
    opacity: value.opacity,
    fill: value.fill,
    border: parseBorder(value.border, id),
  };

  if (value.kind === 'text') {
    if (!isNumber(value.padding)) throw new InvalidDeckError('Text box ' + id + ' has no padding');
    return { ...box, kind: 'text', padding: value.padding, doc: parseText(value.doc, id) };
  }

  if (value.kind === 'image') {
    if (typeof value.hash !== 'string' || value.hash === '' || typeof value.alt !== 'string') {
      throw new InvalidDeckError('Image ' + id + ' has no picture or no description');
    }
    return { ...box, kind: 'image', hash: value.hash, alt: value.alt };
  }

  const shape = SHAPE_KINDS.find((kind) => kind === value.shape);
  if (value.kind !== 'shape' || !shape || !isNumber(value.cornerRadius)) {
    throw new InvalidDeckError('Slide element ' + id + ' is not a valid shape');
  }
  return {
    ...box,
    kind: 'shape',
    shape,
    cornerRadius: value.cornerRadius,
    ...(value.text === undefined ? {} : { text: parseText(value.text, id) }),
  };
}

/**
 * The animation steps of a slide. A deck saved before animations existed has none. A step whose
 * element is gone is dropped (nothing can play on it), and an odd value in a step falls back to its
 * default rather than losing the deck.
 */
function parseSteps(value: unknown, elements: ReadonlySet<string>): Step[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new InvalidDeckError('A slide has animations that are not a list');
  const steps: Step[] = [];
  for (const raw of value as unknown[]) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.element !== 'string') {
      throw new InvalidDeckError('An animation step is missing a field');
    }
    if (!elements.has(raw.element) || !isStepEffect(raw.effect)) continue;
    const base = createStep(
      raw.id,
      raw.element,
      raw.effect,
      isTrigger(raw.trigger) ? raw.trigger : 'click',
      { x: isNumber(raw.x) ? raw.x : 0, y: isNumber(raw.y) ? raw.y : 0 },
    );
    steps.push(
      changeStep(base, {
        ...(typeof raw.style === 'string' ? { style: raw.style } : {}),
        ...(isNumber(raw.x) ? { x: raw.x } : {}),
        ...(isNumber(raw.y) ? { y: raw.y } : {}),
        duration: isNumber(raw.duration) ? clampDuration(raw.duration) : DEFAULT_DURATION,
        delay: isNumber(raw.delay) ? clampDelay(raw.delay) : DEFAULT_DELAY,
        easing: isEasing(raw.easing) ? raw.easing : DEFAULT_EASING,
      }),
    );
  }
  // The first step always starts a click of its own.
  const first = steps[0];
  if (first && first.trigger !== 'click') steps[0] = changeStep(first, { trigger: 'click' });
  return steps;
}

/** The transition of a slide. A deck saved before transitions existed has none, and a stray value is ignored. */
function parseTransition(value: unknown): Transition {
  if (!isRecord(value)) return DEFAULT_TRANSITION;
  return {
    kind: isTransitionKind(value.kind) ? value.kind : DEFAULT_TRANSITION.kind,
    from: isTransitionSide(value.from) ? value.from : DEFAULT_TRANSITION.from,
    duration: isNumber(value.duration)
      ? clampTransitionDuration(value.duration)
      : DEFAULT_TRANSITION.duration,
  };
}

function parseSlide(value: unknown): Slide {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.background !== 'string' ||
    typeof value.notes !== 'string' ||
    !Array.isArray(value.elements)
  ) {
    throw new InvalidDeckError('A slide is missing a field');
  }
  const elements = (value.elements as unknown[]).map(parseElement);
  return {
    id: value.id,
    background: value.background,
    notes: value.notes,
    elements,
    animations: parseSteps(value.animations, new Set(elements.map((e) => e.id))),
    transition: parseTransition(value.transition),
  };
}

/**
 * Turn stored data into a deck, or throw. Version 1 is the only one that exists, so there is nothing
 * to migrate yet: when the schema changes, add a step per old version here, each ending at the next.
 */
export function parseDeck(raw: unknown): Deck {
  if (!isRecord(raw)) throw new InvalidDeckError('A deck must be an object');
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new InvalidDeckError('A deck has no valid schema version');
  }
  if (version > SCHEMA_VERSION) throw new UnsupportedVersionError(version);

  if (
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.createdAt !== 'number' ||
    typeof raw.updatedAt !== 'number' ||
    !Array.isArray(raw.slides) ||
    raw.slides.length === 0
  ) {
    throw new InvalidDeckError('A deck is missing a field, or has no slides');
  }
  return freeze(
    {
      schemaVersion: SCHEMA_VERSION,
      id: raw.id,
      title: raw.title,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      slides: (raw.slides as unknown[]).map(parseSlide),
    },
    true,
  );
}
