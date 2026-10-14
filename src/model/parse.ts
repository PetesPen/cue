import { freeze } from 'immer';
import { SCHEMA_VERSION, type Deck, type Slide, type SlideElement } from './deck';

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

function parseElement(value: unknown): SlideElement {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new InvalidDeckError('A slide element has no id');
  }
  return { ...value, id: value.id };
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
  return {
    id: value.id,
    background: value.background,
    notes: value.notes,
    elements: (value.elements as unknown[]).map(parseElement),
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
