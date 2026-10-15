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

describe('parseDeck with elements (EL-3)', () => {
  const shape = {
    id: 'e1',
    kind: 'shape',
    shape: 'ellipse',
    x: 10,
    y: 20,
    width: 300,
    height: 200,
    rotation: 15,
    opacity: 0.5,
    fill: '#7FC8A0',
    border: { color: '#14281B', width: 4, dash: 'dashed' },
    cornerRadius: 0,
  };
  const withElement = (element: unknown) => ({
    ...createDeck(env),
    slides: [{ id: 's', background: '#FFFFFF', notes: '', elements: [element] }],
  });

  test('Given a deck with a shape, When it is parsed, Then every property of the shape is kept', () => {
    expect(parseDeck(withElement(shape)).slides[0]?.elements[0]).toEqual(shape);
  });

  test.each([
    ['an unknown kind', { ...shape, kind: 'text' }],
    ['an unknown shape', { ...shape, shape: 'hexagon' }],
    ['a missing position', { ...shape, x: undefined }],
    ['a position that is not a number', { ...shape, y: 'high' }],
    ['an infinite size', { ...shape, width: Infinity }],
    ['a missing rotation', { ...shape, rotation: undefined }],
    ['an opacity that is a string', { ...shape, opacity: '50%' }],
    ['a fill that is not text', { ...shape, fill: 7 }],
    ['no border', { ...shape, border: undefined }],
    ['a border colour that is not text', { ...shape, border: { ...shape.border, color: 1 } }],
    [
      'a border width that is not a number',
      { ...shape, border: { ...shape.border, width: 'thin' } },
    ],
    ['an unknown dash style', { ...shape, border: { ...shape.border, dash: 'wavy' } }],
    ['a corner radius that is not a number', { ...shape, cornerRadius: null }],
  ])(
    'Given a shape with %s, When the deck is parsed, Then it is rejected as invalid',
    (_name, broken) => {
      expect(() => parseDeck(withElement(broken))).toThrow(InvalidDeckError);
    },
  );
});
