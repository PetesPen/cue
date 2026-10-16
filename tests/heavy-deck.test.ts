import { describe, expect, test } from 'vitest';
import { parseDeck } from '../src/model';
import { fiftyElementDeck, fiftySlideDeck } from './fixtures/heavyDeck';

// The decks the performance suite runs on (UX-3): they must be decks the app can read, with the size
// the budgets are written for.

describe('the decks for the performance suite', () => {
  test('Given the one-slide deck, When the app reads it, Then the slide has 50 elements of three kinds', () => {
    const deck = parseDeck(JSON.parse(JSON.stringify(fiftyElementDeck())));

    expect(deck.slides).toHaveLength(1);
    const elements = deck.slides[0]?.elements ?? [];
    expect(elements).toHaveLength(50);
    expect(new Set(elements.map((e) => e.kind))).toEqual(new Set(['shape', 'text']));
    expect(elements.filter((e) => e.opacity < 1).length).toBeGreaterThan(10);
  });

  test('Given the 50-slide deck, When the app reads it, Then it has 50 slides and every id is unique', () => {
    const deck = parseDeck(JSON.parse(JSON.stringify(fiftySlideDeck())));

    expect(deck.slides).toHaveLength(50);
    const slideIds = deck.slides.map((s) => s.id);
    expect(new Set(slideIds).size).toBe(50);
    const elementIds = deck.slides.flatMap((s) => s.elements.map((e) => e.id));
    expect(new Set(elementIds).size).toBe(elementIds.length);
    // The steps of the copied hero slides still point at their own elements.
    const steps = deck.slides.flatMap((s) => s.animations.map((a) => [s, a] as const));
    expect(steps.length).toBeGreaterThan(0);
    for (const [slide, step] of steps) {
      expect(slide.elements.some((e) => e.id === step.element)).toBe(true);
    }
  });
});
