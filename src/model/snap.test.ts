import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import type { Rect } from './geometry';
import { align, distribute, snapEdges, snapHandle, snapMove, type Placed } from './snap';

const SLIDE: Rect = { x: 0, y: 0, width: 1920, height: 1080 };
const box = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

describe('snapMove: a box being dragged lines up (EL-6)', () => {
  test('Given a box near the left edge of the slide, When it is snapped, Then it moves onto the edge and a guide runs down the slide', () => {
    const snap = snapMove(box(4, 300, 200, 100), [], SLIDE, 6);

    expect(snap.dx).toBe(-4);
    expect(snap.dy).toBe(0);
    expect(snap.guides).toEqual([{ axis: 'x', at: 0, from: 0, to: 1080 }]);
  });

  test('Given a box whose middle is near the middle of the slide, When it is snapped, Then it centres', () => {
    const snap = snapMove(box(855, 200, 200, 100), [], SLIDE, 6);

    expect(snap.dx).toBe(5);
    expect(snap.guides[0]).toMatchObject({ axis: 'x', at: 960 });
  });

  test('Given a box near the bottom of the slide, When it is snapped, Then its bottom edge lands on it', () => {
    const snap = snapMove(box(300, 976, 200, 100), [], SLIDE, 6);

    expect(snap.dy).toBe(4);
    expect(snap.guides).toEqual([{ axis: 'y', at: 1080, from: 0, to: 1920 }]);
  });

  test('Given another element, When a box comes near its right edge, Then it lines up with it and the guide spans both', () => {
    const other = box(500, 100, 300, 200);

    const snap = snapMove(box(803, 600, 200, 100), [other], SLIDE, 6);

    expect(snap.dx).toBe(-3);
    expect(snap.guides).toEqual([{ axis: 'x', at: 800, from: 100, to: 700 }]);
  });

  test('Given another element, When a box comes near its middle line, Then the middles line up on the other axis too', () => {
    const other = box(500, 100, 300, 200);

    const snap = snapMove(box(1000, 195, 200, 100), [other], SLIDE, 6);

    // The box's middle (245) is 5 above the other's (200 + ... middle at y 200); the top edge is 5 from 200 too.
    expect(Math.abs(snap.dy)).toBeLessThanOrEqual(6);
    expect(snap.guides.some((g) => g.axis === 'y')).toBe(true);
  });

  test('Given a box far from everything, When it is snapped, Then it does not move and no guide shows', () => {
    const snap = snapMove(box(333, 222, 200, 100), [box(900, 700, 100, 100)], SLIDE, 6);

    expect(snap).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  test('Given a box that could snap to two lines, When it is snapped, Then the nearer one wins', () => {
    const near = box(1000, 800, 50, 50);
    const far = box(1004, 800, 50, 50);

    const snap = snapMove(box(1001, 300, 200, 100), [far, near], SLIDE, 6);

    expect(snap.dx).toBe(-1);
  });

  test('Given both axes near lines, When it is snapped, Then both snap on their own', () => {
    const snap = snapMove(box(3, 4, 200, 100), [], SLIDE, 6);

    expect(snap.dx).toBe(-3);
    expect(snap.dy).toBe(-4);
    expect(snap.guides).toHaveLength(2);
  });

  test('Given any box, When it is snapped, Then it never moves more than the threshold, and snapping again changes nothing', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.integer({ min: -200, max: 2000 }),
          y: fc.integer({ min: -200, max: 1200 }),
          width: fc.integer({ min: 1, max: 900 }),
          height: fc.integer({ min: 1, max: 600 }),
        }),
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 1800 }),
            y: fc.integer({ min: 0, max: 1000 }),
            width: fc.integer({ min: 1, max: 600 }),
            height: fc.integer({ min: 1, max: 600 }),
          }),
          { maxLength: 6 },
        ),
        (moving, others) => {
          const snap = snapMove(moving, others, SLIDE, 8);

          expect(Math.abs(snap.dx)).toBeLessThanOrEqual(8);
          expect(Math.abs(snap.dy)).toBeLessThanOrEqual(8);
          const landed = { ...moving, x: moving.x + snap.dx, y: moving.y + snap.dy };
          const again = snapMove(landed, others, SLIDE, 8);
          expect(again.dx).toBeCloseTo(0, 6);
          expect(again.dy).toBeCloseTo(0, 6);
        },
      ),
    );
  });
});

describe('snapEdges: the edge being resized lines up (EL-6)', () => {
  test('Given the right edge dragged near another element, When it is snapped, Then only that edge moves', () => {
    const other = box(800, 100, 200, 200);

    const snap = snapEdges(box(100, 400, 695, 100), { x: 1, y: 0 }, [other], SLIDE, 6);

    expect(snap.dx).toBe(5);
    expect(snap.dy).toBe(0);
    expect(snap.guides[0]).toMatchObject({ axis: 'x', at: 800 });
  });

  test('Given the left edge dragged near the slide edge, When it is snapped, Then it lands on the edge', () => {
    const snap = snapEdges(box(4, 400, 300, 100), { x: -1, y: 0 }, [], SLIDE, 6);

    expect(snap.dx).toBe(-4);
    expect(snap.guides).toEqual([{ axis: 'x', at: 0, from: 0, to: 1080 }]);
  });

  test('Given a corner, When both edges are near lines, Then both snap', () => {
    const snap = snapEdges(box(100, 100, 1818, 977), { x: 1, y: 1 }, [], SLIDE, 6);

    expect(snap.dx).toBe(2);
    expect(snap.dy).toBe(3);
  });

  test('Given an edge that is not being dragged near a line, Then it is left alone', () => {
    const snap = snapEdges(box(3, 400, 300, 100), { x: 1, y: 0 }, [], SLIDE, 6);

    expect(snap.dx).toBe(0);
  });
});

describe('align (EL-6)', () => {
  const items: Placed[] = [
    { id: 'a', bounds: box(100, 100, 200, 100) },
    { id: 'b', bounds: box(500, 300, 100, 300) },
    { id: 'c', bounds: box(900, 50, 300, 50) },
  ];
  const target = box(100, 50, 1100, 550);
  const shifts = (how: Parameters<typeof align>[1]) =>
    Object.fromEntries(align(items, how, target).map((s) => [s.id, [s.dx, s.dy]]));

  test.each([
    ['left', { a: [0, 0], b: [-400, 0], c: [-800, 0] }],
    ['centre', { a: [450, 0], b: [100, 0], c: [-400, 0] }],
    ['right', { a: [900, 0], b: [600, 0], c: [0, 0] }],
    ['top', { a: [0, -50], b: [0, -250], c: [0, 0] }],
    ['middle', { a: [0, 175], b: [0, -125], c: [0, 250] }],
    ['bottom', { a: [0, 400], b: [0, 0], c: [0, 500] }],
  ] as const)(
    'Given three boxes, When they are aligned %s to the selection, Then each moves as written',
    (how, expected) => {
      expect(shifts(how)).toEqual(expected);
    },
  );

  test('Given one box, When it is aligned to the slide, Then it moves against the slide', () => {
    const [shift] = align([{ id: 'a', bounds: box(100, 100, 200, 100) }], 'centre', SLIDE);

    expect(shift).toEqual({ id: 'a', dx: 760, dy: 0 });
  });

  test('Given a turned element, When it is aligned, Then its outer box is what lines up', () => {
    // A 200 x 100 box turned a quarter turn has an outer box of 100 x 200 around the same middle.
    const outer = box(150, 50, 100, 200);

    const [shift] = align([{ id: 'r', bounds: outer }], 'left', box(0, 0, 500, 500));

    expect(shift).toEqual({ id: 'r', dx: -150, dy: 0 });
  });

  test('Given any boxes, When they are aligned, Then every box sits on the same line afterwards, on one axis only', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 1500 }),
            y: fc.integer({ min: 0, max: 800 }),
            width: fc.integer({ min: 1, max: 400 }),
            height: fc.integer({ min: 1, max: 300 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        fc.constantFrom(...(['left', 'centre', 'right', 'top', 'middle', 'bottom'] as const)),
        (rects, how) => {
          const placed = rects.map((bounds, i) => ({ id: String(i), bounds }));
          const result = align(placed, how, SLIDE);
          const lands = placed.map(({ bounds }, i) => {
            const s = result[i];
            return {
              x: bounds.x + (s?.dx ?? 0),
              y: bounds.y + (s?.dy ?? 0),
              width: bounds.width,
              height: bounds.height,
            };
          });
          const line = (r: Rect) =>
            how === 'left'
              ? r.x
              : how === 'centre'
                ? r.x + r.width / 2
                : how === 'right'
                  ? r.x + r.width
                  : how === 'top'
                    ? r.y
                    : how === 'middle'
                      ? r.y + r.height / 2
                      : r.y + r.height;
          for (const r of lands) expect(line(r)).toBeCloseTo(line(lands[0] ?? r), 6);
          const horizontal = how === 'left' || how === 'centre' || how === 'right';
          for (const s of result) expect(horizontal ? s.dy : s.dx).toBe(0);
        },
      ),
    );
  });
});

describe('distribute (EL-6)', () => {
  test('Given three boxes in a row, When they are distributed horizontally, Then the outer two stay and the gaps become equal', () => {
    const items: Placed[] = [
      { id: 'a', bounds: box(0, 0, 100, 100) },
      { id: 'b', bounds: box(150, 0, 100, 100) },
      { id: 'c', bounds: box(700, 0, 100, 100) },
    ];

    const shifts = distribute(items, 'horizontal');

    // Span 800, widths 300, so two gaps of 250: b starts at 350.
    expect(shifts).toEqual([
      { id: 'a', dx: 0, dy: 0 },
      { id: 'b', dx: 200, dy: 0 },
      { id: 'c', dx: 0, dy: 0 },
    ]);
  });

  test('Given boxes listed in no order, When they are distributed vertically, Then they are spaced by position and the answer follows the list', () => {
    const items: Placed[] = [
      { id: 'low', bounds: box(0, 900, 100, 100) },
      { id: 'top', bounds: box(0, 0, 100, 100) },
      { id: 'mid', bounds: box(0, 100, 100, 100) },
    ];

    const shifts = distribute(items, 'vertical');

    expect(shifts).toEqual([
      { id: 'low', dx: 0, dy: 0 },
      { id: 'top', dx: 0, dy: 0 },
      { id: 'mid', dx: 0, dy: 350 },
    ]);
  });

  test('Given boxes of different sizes, When they are distributed, Then the gaps (not the middles) are equal', () => {
    const items: Placed[] = [
      { id: 'a', bounds: box(0, 0, 50, 10) },
      { id: 'b', bounds: box(60, 0, 300, 10) },
      { id: 'c', bounds: box(900, 0, 100, 10) },
    ];

    const shifts = distribute(items, 'horizontal');
    const b = shifts.find((s) => s.id === 'b');

    // Span 1000, widths 450: two gaps of 275. b starts at 50 + 275 = 325.
    expect(b?.dx).toBe(325 - 60);
  });

  test.each([[0], [1], [2]])(
    'Given %i boxes, When they are distributed, Then nothing moves',
    (count) => {
      const items = Array.from({ length: count }, (_, i) => ({
        id: String(i),
        bounds: box(i * 300, 0, 100, 100),
      }));

      expect(distribute(items, 'horizontal').every((s) => s.dx === 0 && s.dy === 0)).toBe(true);
    },
  );

  test('Given any three or more boxes, When they are distributed, Then the gaps are equal and the span is unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 1500 }),
            y: fc.integer({ min: 0, max: 800 }),
            width: fc.integer({ min: 1, max: 300 }),
            height: fc.integer({ min: 1, max: 300 }),
          }),
          { minLength: 3, maxLength: 8 },
        ),
        (rects) => {
          // The first and the last by position stay: boxes that overlap more than the span they leave
          // (the last one starts before another ends) have no even gap to speak of.
          const byStart = [...rects].sort((a, b) => a.x - b.x);
          const leftmost = byStart[0];
          const rightmost = byStart[byStart.length - 1];
          const span = (rightmost?.x ?? 0) + (rightmost?.width ?? 0) - (leftmost?.x ?? 0);
          fc.pre(span - rects.reduce((sum, r) => sum + r.width, 0) >= 0);
          const placed = rects.map((bounds, i) => ({ id: String(i), bounds }));
          const shifts = distribute(placed, 'horizontal');
          const lands = placed
            .map(({ bounds }, i) => ({ ...bounds, x: bounds.x + (shifts[i]?.dx ?? 0) }))
            .sort((a, b) => a.x - b.x);
          const gaps = lands
            .slice(1)
            .map((r, i) => r.x - ((lands[i]?.x ?? 0) + (lands[i]?.width ?? 0)));
          for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] ?? gap, 6);
          const before = [...rects].sort((a, b) => a.x - b.x);
          const first = lands[0];
          expect(first?.x).toBeCloseTo(before[0]?.x ?? 0, 6);
          const lastBefore = before[before.length - 1];
          const lastAfter = lands[lands.length - 1];
          expect((lastAfter?.x ?? 0) + (lastAfter?.width ?? 0)).toBeCloseTo(
            (lastBefore?.x ?? 0) + (lastBefore?.width ?? 0),
            6,
          );
          for (const s of shifts) expect(s.dy).toBe(0);
        },
      ),
    );
  });
});

describe('snapHandle: a dragged corner or edge middle of a turned box (EL-6)', () => {
  const none: Rect[] = [];

  test('Given a corner near a line, When it is snapped, Then it moves onto the line on that axis only', () => {
    const snap = snapHandle({ x: 1917, y: 500 }, undefined, none, SLIDE, 6);

    expect(snap.correction).toEqual({ x: 3, y: 0 });
    expect(snap.lines).toEqual([{ axis: 'x', at: 1920 }]);
  });

  test('Given a corner near lines on both axes, When it is snapped, Then both snap', () => {
    const snap = snapHandle({ x: 4, y: 1076 }, undefined, none, SLIDE, 6);

    expect(snap.correction).toEqual({ x: -4, y: 4 });
    expect(snap.lines).toHaveLength(2);
  });

  test('Given an edge that moves along a direction, When it is snapped, Then it is moved along that direction to the line', () => {
    // Moving at 45 degrees: 3 across needs 3 / cos(45) along.
    const axis = { x: Math.SQRT1_2, y: Math.SQRT1_2 };

    const snap = snapHandle({ x: 1917, y: 400 }, axis, none, SLIDE, 6);

    expect(snap.correction.x).toBeCloseTo(3, 6);
    expect(snap.correction.y).toBeCloseTo(3, 6);
    expect(snap.lines).toEqual([{ axis: 'x', at: 1920 }]);
  });

  test('Given an edge that could reach two lines, When it is snapped, Then the one it reaches soonest wins', () => {
    const axis = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    // 2 from the vertical line at 1920, 5 from the horizontal line at 1080.
    const snap = snapHandle({ x: 1918, y: 1075 }, axis, none, SLIDE, 6);

    expect(snap.lines).toEqual([{ axis: 'x', at: 1920 }]);
  });

  test('Given an edge moving almost along a guide, When it is snapped, Then it does not snap to it', () => {
    const axis = { x: 0.1, y: 0.995 };

    const snap = snapHandle({ x: 1917, y: 500 }, axis, none, SLIDE, 6);

    expect(snap).toEqual({ correction: { x: 0, y: 0 }, lines: [] });
  });

  test('Given a point far from every line, When it is snapped, Then nothing moves', () => {
    expect(snapHandle({ x: 333, y: 222 }, undefined, none, SLIDE, 6)).toEqual({
      correction: { x: 0, y: 0 },
      lines: [],
    });
  });

  test('Given another element, When a corner comes near its edge, Then it lines up with it', () => {
    const other = box(500, 100, 300, 200);

    const snap = snapHandle({ x: 803, y: 600 }, undefined, [other], SLIDE, 6);

    expect(snap.correction.x).toBe(-3);
  });

  test('Given any point and direction, When it is snapped, Then the point moved along the direction lands on a line', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1920 }),
        fc.integer({ min: 0, max: 1080 }),
        fc.integer({ min: 0, max: 359 }),
        (x, y, degrees) => {
          const axis = {
            x: Math.cos((degrees * Math.PI) / 180),
            y: Math.sin((degrees * Math.PI) / 180),
          };
          const snap = snapHandle({ x, y }, axis, none, SLIDE, 8);
          const landed = { x: x + snap.correction.x, y: y + snap.correction.y };

          for (const line of snap.lines) {
            expect(line.axis === 'x' ? landed.x : landed.y).toBeCloseTo(line.at, 6);
          }
          // It only moved along the direction.
          const cross = snap.correction.x * axis.y - snap.correction.y * axis.x;
          expect(Math.abs(cross)).toBeLessThan(1e-6);
        },
      ),
    );
  });
});
