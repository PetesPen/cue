import { describe, expect, test } from 'vitest';
import { FONTS, clickCount, fontsUsed, isShape, isTextBox, parseDeck } from '../src/model';
import { awkwardDeck } from './fixtures/awkwardDeck';

// The awkward deck feeds the fidelity test (SV-5). These keep it a deck the app reads whole: a stored
// element or step the model dropped would make the test compare less than it says.

describe('the fixture deck Awkward (SV-5)', () => {
  const stored = JSON.parse(JSON.stringify(awkwardDeck())) as unknown;
  const deck = parseDeck(stored);

  test('Given the fixture, When the app reads it, Then it is a valid deck of four slides', () => {
    expect(deck.slides).toHaveLength(4);
  });

  test('Given the fixture, When it is read and written again, Then nothing is dropped or changed', () => {
    expect(JSON.parse(JSON.stringify(deck))).toEqual(stored);
  });

  test('Given the text of the deck, Then it uses every bundled font', () => {
    const used = new Set(
      deck.slides.flatMap((slide) =>
        slide.elements.flatMap((element) => {
          const body = isTextBox(element)
            ? element.doc
            : isShape(element)
              ? element.text
              : undefined;
          return body ? fontsUsed(body) : [];
        }),
      ),
    );
    expect([...used].sort()).toEqual(FONTS.map((font) => font.family).sort());
  });

  test('Given the slides, Then they have the kinds of things the renderer finds hard', () => {
    const shapes = deck.slides.flatMap((slide) => slide.elements.filter(isShape));
    expect(shapes.some((shape) => shape.rotation !== 0)).toBe(true);
    expect(shapes.some((shape) => shape.opacity < 1)).toBe(true);
    expect(shapes.some((shape) => shape.border.dash === 'dashed')).toBe(true);
    expect(shapes.some((shape) => shape.text !== undefined)).toBe(true);
    expect(deck.slides.map(clickCount)).toEqual([0, 0, 0, 4]);
    expect(new Set(deck.slides.map((slide) => slide.transition.kind)).size).toBeGreaterThan(2);
  });
});
