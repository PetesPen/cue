import type { Point, Rect } from './geometry';

/**
 * Smart guides and alignment (EL-6): pure functions on the upright rectangles around elements (a
 * turned element is its outer box). Snapping nudges a box being dragged onto the edges and middles of
 * the slide and of the other elements; aligning and distributing lay a selection out in one step.
 */

/** A thin line drawn while something snaps: at `at` on the `axis`, from `from` to `to` along the other. */
export interface Guide {
  readonly axis: 'x' | 'y';
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

export interface Snapped {
  /** How far the dragged box has to move to line up. */
  readonly dx: number;
  readonly dy: number;
  readonly guides: readonly Guide[];
}

/** The lines a rectangle can line up by: its two edges and its middle. */
const linesX = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
const linesY = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];

interface Target {
  readonly at: number;
  /** The rectangle the line belongs to, or undefined for the slide. */
  readonly of: Rect | undefined;
}

function targets(others: readonly Rect[], slide: Rect, axis: 'x' | 'y'): Target[] {
  const lines = axis === 'x' ? linesX : linesY;
  return [
    ...lines(slide).map((at) => ({ at, of: undefined })),
    ...others.flatMap((other) => lines(other).map((at) => ({ at, of: other }))),
  ];
}

interface Best {
  readonly offset: number;
  /** The line of the dragged box that moved onto the target. */
  readonly line: number;
  readonly target: Target;
}

/** The smallest move, within `threshold`, that puts one of `lines` on one of `candidates`. */
function nearest(
  lines: readonly number[],
  candidates: readonly Target[],
  threshold: number,
): Best | undefined {
  let best: Best | undefined;
  for (const line of lines) {
    for (const target of candidates) {
      const offset = target.at - line;
      if (Math.abs(offset) > threshold) continue;
      if (!best || Math.abs(offset) < Math.abs(best.offset)) best = { offset, line, target };
    }
  }
  return best;
}

const EPSILON = 0.5;

/**
 * The guide for a snapped line: it runs along the dragged box and every element it lines up with (the
 * whole slide when the line is the slide's own).
 */
function guideFor(
  axis: 'x' | 'y',
  at: number,
  moved: Rect,
  all: readonly Target[],
  slide: Rect,
): Guide {
  const along =
    axis === 'x' ? (r: Rect) => [r.y, r.y + r.height] : (r: Rect) => [r.x, r.x + r.width];
  const ends = [...along(moved)];
  for (const target of all) {
    if (Math.abs(target.at - at) > EPSILON) continue;
    ends.push(...along(target.of ?? slide));
  }
  return { axis, at, from: Math.min(...ends), to: Math.max(...ends) };
}

/**
 * Where a box being moved lines up (EL-6): its edges and middle against those of the slide and of
 * `others`, within `threshold` (slide pixels). Each axis snaps on its own, to the nearest line.
 */
export function snapMove(
  moving: Rect,
  others: readonly Rect[],
  slide: Rect,
  threshold: number,
): Snapped {
  const xs = targets(others, slide, 'x');
  const ys = targets(others, slide, 'y');
  const bx = nearest(linesX(moving), xs, threshold);
  const by = nearest(linesY(moving), ys, threshold);
  const dx = bx?.offset ?? 0;
  const dy = by?.offset ?? 0;
  const landed: Rect = { ...moving, x: moving.x + dx, y: moving.y + dy };
  return {
    dx,
    dy,
    guides: [
      ...(bx ? [guideFor('x', bx.target.at, landed, xs, slide)] : []),
      ...(by ? [guideFor('y', by.target.at, landed, ys, slide)] : []),
    ],
  };
}

/** Which edges of a box a resize handle moves: -1 the left or top, 1 the right or bottom, 0 neither. */
export interface Edges {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
}

/**
 * Where the edges being dragged in a resize line up (EL-6): only the moving edge or edges snap, to the
 * edges and middles of the slide and of `others`. The other sides stay where they are.
 */
export function snapEdges(
  box: Rect,
  edges: Edges,
  others: readonly Rect[],
  slide: Rect,
  threshold: number,
): Snapped {
  const xs = targets(others, slide, 'x');
  const ys = targets(others, slide, 'y');
  const edgeX = edges.x === -1 ? box.x : box.x + box.width;
  const edgeY = edges.y === -1 ? box.y : box.y + box.height;
  const bx = edges.x === 0 ? undefined : nearest([edgeX], xs, threshold);
  const by = edges.y === 0 ? undefined : nearest([edgeY], ys, threshold);
  const dx = bx?.offset ?? 0;
  const dy = by?.offset ?? 0;
  const landed: Rect = {
    x: edges.x === -1 ? box.x + dx : box.x,
    y: edges.y === -1 ? box.y + dy : box.y,
    width: edges.x === 0 ? box.width : box.width + edges.x * dx,
    height: edges.y === 0 ? box.height : box.height + edges.y * dy,
  };
  return {
    dx,
    dy,
    guides: [
      ...(bx ? [guideFor('x', bx.target.at, landed, xs, slide)] : []),
      ...(by ? [guideFor('y', by.target.at, landed, ys, slide)] : []),
    ],
  };
}

// Align and distribute -----------------------------------------------------------------------

export const ALIGNMENTS = ['left', 'centre', 'right', 'top', 'middle', 'bottom'] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

export interface Placed {
  readonly id: string;
  /** The upright box around the element, turned or not. */
  readonly bounds: Rect;
}

/** How far an element has to move: the change to its own x and y. */
export interface Shift {
  readonly id: string;
  readonly dx: number;
  readonly dy: number;
}

/**
 * Line elements up by their left, middle, right, top, centre or bottom (EL-6) against `target`: the
 * slide when there is one element, the box around the selection when there are several.
 */
export function align(items: readonly Placed[], how: Alignment, target: Rect): Shift[] {
  return items.map(({ id, bounds }) => {
    switch (how) {
      case 'left':
        return { id, dx: target.x - bounds.x, dy: 0 };
      case 'centre':
        return { id, dx: target.x + target.width / 2 - (bounds.x + bounds.width / 2), dy: 0 };
      case 'right':
        return { id, dx: target.x + target.width - (bounds.x + bounds.width), dy: 0 };
      case 'top':
        return { id, dx: 0, dy: target.y - bounds.y };
      case 'middle':
        return { id, dx: 0, dy: target.y + target.height / 2 - (bounds.y + bounds.height / 2) };
      case 'bottom':
        return { id, dx: 0, dy: target.y + target.height - (bounds.y + bounds.height) };
    }
  });
}

/**
 * Space three or more elements evenly (EL-6): the two outermost stay where they are and the gaps
 * between neighbours become equal. Fewer than three need nothing.
 */
export function distribute(items: readonly Placed[], axis: 'horizontal' | 'vertical'): Shift[] {
  if (items.length < 3) return items.map(({ id }) => ({ id, dx: 0, dy: 0 }));
  const horizontal = axis === 'horizontal';
  const start = (r: Rect) => (horizontal ? r.x : r.y);
  const size = (r: Rect) => (horizontal ? r.width : r.height);
  const sorted = [...items].sort((a, b) => start(a.bounds) - start(b.bounds));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const span = start(last.bounds) + size(last.bounds) - start(first.bounds);
  const room = span - sorted.reduce((sum, item) => sum + size(item.bounds), 0);
  const gap = room / (sorted.length - 1);
  let cursor = start(first.bounds);
  const shifts = new Map<string, number>();
  for (const item of sorted) {
    shifts.set(item.id, cursor - start(item.bounds));
    cursor += size(item.bounds) + gap;
  }
  return items.map(({ id }) => {
    const by = shifts.get(id) ?? 0;
    return horizontal ? { id, dx: by, dy: 0 } : { id, dx: 0, dy: by };
  });
}

/** A point moved by a snap. */
export function nudged(point: Point, snap: Pick<Snapped, 'dx' | 'dy'>): Point {
  return { x: point.x + snap.dx, y: point.y + snap.dy };
}
