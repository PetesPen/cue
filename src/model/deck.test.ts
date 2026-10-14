import { describe, expect, test } from 'vitest';
import {
  DEFAULT_DECK_TITLE,
  SCHEMA_VERSION,
  createDeck,
  duplicateDeck,
  normaliseTitle,
  type Env,
} from './deck';
import { applyCommand } from './commands';

/** A predictable environment: ids "id-1", "id-2", ... and a clock the test sets. */
function testEnv(start = 1000): Env & { time: number } {
  let counter = 0;
  const env = {
    time: start,
    newId: () => `id-${String(++counter)}`,
    now: () => env.time,
  };
  return env;
}

describe('createDeck (SL-1, SV-2)', () => {
  test('Given a new deck, When it is created, Then it has exactly one blank slide', () => {
    const deck = createDeck(testEnv());

    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]).toMatchObject({ background: '#FFFFFF', elements: [], notes: '' });
  });

  test('Given no title, When a deck is created, Then it is called "Untitled deck" and carries the schema version', () => {
    const deck = createDeck(testEnv());

    expect(deck.title).toBe(DEFAULT_DECK_TITLE);
    expect(deck.schemaVersion).toBe(SCHEMA_VERSION);
  });

  test('Given a clock, When a deck is created, Then created and updated times are the clock reading', () => {
    const deck = createDeck(testEnv(5000));

    expect(deck.createdAt).toBe(5000);
    expect(deck.updatedAt).toBe(5000);
  });

  test('Given a created deck, When someone tries to change it, Then it refuses (the document is immutable)', () => {
    const deck = createDeck(testEnv());

    expect(Object.isFrozen(deck)).toBe(true);
    expect(Object.isFrozen(deck.slides)).toBe(true);
    expect(Object.isFrozen(deck.slides[0])).toBe(true);
  });
});

describe('normaliseTitle (SV-2)', () => {
  test.each([
    ['  Q3 review  ', 'Q3 review'],
    ['', DEFAULT_DECK_TITLE],
    ['   ', DEFAULT_DECK_TITLE],
  ])('Given the title %j, When it is normalised, Then it becomes %j', (input, expected) => {
    expect(normaliseTitle(input)).toBe(expected);
  });
});

describe('duplicateDeck (SV-2)', () => {
  test('Given a deck with three slides, When it is duplicated, Then the copy has the same slide content under new ids', () => {
    const env = testEnv();
    let deck = createDeck(env, 'Team offsite');
    for (const slideId of ['a', 'b']) {
      deck = applyCommand(deck, {
        type: 'addSlide',
        slideId,
        afterSlideId: deck.slides.at(-1)?.id ?? '',
        at: 2000,
      }).deck;
    }

    const copy = duplicateDeck(deck, env);

    expect(copy.slides).toHaveLength(3);
    expect(copy.slides.map((s) => ({ ...s, id: '' }))).toEqual(
      deck.slides.map((s) => ({ ...s, id: '' })),
    );
    const originalIds = new Set([deck.id, ...deck.slides.map((s) => s.id)]);
    for (const id of [copy.id, ...copy.slides.map((s) => s.id)]) {
      expect(originalIds.has(id)).toBe(false);
    }
  });

  test('Given a deck called "Team offsite", When it is duplicated, Then the copy is called "Copy of Team offsite" and is dated now', () => {
    const env = testEnv(1000);
    const deck = createDeck(env, 'Team offsite');
    env.time = 9000;

    const copy = duplicateDeck(deck, env);

    expect(copy.title).toBe('Copy of Team offsite');
    expect(copy.createdAt).toBe(9000);
    expect(copy.updatedAt).toBe(9000);
  });

  test('Given a deck, When it is duplicated, Then the original is not touched', () => {
    const env = testEnv();
    const deck = createDeck(env, 'Original');
    const before = structuredClone(deck);

    duplicateDeck(deck, env);

    expect(deck).toEqual(before);
  });
});
