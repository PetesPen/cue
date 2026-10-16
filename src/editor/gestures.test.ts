import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_TEXT_WIDTH,
  createShape,
  createText,
  type Box,
  type ElementChange,
  type Id,
} from '@/model';
import {
  ANGLE_STEP,
  DEFAULT_LINE_LENGTH,
  DEFAULT_SHAPE_SIZE,
  MIN_TEXT_WIDTH,
  boxOf,
  boxesOf,
  changesFor,
  drawnShape,
  drawnText,
  groupCentre,
  marqueeRect,
  marqueeSelection,
  pickElement,
  rotationReadout,
  snapPointer,
  type Gesture,
} from './gestures';
import { canEditText } from './shapeLabels';

const rect = (id: string, x: number, y: number, width = 100, height = 100, rotation = 0) =>
  createShape(id, 'rectangle', { x, y, width, height, rotation });

const byId = (changes: ElementChange[], id: Id) => changes.find((c) => c.id === id)?.props;

describe('move (EL-5)', () => {
  test('Given a rectangle at (200, 100), When it is dragged 300 right and 50 down, Then it is at (500, 150)', () => {
    const a = rect('a', 200, 100);
    const gesture: Gesture = { kind: 'move', start: { x: 0, y: 0 }, boxes: boxesOf([a]) };

    expect(byId(changesFor(gesture, { x: 300, y: 50 }, false), 'a')).toMatchObject({
      x: 500,
      y: 150,
    });
  });

  test('Given two shapes selected, When they are dragged, Then both move by the same amount and keep their gap', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 400, 300);
    const gesture: Gesture = { kind: 'move', start: { x: 10, y: 10 }, boxes: boxesOf([a, b]) };

    const changes = changesFor(gesture, { x: 60, y: -20 }, false);

    expect(byId(changes, 'a')).toMatchObject({ x: 150, y: 70 });
    expect(byId(changes, 'b')).toMatchObject({ x: 450, y: 270 });
  });

  test('Given a drag that returns to where it began, When the changes are read, Then nothing has moved', () => {
    const a = rect('a', 200, 100);
    const gesture: Gesture = { kind: 'move', start: { x: 5, y: 5 }, boxes: boxesOf([a]) };

    expect(byId(changesFor(gesture, { x: 5, y: 5 }, false), 'a')).toMatchObject({ x: 200, y: 100 });
  });
});

describe('resize (EL-5)', () => {
  test('Given a selected shape, When its corner handle is dragged, Then it grows about the opposite corner', () => {
    const a = rect('a', 100, 100, 200, 100);
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 300, y: 200 },
      handle: 'se',
      boxes: boxesOf([a]),
    };

    expect(byId(changesFor(gesture, { x: 350, y: 230 }, false), 'a')).toMatchObject({
      x: 100,
      y: 100,
      width: 250,
      height: 130,
    });
  });

  test('Given Shift, When a corner is dragged, Then the proportions are kept', () => {
    const a = rect('a', 100, 100, 200, 100);
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 300, y: 200 },
      handle: 'se',
      boxes: boxesOf([a]),
    };

    const props = byId(changesFor(gesture, { x: 400, y: 210 }, true), 'a');

    expect((props?.width ?? 0) / (props?.height ?? 1)).toBeCloseTo(2, 6);
  });

  test('Given two shapes selected, When the group handle is dragged, Then both scale with the group box', () => {
    const a = rect('a', 100, 100, 100, 100);
    const b = rect('b', 300, 100, 100, 100);
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 400, y: 200 },
      handle: 'se',
      boxes: boxesOf([a, b]),
    };

    const changes = changesFor(gesture, { x: 700, y: 200 }, false);

    // The group was 300 wide (100 to 400) and is now 600: everything doubles about its left edge.
    expect(byId(changes, 'a')).toMatchObject({ x: 100, width: 200, height: 100 });
    expect(byId(changes, 'b')).toMatchObject({ x: 500, width: 200 });
  });
});

describe('rotate (EL-5)', () => {
  test('Given a selected shape, When the rotation handle is dragged a quarter turn, Then it is turned 90 degrees', () => {
    const a = rect('a', 400, 400, 200, 200);
    const centre = { x: 500, y: 500 };
    const gesture: Gesture = {
      kind: 'rotate',
      start: { x: centre.x, y: 380 },
      boxes: boxesOf([a]),
    };

    const changes = changesFor(gesture, { x: 640, y: 500 }, false);

    expect(byId(changes, 'a')?.rotation).toBeCloseTo(90, 6);
    expect(rotationReadout(changes)).toBe(90);
  });

  test('Given Shift, When the rotation handle is dragged, Then the angle snaps to steps of 15', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 400 }), fc.integer({ min: -400, max: 400 }), (x, y) => {
        const a = rect('a', 400, 400, 200, 200);
        const gesture: Gesture = {
          kind: 'rotate',
          start: { x: 500, y: 380 },
          boxes: boxesOf([a]),
        };

        const angle =
          byId(changesFor(gesture, { x: 500 + x, y: 500 + y }, true), 'a')?.rotation ?? 0;

        expect(Math.abs(angle / ANGLE_STEP - Math.round(angle / ANGLE_STEP))).toBeLessThan(1e-6);
      }),
    );
  });

  test('Given two shapes, When the group is turned 90 degrees, Then both turn and swing round the group centre, keeping their distance', () => {
    const a = rect('a', 100, 100, 100, 100);
    const b = rect('b', 300, 100, 100, 100);
    const boxes = boxesOf([a, b]);
    const centre = groupCentre(boxes);
    const gesture: Gesture = { kind: 'rotate', start: { x: centre.x, y: 0 }, boxes };

    const changes = changesFor(gesture, { x: centre.x + 500, y: centre.y }, false);

    expect(byId(changes, 'a')?.rotation).toBeCloseTo(90, 6);
    expect(byId(changes, 'b')?.rotation).toBeCloseTo(90, 6);
    const ax = (byId(changes, 'a')?.x ?? 0) + 50;
    const bx = (byId(changes, 'b')?.x ?? 0) + 50;
    // Side by side before; one above the other after.
    expect(ax).toBeCloseTo(bx, 4);
  });
});

describe('line ends (EL-3)', () => {
  test('Given a line, When its end is dragged to a new point, Then the other end stays and the end is under the pointer', () => {
    const line = createShape('l', 'line', { x: 100, y: 100, width: 200, height: 0 });
    const gesture: Gesture = {
      kind: 'lineEnd',
      start: { x: 300, y: 100 },
      which: 'end',
      id: 'l',
      box: boxOf(line),
    };

    const props = changesFor(gesture, { x: 100, y: 400 }, false)[0]?.props;

    expect(props?.width).toBeCloseTo(300, 6);
    expect(props?.rotation).toBeCloseTo(90, 6);
    expect(props?.height).toBe(0);
  });
});

describe('drawing (EL-3)', () => {
  const start = { x: 500, y: 400 };

  test('Given the rectangle tool, When the pointer is dragged, Then the rectangle spans the two points', () => {
    const shape = drawnShape(
      { kind: 'draw', start, shape: 'rectangle', id: 'n' },
      { x: 300, y: 450 },
      false,
      true,
    );

    expect(shape).toMatchObject({ x: 300, y: 400, width: 200, height: 50, shape: 'rectangle' });
  });

  test('Given Shift, When a shape is drawn, Then it is a square', () => {
    const shape = drawnShape(
      { kind: 'draw', start, shape: 'ellipse', id: 'n' },
      { x: 700, y: 450 },
      true,
      true,
    );

    expect(shape.width).toBe(shape.height);
    expect(shape.width).toBe(200);
  });

  test('Given a click without a drag, When a shape is drawn, Then it is the default size, centred on the click', () => {
    const shape = drawnShape(
      { kind: 'draw', start, shape: 'triangle', id: 'n' },
      start,
      false,
      false,
    );

    expect(shape).toMatchObject({
      x: 500 - DEFAULT_SHAPE_SIZE.width / 2,
      y: 400 - DEFAULT_SHAPE_SIZE.height / 2,
      ...DEFAULT_SHAPE_SIZE,
    });
  });

  test('Given a click with the line tool, When a line is drawn, Then it is a level line of the default length centred on the click', () => {
    const line = drawnShape({ kind: 'draw', start, shape: 'line', id: 'n' }, start, false, false);

    expect(line.width).toBeCloseTo(DEFAULT_LINE_LENGTH, 6);
    expect(line.height).toBe(0);
    expect(line.rotation).toBeCloseTo(0, 6);
    expect(line.x + line.width / 2).toBeCloseTo(500, 6);
  });

  test('Given the arrow tool dragged with Shift, When an arrow is drawn, Then its angle is a multiple of 15', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -600, max: 600 }),
        fc.integer({ min: -600, max: 600 }),
        (dx, dy) => {
          fc.pre(Math.hypot(dx, dy) > 1);

          const arrow = drawnShape(
            { kind: 'draw', start, shape: 'arrow', id: 'n' },
            { x: 500 + dx, y: 400 + dy },
            true,
            true,
          );

          expect(
            Math.abs(arrow.rotation / ANGLE_STEP - Math.round(arrow.rotation / ANGLE_STEP)),
          ).toBeLessThan(1e-6);
          expect(arrow.shape).toBe('arrow');
        },
      ),
    );
  });
});

describe('selecting (EL-5)', () => {
  const a = rect('a', 100, 100);
  const b = rect('b', 300, 100);
  const c = rect('c', 900, 600);

  test('Given overlapping shapes, When a point is picked, Then the topmost one is chosen', () => {
    const top = rect('top', 120, 120);

    expect(pickElement([a, top], { x: 150, y: 150 }, 10)?.id).toBe('top');
    expect(pickElement([top, a], { x: 150, y: 150 }, 10)?.id).toBe('a');
  });

  test('Given empty space, When a point is picked, Then nothing is chosen', () => {
    expect(pickElement([a, b, c], { x: 700, y: 900 }, 10)).toBeUndefined();
  });

  test('Given a line, When a point near it is picked, Then the line is chosen, but a rectangle needs a point on it', () => {
    const line = createShape('l', 'line', { x: 100, y: 500, width: 400, height: 0 });

    expect(pickElement([line], { x: 300, y: 506 }, 10)?.id).toBe('l');
    expect(pickElement([a], { x: 98, y: 150 }, 10)).toBeUndefined();
  });

  test('Given a selection box, When it holds two shapes completely, Then those two are selected; a shape it only touches is not', () => {
    const area = marqueeRect({ x: 50, y: 50 }, { x: 450, y: 250 });
    const touching = rect('t', 400, 50, 200, 100);

    expect(marqueeSelection(area, [a, b, c, touching], false, [])).toEqual(['a', 'b']);
  });

  test('Given a selection box drawn backwards with Shift, When it ends, Then its shapes are added to the earlier selection', () => {
    const area = marqueeRect({ x: 450, y: 250 }, { x: 50, y: 50 });

    expect(marqueeSelection(area, [a, b, c], true, ['c'])).toEqual(['c', 'a', 'b']);
  });

  test('Given a selection of boxes, When their elements are read, Then boxOf and boxesOf agree', () => {
    const box: Box = boxOf(a);

    expect(boxesOf([a]).get('a')).toEqual(box);
  });
});

describe('drawing a text box (EL-1)', () => {
  const gesture = { kind: 'drawText', start: { x: 500, y: 400 }, id: 'n' } as const;

  test('Given the text tool, When the slide is clicked, Then a text box of the usual width starts at that point', () => {
    const text = drawnText(gesture, { x: 500, y: 400 }, false);

    expect(text).toMatchObject({ kind: 'text', x: 500, y: 400, width: DEFAULT_TEXT_WIDTH });
  });

  test('Given the text tool, When the pointer is dragged, Then the box is as wide as the drag and starts at its top left', () => {
    const text = drawnText(gesture, { x: 900, y: 460 }, true);

    expect(text).toMatchObject({ x: 500, y: 400, width: 400 });
  });

  test('Given a drag towards the top left, When it ends, Then the box still starts at its top left', () => {
    const text = drawnText(gesture, { x: 300, y: 350 }, true);

    expect(text).toMatchObject({ x: 300, y: 350, width: 200 });
  });

  test('Given a very short drag, When it ends, Then the box is not narrower than the minimum', () => {
    const text = drawnText(gesture, { x: 510, y: 405 }, true);

    expect(text.width).toBe(MIN_TEXT_WIDTH);
  });
});

describe('what can hold text (EL-1, EL-3)', () => {
  test.each([
    ['rectangle', true],
    ['roundedRectangle', true],
    ['ellipse', true],
    ['triangle', true],
    ['line', false],
    ['arrow', false],
  ] as const)('Given a %s, When asked if it can be edited as text, Then %s', (shape, can) => {
    expect(canEditText(createShape('s', shape, { x: 0, y: 0, width: 100, height: 100 }))).toBe(can);
  });

  test('Given a text box, When asked if it can be edited as text, Then yes', () => {
    expect(canEditText(createText('t', { x: 0, y: 0 }))).toBe(true);
  });
});

describe('resizing a picture (EL-4)', () => {
  const picture = rect('p', 100, 100, 400, 200);

  test('Given a picture, When a corner is dragged sideways only, Then it keeps its proportions', () => {
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 500, y: 300 },
      handle: 'se',
      boxes: boxesOf([picture]),
      lockAspect: true,
    };

    const resized = byId(changesFor(gesture, { x: 700, y: 300 }, false), 'p');

    expect((resized?.width ?? 0) / (resized?.height ?? 1)).toBeCloseTo(2, 2);
    expect(resized?.width).toBeGreaterThan(400);
  });

  test('Given a picture, When a side is dragged, Then it is stretched on purpose', () => {
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 500, y: 200 },
      handle: 'e',
      boxes: boxesOf([picture]),
      lockAspect: false,
    };

    expect(byId(changesFor(gesture, { x: 700, y: 200 }, false), 'p')).toMatchObject({
      width: 600,
      height: 200,
    });
  });

  test('Given anything else, When a corner is dragged, Then proportions are free unless Shift is held', () => {
    const shape = rect('a', 100, 100, 400, 200);
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 500, y: 300 },
      handle: 'se',
      boxes: boxesOf([shape]),
    };

    expect(byId(changesFor(gesture, { x: 700, y: 300 }, false), 'a')).toMatchObject({
      width: 600,
      height: 200,
    });
    const held = byId(changesFor(gesture, { x: 700, y: 300 }, true), 'a');
    expect((held?.width ?? 0) / (held?.height ?? 1)).toBeCloseTo(2, 2);
  });
});

describe('snapping a drag (EL-6)', () => {
  const slide = { x: 0, y: 0, width: 1920, height: 1080 };
  const context = (others: { x: number; y: number; width: number; height: number }[] = []) => ({
    others,
    slide,
    threshold: 6,
  });

  test('Given a move that ends near the left edge of the slide, When the pointer is snapped, Then the change lands the box on the edge', () => {
    const a = rect('a', 200, 300);
    const gesture: Gesture = { kind: 'move', start: { x: 0, y: 0 }, boxes: boxesOf([a]) };

    const aimed = snapPointer(gesture, { x: -195, y: 0 }, false, context());

    expect(aimed.guides).toHaveLength(1);
    expect(byId(changesFor(gesture, aimed.pointer, false), 'a')).toMatchObject({ x: 0, y: 300 });
  });

  test('Given a move near another element, When the pointer is snapped, Then the box lines up with it', () => {
    const a = rect('a', 100, 100);
    const other = { x: 500, y: 600, width: 300, height: 100 };
    const gesture: Gesture = { kind: 'move', start: { x: 0, y: 0 }, boxes: boxesOf([a]) };

    // The box ends at x 403: its right edge (503) is 3 past the other's left edge (500).
    const aimed = snapPointer(gesture, { x: 303, y: 0 }, false, context([other]));

    expect(byId(changesFor(gesture, aimed.pointer, false), 'a')).toMatchObject({ x: 400 });
  });

  test('Given a move of a group, When it is snapped, Then the box around the group is what lines up', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 400, 100);
    const gesture: Gesture = { kind: 'move', start: { x: 0, y: 0 }, boxes: boxesOf([a, b]) };

    // The group (100 to 500) is moved to start at x 4: it snaps to 0.
    const aimed = snapPointer(gesture, { x: -96, y: 0 }, false, context());

    const changes = changesFor(gesture, aimed.pointer, false);
    expect(byId(changes, 'a')?.x).toBe(0);
    expect(byId(changes, 'b')?.x).toBe(300);
  });

  test('Given a move that is far from every line, When the pointer is snapped, Then it is as it was', () => {
    const a = rect('a', 333, 222);
    const gesture: Gesture = { kind: 'move', start: { x: 0, y: 0 }, boxes: boxesOf([a]) };

    expect(snapPointer(gesture, { x: 10, y: 10 }, false, context())).toEqual({
      pointer: { x: 10, y: 10 },
      guides: [],
    });
  });

  test('Given a resize by the right handle that ends near the slide edge, When the pointer is snapped, Then the edge lands on it', () => {
    const a = rect('a', 1500, 300, 400, 100);
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 0, y: 0 },
      handle: 'e',
      boxes: boxesOf([a]),
    };

    // The right edge (1900) is dragged 17 to 1917, 3 short of the slide's edge.
    const aimed = snapPointer(gesture, { x: 17, y: 0 }, false, context());

    expect(byId(changesFor(gesture, aimed.pointer, false), 'a')).toMatchObject({
      x: 1500,
      width: 420,
    });
  });

  test.each([
    [
      'a resize that keeps its proportions (Shift)',
      rect('a', 1500, 300, 400, 100),
      true,
      undefined,
    ],
    ['a picture dragged by a corner', rect('a', 1500, 300, 400, 100), false, true],
  ] as const)(
    'Given %s, When the pointer is snapped, Then the resize is left free',
    (_name, element, shift, lockAspect) => {
      const gesture: Gesture = {
        kind: 'resize',
        start: { x: 0, y: 0 },
        handle: 'se',
        boxes: boxesOf([element]),
        ...(lockAspect === undefined ? {} : { lockAspect }),
      };

      expect(snapPointer(gesture, { x: 17, y: 17 }, shift, context()).pointer).toEqual({
        x: 17,
        y: 17,
      });
    },
  );

  test('Given any other gesture, When the pointer is snapped, Then it is as it was', () => {
    const a = rect('a', 100, 100);
    const gesture: Gesture = { kind: 'rotate', start: { x: 0, y: 0 }, boxes: boxesOf([a]) };

    expect(snapPointer(gesture, { x: 3, y: 4 }, false, context()).guides).toEqual([]);
  });
});

describe('snapping a turned box being resized (EL-6)', () => {
  const slide = { x: 0, y: 0, width: 1920, height: 1080 };
  const context = { others: [], slide, threshold: 6 };
  const turned = (rotation: number) => ({ ...rect('a', 1500, 300, 400, 100), rotation });

  /** Where the corner or edge being dragged is, in slide pixels, after the change. */
  const handleAt = (change: ElementChange | undefined, handle: 'se' | 'e') => {
    const p = change?.props;
    const box = {
      x: p?.x ?? 0,
      y: p?.y ?? 0,
      width: p?.width ?? 0,
      height: p?.height ?? 0,
      rotation: p?.rotation ?? 0,
    };
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const local = { x: box.width / 2, y: handle === 'se' ? box.height / 2 : 0 };
    const turn = (box.rotation * Math.PI) / 180;
    return {
      x: centre.x + local.x * Math.cos(turn) - local.y * Math.sin(turn),
      y: centre.y + local.x * Math.sin(turn) + local.y * Math.cos(turn),
    };
  };

  test('Given a turned box and its corner dragged near the right edge of the slide, When the pointer is snapped, Then the corner lands on the edge', () => {
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 0, y: 0 },
      handle: 'se',
      boxes: boxesOf([turned(30)]),
    };
    // The corner (the box's bottom right) starts at about x 1900 + a turn; find how far it has to go.
    const before = handleAt(changesFor(gesture, { x: 0, y: 0 }, false)[0], 'se');
    const pointer = { x: 1920 - before.x - 4, y: 0 };

    const aimed = snapPointer(gesture, pointer, false, context);

    expect(aimed.guides).toHaveLength(1);
    const landed = handleAt(changesFor(gesture, aimed.pointer, false)[0], 'se');
    // Positions are whole slide pixels, so the corner is within one of the edge.
    expect(Math.abs(landed.x - 1920)).toBeLessThan(1);
  });

  test('Given a turned box and the middle of its right edge dragged near the slide edge, When the pointer is snapped, Then it lands on the edge, moving along the box own direction', () => {
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 0, y: 0 },
      handle: 'e',
      boxes: boxesOf([turned(20)]),
    };
    const before = handleAt(changesFor(gesture, { x: 0, y: 0 }, false)[0], 'e');
    // The pointer moves along the box's own direction (20 degrees), ending 4 short of x 1920.
    const along = { x: Math.cos((20 * Math.PI) / 180), y: Math.sin((20 * Math.PI) / 180) };
    const reach = (1920 - before.x - 4) / along.x;
    const pointer = { x: along.x * reach, y: along.y * reach };

    const aimed = snapPointer(gesture, pointer, false, context);

    const landed = handleAt(changesFor(gesture, aimed.pointer, false)[0], 'e');
    expect(Math.abs(landed.x - 1920)).toBeLessThan(1);
    // The corrected pointer is still on the box's own line: the box was only resized, not slid.
    expect(aimed.pointer.y / aimed.pointer.x).toBeCloseTo(along.y / along.x, 6);
  });

  test('Given an edge that meets a guide at a slant, When the pointer is snapped, Then it does not snap to it', () => {
    // Turned 80 degrees, the right edge moves almost straight down: it would have to travel far to reach
    // a vertical guide, so it is left alone.
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 0, y: 0 },
      handle: 'e',
      boxes: boxesOf([turned(80)]),
    };
    const before = handleAt(changesFor(gesture, { x: 0, y: 0 }, false)[0], 'e');
    const pointer = { x: 1920 - before.x - 3, y: 0 };

    const aimed = snapPointer(gesture, pointer, false, context);

    expect(aimed.pointer).toEqual(pointer);
  });

  test('Given a turned box and a corner far from every guide, When the pointer is snapped, Then it is as it was', () => {
    const gesture: Gesture = {
      kind: 'resize',
      start: { x: 0, y: 0 },
      handle: 'se',
      boxes: boxesOf([{ ...rect('a', 300, 300, 400, 100), rotation: 30 }]),
    };

    expect(snapPointer(gesture, { x: 11, y: 7 }, false, context)).toEqual({
      pointer: { x: 11, y: 7 },
      guides: [],
    });
  });
});
