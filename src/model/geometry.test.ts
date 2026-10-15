import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  HANDLES,
  angleOf,
  boundsOf,
  boxFromDrag,
  centerOf,
  containsPoint,
  cornersOf,
  groupBounds,
  isCorner,
  lineBetween,
  lineEnds,
  moveBox,
  moveLineEnd,
  normaliseAngle,
  rectEncloses,
  resizeBox,
  resizeGroup,
  rotateBoxes,
  rotatePoint,
  rotationAfterDrag,
  scaleBoxes,
  snapTo,
  unionRect,
  type Box,
  type Handle,
  type Point,
} from './geometry';

const number = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
const pointArb: fc.Arbitrary<Point> = fc.record({ x: number(-3000, 3000), y: number(-3000, 3000) });
const boxArb: fc.Arbitrary<Box> = fc.record({
  x: number(-500, 2000),
  y: number(-500, 1500),
  width: number(5, 1500),
  height: number(5, 1000),
  rotation: number(-180, 180),
});
const handleArb = fc.constantFrom<Handle>(...HANDLES);

const near = (a: Point, b: Point, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

/** The world position of the fixed point of a resize: the side opposite the handle. */
function anchorOf(box: Box, handle: Handle): Point {
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const c = centerOf(box);
  return rotatePoint(
    { x: c.x - (sx * box.width) / 2, y: c.y - (sy * box.height) / 2 },
    c,
    box.rotation,
  );
}

describe('angles', () => {
  test.each([
    [0, 0],
    [180, 180],
    [-180, 180],
    [190, -170],
    [-190, 170],
    [540, 180],
    [360, 0],
  ])('Given %d degrees, When it is normalised, Then it is %d', (input, expected) => {
    expect(normaliseAngle(input)).toBe(expected);
  });

  test('Given any angle, When it is normalised, Then it lies in (-180, 180] and means the same direction', () => {
    fc.assert(
      fc.property(number(-5000, 5000), (degrees) => {
        const n = normaliseAngle(degrees);
        expect(n).toBeGreaterThan(-180);
        expect(n).toBeLessThanOrEqual(180);
        expect(Math.cos((n * Math.PI) / 180)).toBeCloseTo(Math.cos((degrees * Math.PI) / 180), 6);
      }),
    );
  });

  test.each([
    [7, 0],
    [8, 15],
    [22, 15],
    [23, 30],
    [-8, -15],
  ])('Given %d degrees, When snapped to 15, Then it is %d', (input, expected) => {
    expect(snapTo(input, 15)).toBeCloseTo(expected, 9);
  });

  test('Given a point straight above, to the right, below and to the left, When the angle is read, Then it is 0, 90, 180 and -90 (0 is up)', () => {
    const c = { x: 100, y: 100 };

    expect(angleOf(c, { x: 100, y: 0 })).toBeCloseTo(0);
    expect(angleOf(c, { x: 200, y: 100 })).toBeCloseTo(90);
    expect(Math.abs(angleOf(c, { x: 100, y: 200 }))).toBeCloseTo(180);
    expect(normaliseAngle(angleOf(c, { x: 0, y: 100 }))).toBeCloseTo(-90);
  });
});

describe('rotatePoint, bounds and hit tests (EL-5)', () => {
  test('Given a point, When it is turned 90 degrees clockwise about the origin, Then right becomes down', () => {
    near(rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90), { x: 0, y: 10 });
  });

  test('Given any point and angle, When it is turned and turned back, Then it is where it began', () => {
    fc.assert(
      fc.property(pointArb, pointArb, number(-720, 720), (p, about, degrees) => {
        near(rotatePoint(rotatePoint(p, about, degrees), about, -degrees), p, 5);
      }),
    );
  });

  test('Given an upright box, When its bounds are read, Then they are the box', () => {
    expect(boundsOf({ x: 10, y: 20, width: 300, height: 100, rotation: 0 })).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 100,
    });
  });

  test('Given a box turned 90 degrees, When its bounds are read, Then width and height swap about the centre', () => {
    const b = boundsOf({ x: 0, y: 0, width: 200, height: 100, rotation: 90 });

    expect(b.x).toBeCloseTo(50);
    expect(b.y).toBeCloseTo(-50);
    expect(b.width).toBeCloseTo(100);
    expect(b.height).toBeCloseTo(200);
  });

  test('Given any box, When its corners are read, Then their centre is the box centre and their bounds equal boundsOf', () => {
    fc.assert(
      fc.property(boxArb, (box) => {
        const corners = cornersOf(box);
        const mid = {
          x: corners.reduce((sum, p) => sum + p.x, 0) / 4,
          y: corners.reduce((sum, p) => sum + p.y, 0) / 4,
        };
        near(mid, centerOf(box), 5);
        const xs = corners.map((p) => p.x);
        expect(boundsOf(box).x).toBeCloseTo(Math.min(...xs), 6);
      }),
    );
  });

  test('Given a turned box, When a point is tested, Then the turned shape is what counts, not its upright bounds', () => {
    const box = { x: 0, y: 0, width: 200, height: 20, rotation: 90 };
    // Turned upright, the box is a tall thin bar through the centre (100, 10).
    expect(containsPoint(box, { x: 100, y: 100 })).toBe(true);
    expect(containsPoint(box, { x: 190, y: 10 })).toBe(false);
  });

  test('Given a line with no height, When a point is a few pixels off it, Then slop lets it be picked', () => {
    const line = { x: 0, y: 50, width: 400, height: 0, rotation: 0 };

    expect(containsPoint(line, { x: 200, y: 56 })).toBe(false);
    expect(containsPoint(line, { x: 200, y: 56 }, 8)).toBe(true);
  });

  test('Given a selection rectangle, When it fully holds a box, Then the box is enclosed; a partly held one is not', () => {
    const rect = { x: 0, y: 0, width: 500, height: 500 };

    expect(rectEncloses(rect, { x: 10, y: 10, width: 100, height: 100, rotation: 0 })).toBe(true);
    expect(rectEncloses(rect, { x: 450, y: 10, width: 100, height: 100, rotation: 0 })).toBe(false);
    // A box that fits only until it is turned.
    expect(rectEncloses(rect, { x: 0, y: 0, width: 500, height: 50, rotation: 0 })).toBe(true);
    expect(rectEncloses(rect, { x: 0, y: 0, width: 500, height: 50, rotation: 45 })).toBe(false);
  });

  test('Given boxes, When their group bounds are read, Then they hold every box', () => {
    fc.assert(
      fc.property(fc.array(boxArb, { minLength: 1, maxLength: 6 }), (boxes) => {
        const group = groupBounds(boxes);
        for (const box of boxes)
          expect(
            rectEncloses(
              {
                ...group,
                x: group.x - 1e-6,
                y: group.y - 1e-6,
                width: group.width + 2e-6,
                height: group.height + 2e-6,
              },
              box,
            ),
          ).toBe(true);
      }),
    );
  });

  test('Given no rectangles, When they are joined, Then the result is empty', () => {
    expect(unionRect([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  test('Given a box, When it is moved, Then only x and y change', () => {
    expect(moveBox({ x: 10, y: 20, width: 5, height: 6, rotation: 30 }, 3, -4)).toEqual({
      x: 13,
      y: 16,
      width: 5,
      height: 6,
      rotation: 30,
    });
  });
});

describe('resizeBox (EL-5)', () => {
  const upright: Box = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };

  test('Given an upright box, When the south-east handle is dragged by (50, 30), Then the top left stays and the box grows', () => {
    expect(resizeBox(upright, 'se', { x: 50, y: 30 })).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 130,
      rotation: 0,
    });
  });

  test('Given an upright box, When the north-west handle is dragged by (-20, -10), Then the bottom right stays and the box grows', () => {
    expect(resizeBox(upright, 'nw', { x: -20, y: -10 })).toEqual({
      x: 80,
      y: 90,
      width: 220,
      height: 110,
      rotation: 0,
    });
  });

  test('Given an edge handle, When it is dragged, Then only that dimension changes', () => {
    const east = resizeBox(upright, 'e', { x: 40, y: 999 });
    const north = resizeBox(upright, 'n', { x: 999, y: -25 });

    expect(east).toMatchObject({ x: 100, y: 100, width: 240, height: 100 });
    expect(north).toMatchObject({ x: 100, y: 75, width: 200, height: 125 });
  });

  test('Given a handle dragged far past the opposite side, When the box is resized, Then it stops at the smallest size and does not flip', () => {
    const smallest = resizeBox(upright, 'se', { x: -5000, y: -5000 });

    expect(smallest.width).toBe(1);
    expect(smallest.height).toBe(1);
    expect(resizeBox(upright, 'se', { x: -5000, y: -5000 }, { minSize: 20 })).toMatchObject({
      width: 20,
      height: 20,
    });
  });

  test('Given a corner handle with Shift, When it is dragged, Then the proportions are kept', () => {
    const grown = resizeBox(upright, 'se', { x: 100, y: 10 }, { keepAspect: true });

    expect(grown.width / grown.height).toBeCloseTo(2, 9);
    expect(grown.width).toBeCloseTo(300, 9);
  });

  test('Given any box and handle, When it is dragged by any amount, Then the opposite side stays exactly where it was, however the box is turned', () => {
    fc.assert(
      fc.property(boxArb, handleArb, pointArb, fc.boolean(), (box, handle, delta, keepAspect) => {
        const resized = resizeBox(box, handle, delta, { keepAspect });

        near(anchorOf(resized, handle), anchorOf(box, handle), 4);
        expect(resized.rotation).toBe(box.rotation);
        expect(resized.width).toBeGreaterThanOrEqual(1);
        expect(resized.height).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  test('Given a corner handle with Shift, When any box is dragged, Then its proportions never change', () => {
    fc.assert(
      fc.property(
        boxArb,
        fc.constantFrom<Handle>('nw', 'ne', 'se', 'sw'),
        pointArb,
        (box, handle, delta) => {
          const resized = resizeBox(box, handle, delta, { keepAspect: true, minSize: 1 });

          expect(resized.width / resized.height).toBeCloseTo(box.width / box.height, 6);
        },
      ),
    );
  });

  test('Given a drag of zero, When any box is resized, Then it comes back unchanged', () => {
    fc.assert(
      fc.property(boxArb, handleArb, (box, handle) => {
        const same = resizeBox(box, handle, { x: 0, y: 0 });

        expect(same.x).toBeCloseTo(box.x, 6);
        expect(same.y).toBeCloseTo(box.y, 6);
        expect(same.width).toBeCloseTo(box.width, 6);
        expect(same.height).toBeCloseTo(box.height, 6);
      }),
    );
  });

  test('Given the eight handles, When they are classified, Then four are corners', () => {
    expect(HANDLES.filter(isCorner)).toEqual(['nw', 'ne', 'se', 'sw']);
  });
});

describe('rotationAfterDrag (EL-5)', () => {
  const centre = { x: 500, y: 500 };

  test('Given the handle above the centre, When it is dragged to the right of the centre, Then the box turns 90 degrees', () => {
    expect(rotationAfterDrag(0, centre, { x: 500, y: 300 }, { x: 700, y: 500 })).toBeCloseTo(90);
  });

  test('Given a box already turned 170 degrees, When it is turned 20 more, Then the angle wraps to -170', () => {
    expect(rotationAfterDrag(170, centre, { x: 500, y: 300 }, { x: 600, y: 330 })).toBeCloseTo(
      normaliseAngle(170 + angleOf(centre, { x: 600, y: 330 })),
    );
  });

  test('Given a drag with Shift, When the box is turned, Then the angle is a multiple of 15', () => {
    fc.assert(
      fc.property(number(-180, 180), pointArb, pointArb, (start, from, to) => {
        const rotation = rotationAfterDrag(start, centre, from, to, 15);

        expect(Math.abs(rotation / 15 - Math.round(rotation / 15))).toBeLessThan(1e-6);
      }),
    );
  });

  test('Given the pointer has not moved, When the box is turned, Then its rotation is unchanged (no jump on grab)', () => {
    fc.assert(
      fc.property(number(-180, 180), pointArb, (start, p) => {
        expect(rotationAfterDrag(start, centre, p, p)).toBeCloseTo(normaliseAngle(start), 6);
      }),
    );
  });
});

describe('lines (EL-3)', () => {
  test('Given two points, When a line is made between them, Then its ends are those points', () => {
    fc.assert(
      fc.property(pointArb, pointArb, (start, end) => {
        const box = lineBetween(start, end);
        const ends = lineEnds(box);

        near(ends.start, start, 4);
        near(ends.end, end, 4);
        expect(box.height).toBe(0);
      }),
    );
  });

  test('Given a drag with Shift, When a line is made, Then its angle is a multiple of 15 and its length is kept', () => {
    fc.assert(
      fc.property(pointArb, pointArb, (start, end) => {
        const box = lineBetween(start, end, 15);

        expect(Math.abs(box.rotation / 15 - Math.round(box.rotation / 15))).toBeLessThan(1e-6);
        expect(box.width).toBeCloseTo(Math.hypot(end.x - start.x, end.y - start.y), 6);
        near(lineEnds(box).start, start, 4);
      }),
    );
  });

  test('Given a line, When one end is dragged, Then the other end stays exactly where it was', () => {
    fc.assert(
      fc.property(
        boxArb,
        pointArb,
        fc.constantFrom('start', 'end'),
        fc.boolean(),
        (box, pointer, which, snap) => {
          const line = { ...box, height: 0 };
          const before = lineEnds(line);

          const moved = lineEnds(moveLineEnd(line, which, pointer, snap ? 15 : undefined));

          near(
            which === 'start' ? moved.end : moved.start,
            which === 'start' ? before.end : before.start,
            4,
          );
        },
      ),
    );
  });

  test('Given a line dragged without snapping, When its moving end is read, Then it is under the pointer', () => {
    const line = { x: 100, y: 100, width: 200, height: 0, rotation: 0 };

    const ends = lineEnds(moveLineEnd(line, 'end', { x: 400, y: 300 }));

    near(ends.end, { x: 400, y: 300 });
  });
});

describe('boxFromDrag (EL-3)', () => {
  test('Given a drag up and to the left, When the box is drawn, Then it still has a top-left origin and positive size', () => {
    expect(boxFromDrag({ x: 300, y: 300 }, { x: 100, y: 250 })).toEqual({
      x: 100,
      y: 250,
      width: 200,
      height: 50,
    });
  });

  test('Given Shift, When the box is drawn, Then it is a square of the longer side, in the direction of the drag', () => {
    expect(boxFromDrag({ x: 100, y: 100 }, { x: 400, y: 150 }, true)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 300,
    });
    expect(boxFromDrag({ x: 100, y: 100 }, { x: 50, y: 20 }, true)).toEqual({
      x: 20,
      y: 20,
      width: 80,
      height: 80,
    });
  });

  test('Given any drag, When the box is drawn, Then it never has a negative size and holds both ends', () => {
    fc.assert(
      fc.property(pointArb, pointArb, fc.boolean(), (from, to, square) => {
        const box = boxFromDrag(from, to, square);

        expect(box.width).toBeGreaterThanOrEqual(0);
        expect(box.height).toBeGreaterThanOrEqual(0);
        if (!square) {
          expect(from.x).toBeGreaterThanOrEqual(box.x - 1e-9);
          expect(to.x).toBeLessThanOrEqual(box.x + box.width + 1e-9);
        }
      }),
    );
  });
});

describe('groups (EL-5)', () => {
  const boxes: Box[] = [
    { x: 100, y: 100, width: 200, height: 100, rotation: 0 },
    { x: 400, y: 300, width: 100, height: 100, rotation: 0 },
  ];

  test('Given two boxes, When the group is turned 90 degrees and back, Then they are where they began', () => {
    fc.assert(
      fc.property(
        fc.array(boxArb, { minLength: 1, maxLength: 5 }),
        pointArb,
        number(-180, 180),
        (list, centre, degrees) => {
          const there = rotateBoxes(list, centre, degrees);
          const back = rotateBoxes(there, centre, -degrees);

          back.forEach((box, i) => {
            const original = list[i];
            expect(box.x).toBeCloseTo(original?.x ?? 0, 4);
            expect(box.y).toBeCloseTo(original?.y ?? 0, 4);
            expect(normaliseAngle(box.rotation - (original?.rotation ?? 0))).toBeCloseTo(0, 4);
          });
        },
      ),
    );
  });

  test('Given a turned group, When the distances between box centres are read, Then they are unchanged (it turned as one body)', () => {
    const turned = rotateBoxes(boxes, { x: 0, y: 0 }, 37);
    const [a, b] = boxes;
    const [ta, tb] = turned;
    if (!a || !b || !ta || !tb) throw new Error('boxes');

    expect(
      Math.hypot(centerOf(ta).x - centerOf(tb).x, centerOf(ta).y - centerOf(tb).y),
    ).toBeCloseTo(Math.hypot(centerOf(a).x - centerOf(b).x, centerOf(a).y - centerOf(b).y), 6);
  });

  test('Given a scale of 1, When boxes are scaled, Then nothing changes', () => {
    expect(scaleBoxes(boxes, { x: 50, y: 50 }, 1, 1)).toEqual(boxes);
  });

  test('Given a group, When its south-east handle drags it to twice the size, Then every box doubles in size and distance from the top left', () => {
    const bounds = groupBounds(boxes);

    const grown = resizeGroup(boxes, 'se', { x: bounds.width, y: bounds.height });

    expect(grown[0]).toMatchObject({ x: 100, y: 100, width: 400, height: 200 });
    expect(grown[1]).toMatchObject({ x: 700, y: 500, width: 200, height: 200 });
    expect(groupBounds(grown)).toMatchObject({
      x: 100,
      y: 100,
      width: bounds.width * 2,
      height: bounds.height * 2,
    });
  });

  test('Given any upright boxes and handle, When the group is resized, Then the group box follows the drag exactly and the opposite side stays', () => {
    const uprightArb = fc.record({
      x: number(0, 1500),
      y: number(0, 900),
      width: number(20, 400),
      height: number(20, 400),
      rotation: fc.constant(0),
    });
    fc.assert(
      fc.property(
        fc.array(uprightArb, { minLength: 2, maxLength: 5 }),
        handleArb,
        pointArb,
        (list, handle, delta) => {
          const before = groupBounds(list);
          const resized = resizeBox({ ...before, rotation: 0 }, handle, delta);

          const after = groupBounds(resizeGroup(list, handle, delta));

          expect(after.x).toBeCloseTo(resized.x, 4);
          expect(after.y).toBeCloseTo(resized.y, 4);
          expect(after.width).toBeCloseTo(resized.width, 4);
          expect(after.height).toBeCloseTo(resized.height, 4);
        },
      ),
    );
  });

  test('Given a group with no size, When it is resized, Then nothing changes', () => {
    const flat = [{ x: 0, y: 0, width: 100, height: 0, rotation: 0 }];

    expect(resizeGroup(flat, 'e', { x: 50, y: 0 })).toEqual(flat);
  });
});
