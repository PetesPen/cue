import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { canReorder, reorder, type ReorderMode } from './zorder';

const MODES: ReorderMode[] = ['front', 'forward', 'backward', 'back'];

/** A back-to-front order of distinct ids, and a set of them that is selected. */
const caseArb = fc
  .uniqueArray(fc.stringMatching(/^[a-z]{1,3}$/), { minLength: 0, maxLength: 12 })
  .chain((order) =>
    fc.record({
      order: fc.constant(order),
      selected: fc.subarray(order).map((ids) => new Set(ids)),
      mode: fc.constantFrom(...MODES),
    }),
  );

const inOrder = (order: readonly string[], among: ReadonlySet<string>, keep: boolean) =>
  order.filter((id) => among.has(id) === keep);

describe('reorder (ZO-1)', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  test.each([
    ['front', ['b'], ['a', 'c', 'd', 'e', 'b']],
    ['back', ['d'], ['d', 'a', 'b', 'c', 'e']],
    ['forward', ['b'], ['a', 'c', 'b', 'd', 'e']],
    ['backward', ['d'], ['a', 'b', 'd', 'c', 'e']],
    ['front', ['b', 'd'], ['a', 'c', 'e', 'b', 'd']],
    ['back', ['b', 'd'], ['b', 'd', 'a', 'c', 'e']],
    ['forward', ['b', 'd'], ['a', 'c', 'b', 'e', 'd']],
    ['backward', ['b', 'd'], ['b', 'a', 'd', 'c', 'e']],
    ['forward', ['b', 'c'], ['a', 'd', 'b', 'c', 'e']],
    ['backward', ['c', 'd'], ['a', 'c', 'd', 'b', 'e']],
  ] as const)(
    'Given a b c d e (back to front), When %s is run on %j, Then the order is %j',
    (mode, selected, expected) => {
      expect(reorder(order, new Set(selected), mode)).toEqual(expected);
    },
  );

  test('Given the top element, When Forward runs, Then nothing moves', () => {
    expect(reorder(order, new Set(['e']), 'forward')).toEqual(order);
  });

  test('Given ids that are not in the order, When a command runs, Then they are ignored', () => {
    expect(reorder(order, new Set(['zzz']), 'front')).toEqual(order);
  });

  test("Given any elements and any selection, When any command runs, Then the selected keep their relative order and so do the others (the plan's ZO-1 property)", () => {
    fc.assert(
      fc.property(caseArb, ({ order: list, selected, mode }) => {
        const next = reorder(list, selected, mode);

        expect(inOrder(next, selected, true)).toEqual(inOrder(list, selected, true));
        expect(inOrder(next, selected, false)).toEqual(inOrder(list, selected, false));
      }),
    );
  });

  test('Given any command, When it runs, Then no element is lost or doubled', () => {
    fc.assert(
      fc.property(caseArb, ({ order: list, selected, mode }) => {
        expect([...reorder(list, selected, mode)].sort()).toEqual([...list].sort());
      }),
    );
  });

  test('Given any selection, When Front or Back runs, Then the selected are exactly the top or the bottom of the stack', () => {
    fc.assert(
      fc.property(caseArb, ({ order: list, selected }) => {
        const k = list.filter((id) => selected.has(id)).length;
        const front = reorder(list, selected, 'front');
        const back = reorder(list, selected, 'back');

        expect(new Set(front.slice(front.length - k))).toEqual(
          new Set(list.filter((id) => selected.has(id))),
        );
        expect(new Set(back.slice(0, k))).toEqual(new Set(list.filter((id) => selected.has(id))));
      }),
    );
  });

  test('Given Front or Back has run, When it runs again, Then nothing changes', () => {
    fc.assert(
      fc.property(
        caseArb,
        fc.constantFrom<ReorderMode>('front', 'back'),
        ({ order: list, selected }, mode) => {
          const once = reorder(list, selected, mode);

          expect(reorder(once, selected, mode)).toEqual(once);
        },
      ),
    );
  });

  test('Given a single element that Forward really moves, When Backward follows, Then it is back where it began', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,3}$/), { minLength: 2, maxLength: 10 }),
        fc.nat(),
        (list, pick) => {
          const one = new Set([list[pick % list.length] ?? '']);
          fc.pre(canReorder(list, one, 'forward'));

          expect(reorder(reorder(list, one, 'forward'), one, 'backward')).toEqual(list);
        },
      ),
    );
  });
});

describe('canReorder (ZO-1: commands that would do nothing are disabled)', () => {
  const order = ['a', 'b', 'c'];

  test.each([
    ['front', 'c', false],
    ['forward', 'c', false],
    ['front', 'a', true],
    ['backward', 'a', false],
    ['back', 'a', false],
    ['back', 'c', true],
    ['backward', 'c', true],
    ['forward', 'b', true],
  ] as const)('Given a b c, When %s is checked for %s, Then it is %s', (mode, id, expected) => {
    expect(canReorder(order, new Set([id]), mode)).toBe(expected);
  });

  test('Given nothing selected, When any command is checked, Then it is disabled', () => {
    for (const mode of MODES) expect(canReorder(order, new Set(), mode)).toBe(false);
  });

  test('Given a selection of every element, When any command is checked, Then it is disabled', () => {
    for (const mode of MODES) expect(canReorder(order, new Set(order), mode)).toBe(false);
  });

  test('Given any case, When canReorder says yes, Then the order really changes, and when it says no, it does not', () => {
    fc.assert(
      fc.property(caseArb, ({ order: list, selected, mode }) => {
        const changed = reorder(list, selected, mode).some((id, i) => id !== list[i]);

        expect(canReorder(list, selected, mode)).toBe(changed);
      }),
    );
  });
});
