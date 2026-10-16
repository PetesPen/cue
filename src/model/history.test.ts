import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { applyCommand, type Command } from './commands';
import { createSlide, type Deck } from './deck';
import { createShape, createText } from './elements';
import {
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  canRedo,
  canUndo,
  emptyHistory,
  record,
  redo,
  redoLabel,
  undo,
  undoLabel,
  type History,
} from './history';
import { textFromString } from './richtext';

const base = (): Deck => ({
  schemaVersion: 1,
  id: 'deck',
  title: 'Deck',
  createdAt: 1000,
  updatedAt: 1000,
  slides: [createSlide('s1'), createSlide('s2')],
});

interface Run {
  readonly deck: Deck;
  readonly history: History;
}

/** Apply a command and record it as a step, as the editor does. */
function step(
  run: Run,
  command: Command,
  options: { label?: string; mergeKey?: string; at?: number } = {},
): Run {
  const applied = applyCommand(run.deck, command);
  return {
    deck: applied.deck,
    history: record(run.history, {
      label: options.label ?? command.type,
      patches: applied.patches,
      inverse: applied.inverse,
      slideId: 'slideId' in command ? command.slideId : undefined,
      ids: [],
      mergeKey: options.mergeKey,
      at: options.at ?? command.at,
    }),
  };
}

const start = (): Run => ({ deck: base(), history: emptyHistory });
const rect = (id: string) => createShape(id, 'rectangle', { x: 0, y: 0, width: 100, height: 100 });
const add = (id: string, at = 2): Command => ({
  type: 'addElement',
  slideId: 's1',
  element: rect(id),
  at,
});
const move = (id: string, x: number, at: number): Command => ({
  type: 'updateElements',
  slideId: 's1',
  changes: [{ id, props: { x } }],
  at,
});

describe('undo and redo (EL-8)', () => {
  test('Given an edit, When it is undone, Then the deck is as it was, and redo puts it back', () => {
    const before = start();
    const after = step(before, add('a'));

    const undone = undo(after.history, after.deck);
    expect(undone?.deck).toEqual(before.deck);
    const redone = undone && redo(undone.history, undone.deck);

    expect(redone?.deck).toEqual(after.deck);
  });

  test('Given nothing done, When undo or redo is asked for, Then there is nothing to do', () => {
    const run = start();

    expect(undo(run.history, run.deck)).toBeUndefined();
    expect(redo(run.history, run.deck)).toBeUndefined();
    expect(canUndo(run.history)).toBe(false);
    expect(canRedo(run.history)).toBe(false);
  });

  test('Given three edits, When they are undone one by one, Then each takes the deck back one step, in order', () => {
    let run = start();
    const decks = [run.deck];
    for (const [i, id] of ['a', 'b', 'c'].entries()) {
      run = step(run, add(id, 10 + i), { label: `Add ${id}` });
      decks.push(run.deck);
    }

    expect(undoLabel(run.history)).toBe('Add c');
    let undone = undo(run.history, run.deck);
    expect(undone?.deck).toEqual(decks[2]);
    undone = undone && undo(undone.history, undone.deck);
    expect(undone?.deck).toEqual(decks[1]);
    expect(redoLabel(undone?.history ?? emptyHistory)).toBe('Add b');
  });

  test('Given an undo, When a new edit is made, Then what could have been redone is gone', () => {
    const run = step(step(start(), add('a')), add('b', 3));
    const undone = undo(run.history, run.deck);
    if (!undone) throw new Error('nothing undone');

    const next = step({ deck: undone.deck, history: undone.history }, add('c', 4));

    expect(canRedo(next.history)).toBe(false);
  });

  test('Given an edit, When it is undone, Then the saved time goes back too', () => {
    const run = step(start(), add('a', 5000));

    expect(run.deck.updatedAt).toBe(5000);
    expect(undo(run.history, run.deck)?.deck.updatedAt).toBe(1000);
  });
});

describe('steps of the same kind that follow each other (EL-8, decision 18)', () => {
  test('Given nudges within a second, When they are undone, Then one undo takes back all of them', () => {
    let run = step(start(), add('a'));
    run = step(run, move('a', 1, 100), { mergeKey: 'nudge:a', at: 100 });
    run = step(run, move('a', 2, 600), { mergeKey: 'nudge:a', at: 600 });
    run = step(run, move('a', 3, 1100), { mergeKey: 'nudge:a', at: 1100 });

    expect(run.history.done).toHaveLength(2);
    const undone = undo(run.history, run.deck);

    expect(undone?.deck.slides[0]?.elements[0]).toMatchObject({ x: 0 });
  });

  test('Given a pause longer than a second, When more nudges follow, Then they are a separate step', () => {
    const later = 100 + MERGE_WINDOW_MS + 1;
    let run = step(start(), add('a'));
    run = step(run, move('a', 1, 100), { mergeKey: 'nudge:a', at: 100 });
    run = step(run, move('a', 2, later), { mergeKey: 'nudge:a', at: later });

    expect(run.history.done).toHaveLength(3);
    expect(undo(run.history, run.deck)?.deck.slides[0]?.elements[0]).toMatchObject({ x: 1 });
  });

  test('Given different kinds of edit close together, When they are recorded, Then they stay separate steps', () => {
    let run = step(start(), add('a'));
    run = step(run, move('a', 1, 100), { mergeKey: 'nudge:a', at: 100 });
    run = step(
      run,
      { type: 'setNotes', slideId: 's1', notes: 'hello', at: 200 },
      { mergeKey: 'notes:s1', at: 200 },
    );

    expect(run.history.done).toHaveLength(3);
  });

  test('Given steps with no merge key, When they follow at once, Then they are not merged', () => {
    const run = step(step(start(), add('a', 2)), add('b', 3));

    expect(run.history.done).toHaveLength(2);
  });

  test('Given an undo between two edits of one kind, When the second is recorded, Then it is not merged into the first', () => {
    let run = step(start(), add('a'));
    run = step(run, move('a', 1, 100), { mergeKey: 'k', at: 100 });
    const undone = undo(run.history, run.deck);
    if (!undone) throw new Error('nothing undone');

    const next = step({ deck: undone.deck, history: undone.history }, move('a', 5, 200), {
      mergeKey: 'k',
      at: 200,
    });

    expect(next.history.done).toHaveLength(2);
  });

  test('Given a burst of typing merged into one step, When it is undone and redone, Then the text is as before and as after', () => {
    const text = createText('t', { x: 0, y: 0 });
    let run = step(start(), { type: 'addElement', slideId: 's1', element: text, at: 2 });
    const before = run.deck;
    for (const [i, words] of ['a', 'ab', 'abc'].entries()) {
      const at = 100 + i * 100;
      run = step(
        run,
        {
          type: 'updateElements',
          slideId: 's1',
          changes: [{ id: 't', props: { doc: textFromString(words) } }],
          at,
        },
        { mergeKey: 'text:t', at },
      );
    }

    const undone = undo(run.history, run.deck);
    expect(undone?.deck).toEqual(before);
    const redone = undone && redo(undone.history, undone.deck);

    expect(redone?.deck).toEqual(run.deck);
  });
});

describe('the length of the history', () => {
  test('Given more edits than the history keeps, When the oldest are forgotten, Then the newest are all still there', () => {
    let run = start();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) run = step(run, add(`e${String(i)}`, 10 + i));

    expect(run.history.done).toHaveLength(HISTORY_LIMIT);
    expect(undoLabel(run.history)).toBe('addElement');
  });
});

describe('any run of edits (property)', () => {
  /** A command that is valid for the deck as it is, chosen by a number. */
  function commandFor(deck: Deck, n: number, at: number): Command {
    const slide = deck.slides[n % deck.slides.length];
    if (!slide) throw new Error('no slide');
    const first = slide.elements[0]?.id;
    switch (n % 8) {
      case 0:
        return { type: 'addElement', slideId: slide.id, element: rect(`e${String(at)}`), at };
      case 1:
        return { type: 'renameDeck', title: `Title ${String(n)}`, at };
      case 2:
        return { type: 'setNotes', slideId: slide.id, notes: `Notes ${String(n)}`, at };
      case 3:
        return { type: 'addSlide', slideId: `s${String(at)}`, afterSlideId: slide.id, at };
      case 4:
        return first === undefined
          ? { type: 'addElement', slideId: slide.id, element: rect(`e${String(at)}`), at }
          : { type: 'removeElements', slideId: slide.id, ids: [first], at };
      case 5:
        return first === undefined
          ? { type: 'setNotes', slideId: slide.id, notes: 'x', at }
          : {
              type: 'updateElements',
              slideId: slide.id,
              changes: [{ id: first, props: { x: n } }],
              at,
            };
      case 6:
        return {
          type: 'setBackground',
          slideId: slide.id,
          background: `#${String(100000 + n)}`,
          all: n % 2 === 0,
          at,
        };
      default:
        return first === undefined || slide.elements.length < 2
          ? { type: 'renameDeck', title: `T${String(n)}`, at }
          : { type: 'reorderElements', slideId: slide.id, ids: [first], mode: 'front', at };
    }
  }

  const numbers = fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 25 });

  test('Given any run of commands, When every step is undone, Then the first deck comes back; and when every step is redone, the last', () => {
    fc.assert(
      fc.property(numbers, (ns) => {
        let run = start();
        const first = run.deck;
        for (const [i, n] of ns.entries()) run = step(run, commandFor(run.deck, n, 10 + i));
        const last = run.deck;

        let history = run.history;
        let deck = run.deck;
        for (let left = ns.length; left > 0; left -= 1) {
          const undone = undo(history, deck);
          expect(undone).toBeDefined();
          if (!undone) return;
          ({ history, deck } = undone);
        }
        expect(deck).toEqual(first);
        for (let left = ns.length; left > 0; left -= 1) {
          const redone = redo(history, deck);
          expect(redone).toBeDefined();
          if (!redone) return;
          ({ history, deck } = redone);
        }
        expect(deck).toEqual(last);
      }),
    );
  });

  test('Given any run recorded with merging, When every step is undone, Then the first deck still comes back (merging never loses an edit)', () => {
    fc.assert(
      fc.property(numbers, (ns) => {
        let run = start();
        const first = run.deck;
        for (const [i, n] of ns.entries()) {
          const command = commandFor(run.deck, n, 10 + i);
          // Everything shares one key and happens within the window, so everything merges.
          run = step(run, command, { mergeKey: 'all', at: 10 + i });
        }

        let history = run.history;
        let deck = run.deck;
        while (canUndo(history)) {
          const undone = undo(history, deck);
          if (!undone) break;
          ({ history, deck } = undone);
        }

        expect(history.done).toHaveLength(0);
        expect(deck).toEqual(first);
      }),
    );
  });
});
