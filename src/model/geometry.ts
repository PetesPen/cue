/**
 * Pure geometry for direct manipulation (EL-5, EL-3). Slide space is 1920 x 1080 with y pointing
 * down, so a positive angle turns clockwise, as in CSS. A box turns about its centre.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** An upright rectangle. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A rectangle that may be turned (clockwise, degrees, about its centre). */
export interface Box extends Rect {
  readonly rotation: number;
}

const RADIANS = Math.PI / 180;

export function centerOf(box: Rect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function rotatePoint(point: Point, about: Point, degrees: number): Point {
  const cos = Math.cos(degrees * RADIANS);
  const sin = Math.sin(degrees * RADIANS);
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return { x: about.x + dx * cos - dy * sin, y: about.y + dx * sin + dy * cos };
}

/** Angles are kept in (-180, 180]. */
export function normaliseAngle(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** The four corners in the order top left, top right, bottom right, bottom left, as drawn. */
export function cornersOf(box: Box): [Point, Point, Point, Point] {
  const c = centerOf(box);
  const corner = (x: number, y: number) => rotatePoint({ x, y }, c, box.rotation);
  return [
    corner(box.x, box.y),
    corner(box.x + box.width, box.y),
    corner(box.x + box.width, box.y + box.height),
    corner(box.x, box.y + box.height),
  ];
}

/** The smallest upright rectangle that holds the (turned) box. */
export function boundsOf(box: Box): Rect {
  const points = cornersOf(box);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export function unionRect(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The box that holds a whole selection: upright, around every selected box. */
export function groupBounds(boxes: readonly Box[]): Rect {
  return unionRect(boxes.map(boundsOf));
}

/**
 * Is the point on the box? `slop` widens it on every side (in slide pixels) so that a line, which
 * has no height, can still be picked.
 */
export function containsPoint(box: Box, point: Point, slop = 0): boolean {
  const local = rotatePoint(point, centerOf(box), -box.rotation);
  return (
    local.x >= box.x - slop &&
    local.x <= box.x + box.width + slop &&
    local.y >= box.y - slop &&
    local.y <= box.y + box.height + slop
  );
}

/** Does the selection rectangle fully hold the box, as it is drawn? */
export function rectEncloses(rect: Rect, box: Box): boolean {
  const b = boundsOf(box);
  return (
    b.x >= rect.x &&
    b.y >= rect.y &&
    b.x + b.width <= rect.x + rect.width &&
    b.y + b.height <= rect.y + rect.height
  );
}

export function moveBox(box: Box, dx: number, dy: number): Box {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

// Resizing ------------------------------------------------------------------------------------

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Which sides a handle moves: -1 the left or top, 1 the right or bottom, 0 neither. */
const SIDES: Record<Handle, readonly [x: -1 | 0 | 1, y: -1 | 0 | 1]> = {
  nw: [-1, -1],
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
};

export function isCorner(handle: Handle): boolean {
  return handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
}

export interface ResizeOptions {
  /** Keep the proportions (Shift). Applies to corner handles. */
  readonly keepAspect?: boolean;
  /** The smallest width or height, in slide pixels. */
  readonly minSize?: number;
}

/**
 * Drag a handle by `delta` (how far the pointer has moved, in slide pixels, from where the drag
 * began). The opposite side or corner stays where it is, however the box is turned.
 */
export function resizeBox(
  box: Box,
  handle: Handle,
  delta: Point,
  options: ResizeOptions = {},
): Box {
  const { keepAspect = false, minSize = 1 } = options;
  const [sx, sy] = SIDES[handle];
  const local = rotatePoint(delta, { x: 0, y: 0 }, -box.rotation);

  let width = sx === 0 ? box.width : Math.max(minSize, box.width + sx * local.x);
  let height = sy === 0 ? box.height : Math.max(minSize, box.height + sy * local.y);
  if (keepAspect && isCorner(handle) && box.width > 0 && box.height > 0) {
    const factor = Math.max(
      width / box.width,
      height / box.height,
      minSize / box.width,
      minSize / box.height,
    );
    width = box.width * factor;
    height = box.height * factor;
  }

  // The anchor (opposite side) is fixed, so the centre moves half of what the size changed.
  const shift = rotatePoint(
    { x: (sx * (width - box.width)) / 2, y: (sy * (height - box.height)) / 2 },
    { x: 0, y: 0 },
    box.rotation,
  );
  const c = centerOf(box);
  return {
    x: c.x + shift.x - width / 2,
    y: c.y + shift.y - height / 2,
    width,
    height,
    rotation: box.rotation,
  };
}

// Rotating ------------------------------------------------------------------------------------

/** The direction of `pointer` seen from `centre`, in degrees, 0 pointing straight up. */
export function angleOf(centre: Point, pointer: Point): number {
  return Math.atan2(pointer.y - centre.y, pointer.x - centre.x) / RADIANS + 90;
}

/**
 * The rotation after dragging the rotation handle from `start` to `pointer`, about `centre`.
 * Working from where the drag began means the box does not jump when the handle is grabbed
 * off-centre. A `snapStep` (15 with Shift) rounds the result.
 */
export function rotationAfterDrag(
  startRotation: number,
  centre: Point,
  start: Point,
  pointer: Point,
  snapStep?: number,
): number {
  const turned = startRotation + angleOf(centre, pointer) - angleOf(centre, start);
  return normaliseAngle(snapStep === undefined ? turned : snapTo(turned, snapStep));
}

// Lines ---------------------------------------------------------------------------------------

/** Where the end of a line lands if it is dragged to `moving` while `fixed` stays put. */
function snappedEnd(fixed: Point, moving: Point, snapStep?: number): Point {
  if (snapStep === undefined) return moving;
  const length = Math.hypot(moving.x - fixed.x, moving.y - fixed.y);
  const angle = snapTo(Math.atan2(moving.y - fixed.y, moving.x - fixed.x) / RADIANS, snapStep);
  return {
    x: fixed.x + Math.cos(angle * RADIANS) * length,
    y: fixed.y + Math.sin(angle * RADIANS) * length,
  };
}

/**
 * A line is a box of height 0: this builds one from its two ends. A `snapStep` (15 with Shift)
 * moves the end onto the nearest multiple of that angle, keeping the length.
 */
export function lineBetween(start: Point, end: Point, snapStep?: number): Box {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const raw = Math.atan2(end.y - start.y, end.x - start.x) / RADIANS;
  const angle = snapStep === undefined ? raw : snapTo(raw, snapStep);
  const to =
    snapStep === undefined
      ? end
      : {
          x: start.x + Math.cos(angle * RADIANS) * length,
          y: start.y + Math.sin(angle * RADIANS) * length,
        };
  const centre = { x: (start.x + to.x) / 2, y: (start.y + to.y) / 2 };
  return {
    x: centre.x - length / 2,
    y: centre.y,
    width: length,
    height: 0,
    rotation: normaliseAngle(angle),
  };
}

/** Where a line starts and ends on the slide. */
export function lineEnds(box: Box): { readonly start: Point; readonly end: Point } {
  const c = centerOf(box);
  return {
    start: rotatePoint({ x: box.x, y: c.y }, c, box.rotation),
    end: rotatePoint({ x: box.x + box.width, y: c.y }, c, box.rotation),
  };
}

/** Drag one end of a line to `pointer`; the other end stays put. */
export function moveLineEnd(
  box: Box,
  which: 'start' | 'end',
  pointer: Point,
  snapStep?: number,
): Box {
  const { start, end } = lineEnds(box);
  return which === 'end'
    ? lineBetween(start, pointer, snapStep)
    : lineBetween(snappedEnd(end, pointer, snapStep), end);
}

// Drawing -------------------------------------------------------------------------------------

/**
 * The box drawn by dragging from `from` to `to`. With `square` (Shift) the longer side wins and
 * the drag keeps its direction.
 */
export function boxFromDrag(from: Point, to: Point, square = false): Rect {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  return {
    x: Math.min(from.x, from.x + dx),
    y: Math.min(from.y, from.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

// Groups --------------------------------------------------------------------------------------

/** Turn every box about `centre` by `degrees`, as one rigid body. */
export function rotateBoxes(boxes: readonly Box[], centre: Point, degrees: number): Box[] {
  return boxes.map((box) => {
    const c = rotatePoint(centerOf(box), centre, degrees);
    return {
      x: c.x - box.width / 2,
      y: c.y - box.height / 2,
      width: box.width,
      height: box.height,
      rotation: normaliseAngle(box.rotation + degrees),
    };
  });
}

/**
 * Scale every box about `anchor`: positions by (sx, sy) and sizes along the box's own sides by the
 * same factors. This is exact for upright boxes and for any box scaled evenly; a turned box that is
 * stretched unevenly is only approximated.
 */
export function scaleBoxes(boxes: readonly Box[], anchor: Point, sx: number, sy: number): Box[] {
  return boxes.map((box) => {
    const c = centerOf(box);
    const centre = { x: anchor.x + (c.x - anchor.x) * sx, y: anchor.y + (c.y - anchor.y) * sy };
    const width = box.width * sx;
    const height = box.height * sy;
    return {
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
      rotation: box.rotation,
    };
  });
}

/**
 * Fit a whole selection into `target`: scale it about its top left corner to the target's size,
 * then move it to the target's position. (How typing X, Y, W or H for a multi-selection works.)
 */
export function fitBoxesTo(boxes: readonly Box[], target: Rect): Box[] {
  const bounds = groupBounds(boxes);
  const sx = bounds.width === 0 ? 1 : target.width / bounds.width;
  const sy = bounds.height === 0 ? 1 : target.height / bounds.height;
  return scaleBoxes(boxes, { x: bounds.x, y: bounds.y }, sx, sy).map((box) =>
    moveBox(box, target.x - bounds.x, target.y - bounds.y),
  );
}

/** Drag a handle of the box around a whole selection: every member is scaled with it. */
export function resizeGroup(
  boxes: readonly Box[],
  handle: Handle,
  delta: Point,
  options: ResizeOptions = {},
): Box[] {
  const bounds = groupBounds(boxes);
  if (bounds.width === 0 || bounds.height === 0) return [...boxes];
  const resized = resizeBox({ ...bounds, rotation: 0 }, handle, delta, options);
  const [sx, sy] = SIDES[handle];
  // The anchor is the opposite side of the group's box (its centre line where that side is 0).
  const anchor = {
    x: sx === 0 ? bounds.x : sx === 1 ? bounds.x : bounds.x + bounds.width,
    y: sy === 0 ? bounds.y : sy === 1 ? bounds.y : bounds.y + bounds.height,
  };
  return scaleBoxes(boxes, anchor, resized.width / bounds.width, resized.height / bounds.height);
}
