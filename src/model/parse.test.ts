import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { applyCommand } from './commands';
import { createDeck, type Env } from './deck';
import { InvalidDeckError, UnsupportedVersionError, parseDeck } from './parse';

let counter = 0;
const env: Env = { newId: () => `id-${String(++counter)}`, now: () => 1000 };

describe('parseDeck (SV-1, SV-3)', () => {
  test('Given a deck that went through storage as JSON, When it is parsed, Then it equals the deck that was stored', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 0, max: 8 }), (title, extraSlides) => {
        let deck = createDeck(env, title);
        for (let i = 0; i < extraSlides; i++) {
          deck = applyCommand(deck, {
            type: 'addSlide',
            slideId: env.newId(),
            afterSlideId: deck.slides.at(-1)?.id ?? '',
            at: 2000 + i,
          }).deck;
        }

        const roundTripped = parseDeck(JSON.parse(JSON.stringify(deck)) as unknown);

        expect(roundTripped).toEqual(deck);
      }),
    );
  });

  test('Given a parsed deck, When someone tries to change it, Then it is frozen like every other deck', () => {
    const deck = parseDeck(JSON.parse(JSON.stringify(createDeck(env))) as unknown);

    expect(Object.isFrozen(deck)).toBe(true);
    expect(Object.isFrozen(deck.slides[0])).toBe(true);
  });

  test('Given a deck from a newer Cue, When it is parsed, Then the error says so and names the version', () => {
    const newer = { ...createDeck(env), schemaVersion: 2 };

    expect(() => parseDeck(newer)).toThrow(UnsupportedVersionError);
    expect(() => parseDeck(newer)).toThrow(/newer version of Cue \(schema 2\)/);
  });

  test.each([
    ['not an object', 'a string'],
    ['an array', []],
    ['null', null],
    ['no schema version', { id: 'x' }],
    ['schema version 0', { schemaVersion: 0 }],
    ['a fractional schema version', { schemaVersion: 1.5 }],
  ])('Given %s, When it is parsed, Then it is rejected as invalid', (_name, value) => {
    expect(() => parseDeck(value)).toThrow(InvalidDeckError);
  });

  test('Given a deck with no slides, When it is parsed, Then it is rejected (a deck always has one)', () => {
    expect(() => parseDeck({ ...createDeck(env), slides: [] })).toThrow(InvalidDeckError);
  });

  test('Given a slide missing its notes, When the deck is parsed, Then it is rejected', () => {
    const deck = createDeck(env);
    const broken = { ...deck, slides: [{ id: 's', background: '#FFFFFF', elements: [] }] };

    expect(() => parseDeck(broken)).toThrow(InvalidDeckError);
  });

  test('Given a slide element with no id, When the deck is parsed, Then it is rejected', () => {
    const deck = createDeck(env);
    const broken = {
      ...deck,
      slides: [{ id: 's', background: '#FFFFFF', notes: '', elements: [{ kind: 'text' }] }],
    };

    expect(() => parseDeck(broken)).toThrow(InvalidDeckError);
  });
});
