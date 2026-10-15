/** What can sit on a slide. Shapes first (EL-3); text (EL-1) and images (EL-4) join this list later. */

export type Id = string;

export const SHAPE_KINDS = [
  'rectangle',
  'roundedRectangle',
  'ellipse',
  'triangle',
  'line',
  'arrow',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export const DASH_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type DashStyle = (typeof DASH_STYLES)[number];

export interface Border {
  /** A CSS colour, written as hex (`#14281B`). */
  readonly color: string;
  /** In slide pixels (the slide is 1920 x 1080). 0 means no border. */
  readonly width: number;
  readonly dash: DashStyle;
}

/**
 * A shape. Its box is in slide pixels: x and y are the top left corner of the box before turning,
 * and `rotation` turns the box clockwise about its centre, in degrees.
 *
 * A **line or arrow is a shape of height 0**: `width` is its length and `rotation` its direction, so
 * handles, snapping and group moves treat it like any other box. It is drawn with `border` only.
 */
export interface ShapeElement {
  readonly id: Id;
  readonly kind: 'shape';
  readonly shape: ShapeKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  /** 0 (invisible) to 1. Applies to the whole element: fill, border and, later, text (TR-1). */
  readonly opacity: number;
  /** A CSS colour as hex, or `none`. */
  readonly fill: string;
  readonly border: Border;
  /** The corner radius of a rounded rectangle, in slide pixels. */
  readonly cornerRadius: number;
}

export type SlideElement = ShapeElement;

/** The properties of an element that a command may change. */
export type ElementProps = Partial<Omit<ShapeElement, 'id' | 'kind'>>;

export interface ElementChange {
  readonly id: Id;
  readonly props: ElementProps;
}

export function isLine(shape: ShapeKind): boolean {
  return shape === 'line' || shape === 'arrow';
}

/** The design's colours (design/tokens.css), for new shapes. */
export const DEFAULT_FILL = '#7FC8A0';
export const DEFAULT_BORDER_COLOR = '#14281B';
export const DEFAULT_LINE_WIDTH = 6;
export const DEFAULT_CORNER_RADIUS = 40;

export interface BoxInput {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
}

/** A new shape in its default look: mint fill and no border, or a thin forest line. */
export function createShape(id: Id, shape: ShapeKind, box: BoxInput): ShapeElement {
  const line = isLine(shape);
  return {
    id,
    kind: 'shape',
    shape,
    x: box.x,
    y: box.y,
    width: box.width,
    height: line ? 0 : box.height,
    rotation: box.rotation ?? 0,
    opacity: 1,
    fill: line ? 'none' : DEFAULT_FILL,
    border: {
      color: DEFAULT_BORDER_COLOR,
      width: line ? DEFAULT_LINE_WIDTH : 0,
      dash: 'solid',
    },
    cornerRadius: shape === 'roundedRectangle' ? DEFAULT_CORNER_RADIUS : 0,
  };
}

/** Keep a property change inside what makes sense, so no command can store nonsense. */
export function normaliseProps(props: ElementProps): ElementProps {
  const out: { -readonly [K in keyof ElementProps]: ElementProps[K] } = { ...props };
  if (out.opacity !== undefined) out.opacity = Math.min(1, Math.max(0, out.opacity));
  if (out.width !== undefined) out.width = Math.max(0, out.width);
  if (out.height !== undefined) out.height = Math.max(0, out.height);
  if (out.cornerRadius !== undefined) out.cornerRadius = Math.max(0, out.cornerRadius);
  if (out.border !== undefined)
    out.border = { ...out.border, width: Math.max(0, out.border.width) };
  return out;
}
