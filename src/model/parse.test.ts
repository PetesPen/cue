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

describe('parseDeck with text (EL-1)', () => {
  const textBox = {
    id: 't1',
    kind: 'text',
    x: 100,
    y: 100,
    width: 600,
    height: 90,
    rotation: 0,
    opacity: 1,
    fill: 'none',
    border: { color: '#14281B', width: 0, dash: 'solid' },
    padding: 8,
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: 'center' },
          content: [{ type: 'text', text: 'Our approach', marks: [{ type: 'bold' }] }],
        },
      ],
    },
  };
  const withElement = (element: unknown) => ({
    ...createDeck(env),
    slides: [{ id: 's', background: '#FFFFFF', notes: '', elements: [element] }],
  });

  test('Given a deck with a text box, When it goes through JSON and is parsed, Then it is identical', () => {
    const deck = parseDeck(withElement(textBox));

    expect(parseDeck(JSON.parse(JSON.stringify(deck)) as unknown)).toEqual(deck);
    expect(deck.slides[0]?.elements[0]).toMatchObject({ kind: 'text', padding: 8 });
  });

  test('Given text with marks and attributes Cue does not know, When the deck is parsed, Then they are dropped and the words stay', () => {
    const dirty = {
      ...textBox,
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hi', marks: [{ type: 'link', attrs: { href: 'x' } }] },
            ],
          },
        ],
      },
    };

    const element = parseDeck(withElement(dirty)).slides[0]?.elements[0];

    expect(element?.kind === 'text' && element.doc.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hi' }],
    });
  });

  test('Given a shape that holds text, When the deck is parsed, Then the text is kept', () => {
    const shape = {
      id: 'e1',
      kind: 'shape',
      shape: 'ellipse',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      rotation: 0,
      opacity: 1,
      fill: '#7FC8A0',
      border: { color: '#14281B', width: 0, dash: 'solid' },
      cornerRadius: 0,
      text: textBox.doc,
    };

    const element = parseDeck(withElement(shape)).slides[0]?.elements[0];

    expect(element?.kind === 'shape' && element.text).toEqual(textBox.doc);
  });

  test.each([
    ['text that is not a document', { ...textBox, doc: 'Our approach' }],
    ['no padding', { ...textBox, padding: undefined }],
    ['a padding that is not a number', { ...textBox, padding: 'wide' }],
    ['no border', { ...textBox, border: undefined }],
    [
      'a shape text that is not a document',
      { ...textBox, kind: 'shape', shape: 'ellipse', cornerRadius: 0, text: 5 },
    ],
  ])('Given %s, When the deck is parsed, Then it is rejected', (_name, broken) => {
    expect(() => parseDeck(withElement(broken))).toThrow(InvalidDeckError);
  });
});
