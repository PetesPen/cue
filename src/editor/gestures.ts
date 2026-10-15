import {
  boxFromDrag,
  centerOf,
  containsPoint,
  createShape,
  groupBounds,
  isLine,
  lineBetween,
  moveBox,
  moveLineEnd,
  normaliseAngle,
  normaliseProps,
  rectEncloses,
  resizeBox,
  resizeGroup,
  rotateBoxes,
  rotationAfterDrag,
  type Box,
  type ElementChange,
  type Handle,
  type Id,
  type Point,
  type Rect,
  type ShapeElement,
  type ShapeKind,
  type Slide,
  type SlideElement,
} from '@/model';

/**
 * What a drag on the canvas does, as pure functions of where the pointer started and is now, both in
 * slide pixels. The canvas turns pointer events into these, shows the result as a draft, and commits
 * one command when the drag ends (decision 18).
 */

export type Gesture =
  | { readonly kind: 'move'; readonly start: Point; readonly boxes: ReadonlyMap<Id, Box> }
  | {
      readonly kind: 'resize';
      readonly start: Point;
      readonly handle: Handle;
      readonly boxes: ReadonlyMap<Id, Box>;
    }
  | {
      readonly kind: 'lineEnd';
      readonly start: Point;
      readonly which: 'start' | 'end';
      readonly id: Id;
      readonly box: Box;
    }
  | { readonly kind: 'rotate'; readonly start: Point; readonly boxes: ReadonlyMap<Id, Box> }
  | {
      readonly kind: 'marquee';
      readonly start: Point;
      readonly additive: boolean;
      readonly previous: readonly Id[];
    }
  | {
      readonly kind: 'draw';
      readonly start: Point;
      readonly shape: ShapeKind;
      readonly id: Id;
    };

/** Snap lines and rotations to this many degrees while Shift is held. */
export const ANGLE_STEP = 15;

/** A pointer must move this far (screen pixels) before a click becomes a drag. */
export const DRAG_THRESHOLD = 3;

/** The size of a shape made by a click rather than a drag (slide pixels). */
export const DEFAULT_SHAPE_SIZE = { width: 360, height: 240 } as const;
export const DEFAULT_LINE_LENGTH = 400;

/** Positions and sizes are kept to whole slide pixels, so the panel shows tidy numbers. */
const asProps = (box: Box) => ({
  x: Math.round(box.x),
  y: Math.round(box.y),
  width: Math.round(box.width),
  height: Math.round(box.height),
  rotation: box.rotation,
});

export function boxOf(element: SlideElement): Box {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
  };
}

export function boxesOf(elements: readonly SlideElement[]): Map<Id, Box> {
  return new Map(elements.map((element) => [element.id, boxOf(element)]));
}

/** The centre of the box around a whole selection: the turning point of a group. */
export function groupCentre(boxes: ReadonlyMap<Id, Box>): Point {
  return centerOf(groupBounds([...boxes.values()]));
}

/** The property changes a move, resize or rotation makes at this pointer position. */
export function changesFor(gesture: Gesture, pointer: Point, shift: boolean): ElementChange[] {
  const delta = { x: pointer.x - gesture.start.x, y: pointer.y - gesture.start.y };

  switch (gesture.kind) {
    case 'move':
      return [...gesture.boxes].map(([id, box]) => ({
        id,
        props: asProps(moveBox(box, delta.x, delta.y)),
      }));

    case 'resize': {
      const entries = [...gesture.boxes];
      const only = entries[0];
      if (entries.length === 1 && only) {
        const [id, box] = only;
        return [
          { id, props: asProps(resizeBox(box, gesture.handle, delta, { keepAspect: shift })) },
        ];
      }
      const resized = resizeGroup(
        entries.map(([, box]) => box),
        gesture.handle,
        delta,
        { keepAspect: shift },
      );
      return entries.map(([id, box], index) => ({ id, props: asProps(resized[index] ?? box) }));
    }

    case 'lineEnd':
      return [
        {
          id: gesture.id,
          props: asProps(
            moveLineEnd(gesture.box, gesture.which, pointer, shift ? ANGLE_STEP : undefined),
          ),
        },
      ];

    case 'rotate': {
      const entries = [...gesture.boxes];
      const only = entries[0];
      const snap = shift ? ANGLE_STEP : undefined;
      if (entries.length === 1 && only) {
        const [id, box] = only;
        return [
          {
            id,
            props: {
              rotation: rotationAfterDrag(
                box.rotation,
                centerOf(box),
                gesture.start,
                pointer,
                snap,
              ),
            },
          },
        ];
      }
      const centre = groupCentre(gesture.boxes);
      const turn = rotationAfterDrag(0, centre, gesture.start, pointer, snap);
      const turned = rotateBoxes(
        entries.map(([, box]) => box),
        centre,
        turn,
      );
      return entries.map(([id, box], index) => ({ id, props: asProps(turned[index] ?? box) }));
    }

    case 'marquee':
    case 'draw':
      return [];
  }
}

/** The angle a rotation drag has turned the selection to, for the readout. */
export function rotationReadout(changes: readonly ElementChange[]): number | undefined {
  const [first] = changes;
  const rotation = first?.props.rotation;
  return rotation === undefined ? undefined : Math.round(normaliseAngle(rotation));
}

// Drawing -------------------------------------------------------------------------------------

/** The shape a draw drag has made so far (or the default shape if the pointer has not moved). */
export function drawnShape(
  gesture: Extract<Gesture, { kind: 'draw' }>,
  pointer: Point,
  shift: boolean,
  moved: boolean,
): ShapeElement {
  const { shape, id, start } = gesture;
  if (isLine(shape)) {
    const line = moved
      ? lineBetween(start, pointer, shift ? ANGLE_STEP : undefined)
      : lineBetween(
          { x: start.x - DEFAULT_LINE_LENGTH / 2, y: start.y },
          { x: start.x + DEFAULT_LINE_LENGTH / 2, y: start.y },
        );
    return createShape(id, shape, {
      ...line,
      x: Math.round(line.x),
      y: Math.round(line.y),
      width: Math.round(line.width),
    });
  }
  if (!moved) {
    return createShape(id, shape, {
      x: start.x - DEFAULT_SHAPE_SIZE.width / 2,
      y: start.y - DEFAULT_SHAPE_SIZE.height / 2,
      ...DEFAULT_SHAPE_SIZE,
    });
  }
  const drawn = boxFromDrag(start, pointer, shift);
  return createShape(id, shape, {
    x: Math.round(drawn.x),
    y: Math.round(drawn.y),
    width: Math.round(drawn.width),
    height: Math.round(drawn.height),
  });
}

// Selecting with a box --------------------------------------------------------------------------

export function marqueeRect(start: Point, pointer: Point): Rect {
  return boxFromDrag(start, pointer);
}

/** The elements the selection box fully holds; with Shift they are added to what was selected. */
export function marqueeSelection(
  rect: Rect,
  elements: readonly SlideElement[],
  additive: boolean,
  previous: readonly Id[],
): Id[] {
  const inside = elements.filter((element) => rectEncloses(rect, boxOf(element))).map((e) => e.id);
  return additive ? [...new Set([...previous, ...inside])] : inside;
}

// Picking -----------------------------------------------------------------------------------------

/** The topmost element under the point. A line has no height, so it is picked within `lineSlop` of it. */
export function pickElement(
  elements: readonly SlideElement[],
  point: Point,
  lineSlop: number,
): SlideElement | undefined {
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (element && containsPoint(boxOf(element), point, isLine(element.shape) ? lineSlop : 0)) {
      return element;
    }
  }
  return undefined;
}

// Drafts ------------------------------------------------------------------------------------------

/**
 * The slide as the canvas shows it during a drag: the draft changes laid over the saved slide, plus
 * a shape being drawn on top. Elements the draft does not touch stay the very same objects, so the
 * renderer redraws only what moved.
 */
export function applyDraft(
  slide: Slide,
  draft: readonly ElementChange[] | undefined,
  drawing: SlideElement | undefined,
): Slide {
  if ((!draft || draft.length === 0) && !drawing) return slide;
  const changes = new Map((draft ?? []).map((change) => [change.id, change.props]));
  const elements = slide.elements.map((element) => {
    const props = changes.get(element.id);
    return props ? { ...element, ...normaliseProps(props) } : element;
  });
  return { ...slide, elements: drawing ? [...elements, drawing] : elements };
}
