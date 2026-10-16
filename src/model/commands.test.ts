import fc from 'fast-check';
import { applyPatches } from 'immer';
import { describe, expect, test } from 'vitest';
import { CommandError, applyCommand, type Command } from './commands';
import { createSlide, type Deck } from './deck';

function deckWith(slideIds: string[]): Deck {
  return {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1000,
    updatedAt: 1000,
    slides: slideIds.map(createSlide),
  };
}

const ids = (deck: Deck) => deck.slides.map((s) => s.id);

describe('addSlide (SL-1)', () => {
  test('Given three slides with the second selected, When a slide is added, Then it goes directly after the second', () => {
    const deck = deckWith(['s1', 's2', 's3']);

    const { deck: next } = applyCommand(deck, {
      type: 'addSlide',
      slideId: 'new',
      afterSlideId: 's2',
      at: 2000,
    });

    expect(ids(next)).toEqual(['s1', 's2', 'new', 's3']);
  });

  test('Given the last slide selected, When a slide is added, Then it goes at the end', () => {
    const { deck } = applyCommand(deckWith(['s1', 's2']), {
      type: 'addSlide',
      slideId: 'new',
      afterSlideId: 's2',
      at: 2000,
    });

    expect(ids(deck)).toEqual(['s1', 's2', 'new']);
  });

  test('Given a new slide, When it is added, Then it is blank and the deck is marked as edited at that time', () => {
    const { deck } = applyCommand(deckWith(['s1']), {
      type: 'addSlide',
      slideId: 'new',
      afterSlideId: 's1',
      at: 7000,
    });

    expect(deck.slides[1]).toEqual({
      id: 'new',
      background: '#FFFFFF',
      elements: [],
      notes: '',
      animations: [],
      transition: { kind: 'none', from: 'right', duration: 0.6 },
    });
    expect(deck.updatedAt).toBe(7000);
    expect(deck.createdAt).toBe(1000);
  });

  test('Given a slide that is not in the deck, When a slide is added after it, Then the command fails and names the slide', () => {
    expect(() =>
      applyCommand(deckWith(['s1']), {
        type: 'addSlide',
        slideId: 'new',
        afterSlideId: 'missing',
        at: 2000,
      }),
    ).toThrow(CommandError);
    expect(() =>
      applyCommand(deckWith(['s1']), {
        type: 'addSlide',
        slideId: 'new',
        afterSlideId: 'missing',
        at: 2000,
      }),
    ).toThrow(/missing/);
  });

  test('Given a deck, When a slide is added, Then the original deck value is unchanged', () => {
    const deck = deckWith(['s1', 's2']);

    applyCommand(deck, { type: 'addSlide', slideId: 'new', afterSlideId: 's1', at: 2000 });

    expect(ids(deck)).toEqual(['s1', 's2']);
    expect(deck.updatedAt).toBe(1000);
  });
});

describe('renameDeck (SV-2)', () => {
  test('Given a deck, When it is renamed with spaces around the name, Then the title is trimmed', () => {
    const { deck } = applyCommand(deckWith(['s1']), {
      type: 'renameDeck',
      title: '  Pitch v2 ',
      at: 3000,
    });

    expect(deck.title).toBe('Pitch v2');
    expect(deck.updatedAt).toBe(3000);
  });

  test('Given a deck, When it is renamed to nothing, Then it is called "Untitled deck"', () => {
    const { deck } = applyCommand(deckWith(['s1']), { type: 'renameDeck', title: '   ', at: 3000 });

    expect(deck.title).toBe('Untitled deck');
  });
});

describe('properties of commands (EL-8, ZO-1 style invariants)', () => {
  const slideIdsArb = fc.uniqueArray(fc.stringMatching(/^[a-z0-9]{1,6}$/), {
    minLength: 1,
    maxLength: 30,
  });

  /** A deck, a slide in it, and an id for a new slide that the deck does not use. */
  const addSlideCase = slideIdsArb.chain((slideIds) =>
    fc.record({
      deck: fc.constant(deckWith(slideIds)),
      index: fc.nat({ max: slideIds.length - 1 }),
      at: fc.integer({ min: 1, max: 1e12 }),
    }),
  );

  test('Given any deck and any selected slide, When a slide is added, Then it sits right after the selection and every other slide keeps its relative order', () => {
    fc.assert(
      fc.property(addSlideCase, ({ deck, index, at }) => {
        const afterSlideId = deck.slides[index]?.id ?? '';
        const { deck: next } = applyCommand(deck, {
          type: 'addSlide',
          slideId: 'NEW',
          afterSlideId,
          at,
        });

        expect(next.slides).toHaveLength(deck.slides.length + 1);
        expect(next.slides[index + 1]?.id).toBe('NEW');
        expect(ids(next).filter((id) => id !== 'NEW')).toEqual(ids(deck));
      }),
    );
  });

  test('Given any command, When it is applied and then its inverse patches are applied, Then the original deck comes back', () => {
    fc.assert(
      fc.property(
        addSlideCase,
        fc.string(),
        fc.boolean(),
        ({ deck, index, at }, title, isRename) => {
          const command: Command = isRename
            ? { type: 'renameDeck', title, at }
            : { type: 'addSlide', slideId: 'NEW', afterSlideId: deck.slides[index]?.id ?? '', at };

          const { deck: next, inverse } = applyCommand(deck, command);

          expect(applyPatches(next, inverse)).toEqual(deck);
        },
      ),
    );
  });

  test('Given any command, When its patches are replayed on the original deck, Then the result equals the new deck', () => {
    fc.assert(
      fc.property(addSlideCase, ({ deck, index, at }) => {
        const { deck: next, patches } = applyCommand(deck, {
          type: 'addSlide',
          slideId: 'NEW',
          afterSlideId: deck.slides[index]?.id ?? '',
          at,
        });

        expect(applyPatches(deck, patches)).toEqual(next);
      }),
    );
  });
});
