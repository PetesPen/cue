import {
  boundsOf,
  boxFromDrag,
  centerOf,
  containsPoint,
  createShape,
  createText,
  groupBounds,
  guideAt,
  handleEdges,
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
  rotatePoint,
  rotationAfterDrag,
  snapEdges,
  snapHandle,
  snapMove,
  unionRect,
  type Box,
  type ElementChange,
  type Guide,
  type Handle,
  type Id,
  type Point,
  type Rect,
  type ShapeElement,
  type ShapeKind,
  type Slide,
  type SlideElement,
  type TextElement,
} from '@/model';
import { isLineElement } from './shapeLabels';

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
      /** A picture dragged by a corner keeps its proportions, as Shift does for anything. */
      readonly lockAspect?: boolean;
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
    }
  | { readonly kind: 'drawText'; readonly start: Point; readonly id: Id };

/** What the toolbar has armed for the next drag on the slide: a shape, or a text box. */
export type Tool = ShapeKind | 'text';

/** Snap lines and rotations to this many degrees while Shift is held. */
export const ANGLE_STEP = 15;

/** A pointer must move this far (screen pixels) before a click becomes a drag. */
export const DRAG_THRESHOLD = 3;

/** A box snaps to a guide when it comes this near (screen pixels, so it does not depend on the zoom). */
export const SNAP_DISTANCE = 6;

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
          {
            id,
            props: asProps(
              resizeBox(box, gesture.handle, delta, {
                keepAspect: shift || gesture.lockAspect === true,
              }),
            ),
          },
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
    case 'drawText':
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

/** A text box no narrower than this (slide pixels) is made by dragging. */
export const MIN_TEXT_WIDTH = 80;

/**
 * The text box a click or drag has made: a click puts the default width at that point, a drag sets the
 * width (and where it starts). Its height is the editor's to measure from the text.
 */
export function drawnText(
  gesture: Extract<Gesture, { kind: 'drawText' }>,
  pointer: Point,
  moved: boolean,
): TextElement {
  const { id, start } = gesture;
  if (!moved) return createText(id, { x: Math.round(start.x), y: Math.round(start.y) });
  const drawn = boxFromDrag(start, pointer);
  return createText(id, {
    x: Math.round(drawn.x),
    y: Math.round(drawn.y),
    width: Math.max(MIN_TEXT_WIDTH, Math.round(drawn.width)),
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
    if (element && containsPoint(boxOf(element), point, isLineElement(element) ? lineSlop : 0)) {
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

// Snapping (EL-6) ---------------------------------------------------------------------------------

/** What a dragged box can line up with. */
export interface SnapContext {
  /** The outer boxes of the elements that are not being dragged. */
  readonly others: readonly Rect[];
  readonly slide: Rect;
  /** How near a line has to be to snap, in slide pixels (a few screen pixels at the zoom now). */
  readonly threshold: number;
}

/**
 * The pointer moved so that the gesture lands on a guide: a move whose edges or middles come near
 * those of the slide or another element, a resize whose dragged edge does. Feeding the result to
 * `changesFor` gives the snapped change, so snapping needs no code of its own in the gestures. A turned
 * element snaps the handle being dragged (its sides are not the upright lines the guides are); a resize
 * that keeps its proportions is free; and the guides are what a snap shows while it holds.
 */
export function snapPointer(
  gesture: Gesture,
  pointer: Point,
  shift: boolean,
  context: SnapContext,
): { readonly pointer: Point; readonly guides: readonly Guide[] } {
  const none = { pointer, guides: [] };
  const delta = { x: pointer.x - gesture.start.x, y: pointer.y - gesture.start.y };
  if (gesture.kind === 'move') {
    const moved = unionRect(
      [...gesture.boxes.values()].map((box) => boundsOf(moveBox(box, delta.x, delta.y))),
    );
    const snap = snapMove(moved, context.others, context.slide, context.threshold);
    return { pointer: { x: pointer.x + snap.dx, y: pointer.y + snap.dy }, guides: snap.guides };
  }
  if (gesture.kind === 'resize' && !shift && gesture.lockAspect !== true) {
    const entries = [...gesture.boxes.values()];
    const only = entries[0];
    if (entries.length !== 1 || !only) return none;
    if (only.rotation !== 0)
      return snapTurnedResize(only, gesture.handle, gesture.start, pointer, context);
    const resized = resizeBox(only, gesture.handle, delta, {});
    const snap = snapEdges(
      resized,
      handleEdges(gesture.handle),
      context.others,
      context.slide,
      context.threshold,
    );
    return { pointer: { x: pointer.x + snap.dx, y: pointer.y + snap.dy }, guides: snap.guides };
  }
  return none;
}

/**
 * A turned box resized by a handle (EL-6): its sides are not upright, so it is the handle itself, the
 * corner or the middle of the edge being dragged, that snaps to the guides. See `snapHandle`.
 */
function snapTurnedResize(
  box: Box,
  handle: Handle,
  start: Point,
  pointer: Point,
  context: SnapContext,
): { readonly pointer: Point; readonly guides: readonly Guide[] } {
  const edges = handleEdges(handle);
  const drag = (to: Point) => ({ x: to.x - start.x, y: to.y - start.y });
  const resized = resizeBox(box, handle, drag(pointer), {});
  const centre = centerOf(resized);
  const local = { x: (edges.x * resized.width) / 2, y: (edges.y * resized.height) / 2 };
  const offset = rotatePoint(local, { x: 0, y: 0 }, resized.rotation);
  const corner = edges.x !== 0 && edges.y !== 0;
  // An edge moves along its own direction, turned with the box.
  const along = rotatePoint(
    edges.x !== 0 ? { x: 1, y: 0 } : { x: 0, y: 1 },
    { x: 0, y: 0 },
    box.rotation,
  );
  const snap = snapHandle(
    { x: centre.x + offset.x, y: centre.y + offset.y },
    corner ? undefined : along,
    context.others,
    context.slide,
    context.threshold,
  );
  if (snap.lines.length === 0) return { pointer, guides: [] };
  const aimed = { x: pointer.x + snap.correction.x, y: pointer.y + snap.correction.y };
  const landed = boundsOf(resizeBox(box, handle, drag(aimed), {}));
  return {
    pointer: aimed,
    guides: snap.lines.map((line) =>
      guideAt(line.axis, line.at, landed, context.others, context.slide),
    ),
  };
}
