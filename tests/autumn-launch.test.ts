import { describe, expect, test } from 'vitest';
import { FONTS, fontsUsed, isShape, isTextBox, parseDeck, plainText } from '../src/model';
import { autumnLaunch } from './fixtures/autumnLaunch';

// The fixture deck feeds the end-to-end, screenshot and performance tests (CLAUDE.md). These keep it a
// deck the app can read, with the 12 slides and the hero slide the design names.

describe('the fixture deck Autumn Launch', () => {
  const deck = parseDeck(JSON.parse(JSON.stringify(autumnLaunch())));

  test('Given the fixture, When the app reads it, Then it is a valid deck of 12 slides titled Autumn Launch', () => {
    expect(deck.title).toBe('Autumn Launch');
    expect(deck.slides).toHaveLength(12);
  });

  test('Given the fixture, When it is read and written again, Then nothing changes (it is already in the stored form)', () => {
    expect(JSON.parse(JSON.stringify(deck))).toEqual(JSON.parse(JSON.stringify(autumnLaunch())));
  });

  test('Given the hero slide, When it is read, Then it is slide 3, "Our approach", with the three pillars', () => {
    const hero = deck.slides[2];
    const words = (hero?.elements ?? []).flatMap((e) => (isTextBox(e) ? [plainText(e.doc)] : []));

    expect(words).toContain('Our approach');
    expect(words).toContain('03 — STRATEGY');
    expect(words.filter((w) => /^0[1-3] {3}/.test(w))).toHaveLength(3);
    expect(hero?.notes).toContain('customer problem');
  });

  test('Given every slide, When its elements are listed, Then ids are unique across the deck and the slides have the mix the design has', () => {
    const ids = deck.slides.flatMap((s) => s.elements.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    const backgrounds = new Set(deck.slides.map((s) => s.background));
    expect([...backgrounds].sort()).toEqual(['#14281B', '#E8F0E4', '#F5C542', '#FFFFFF']);
    expect(
      deck.slides.some((s) => s.elements.some((e) => isShape(e) && e.shape === 'ellipse')),
    ).toBe(true);
  });

  test('Given every text in the deck, When its fonts are listed, Then only bundled fonts are used', () => {
    const bundled = new Set(FONTS.map((f) => f.family));
    const used = deck.slides.flatMap((s) =>
      s.elements.flatMap((e) => (isTextBox(e) ? fontsUsed(e.doc) : [])),
    );

    expect(used.length).toBeGreaterThan(0);
    for (const family of used) expect(bundled.has(family)).toBe(true);
  });
});
