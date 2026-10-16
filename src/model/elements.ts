/** What can sit on a slide: shapes (EL-3), text boxes (EL-1) and images (EL-4). */

import { emptyText, type RichText } from './richtext';

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
 * A shape other than a line may hold text, centred (EL-3).
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
  /** 0 (invisible) to 1. Applies to the whole element: fill, border and text (TR-1). */
  readonly opacity: number;
  /** A CSS colour as hex, or `none`. */
  readonly fill: string;
  readonly border: Border;
  /** The corner radius of a rounded rectangle, in slide pixels. */
  readonly cornerRadius: number;
  readonly text?: RichText;
}

/**
 * A text box (EL-1). It keeps its width and its height follows its text, so `height` is always the
 * height the text needs plus the padding; the editor measures it whenever the text, width or padding
 * change. It may have a fill and a border like any box.
 */
export interface TextElement {
  readonly id: Id;
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly opacity: number;
  /** A CSS colour as hex, or `none` (the default). */
  readonly fill: string;
  readonly border: Border;
  /** Space between the box's edge and its text, on every side, in slide pixels. */
  readonly padding: number;
  readonly doc: RichText;
}

/**
 * A picture (EL-4). The picture itself is stored once, by the hash of its bytes, and any number of
 * elements, slides and decks can show it. The box is where and how big it is drawn; it keeps the
 * picture's proportions unless it is stretched on purpose. It has the fill and border every box has
 * (a border makes a frame; the fill shows through where the picture is transparent).
 */
export interface ImageElement {
  readonly id: Id;
  readonly kind: 'image';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  /** 0 (invisible) to 1. A picture's own transparency is kept: it fades from there (TR-1). */
  readonly opacity: number;
  readonly fill: string;
  readonly border: Border;
  /** The content hash of the stored picture. */
  readonly hash: string;
  /** What the picture shows, for people who cannot see it. */
  readonly alt: string;
}

export type SlideElement = ShapeElement | TextElement | ImageElement;

export function isShape(element: SlideElement): element is ShapeElement {
  return element.kind === 'shape';
}

export function isTextBox(element: SlideElement): element is TextElement {
  return element.kind === 'text';
}

export function isImage(element: SlideElement): element is ImageElement {
  return element.kind === 'image';
}

/** The properties of an element that a command may change. Those that do not fit the kind are ignored. */
export type ElementProps = Partial<Omit<ShapeElement, 'id' | 'kind'>> &
  Partial<Pick<TextElement, 'padding' | 'doc'>> &
  Partial<Pick<ImageElement, 'alt'>>;

export interface ElementChange {
  readonly id: Id;
  readonly props: ElementProps;
}

export function isLine(shape: ShapeKind): boolean {
  return shape === 'line' || shape === 'arrow';
}

const SHARED_PROPS = [
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'opacity',
  'fill',
  'border',
] as const;
const SHAPE_PROPS = [...SHARED_PROPS, 'shape', 'cornerRadius', 'text'] as const;
const TEXT_PROPS = [...SHARED_PROPS, 'padding', 'doc'] as const;
const IMAGE_PROPS = [...SHARED_PROPS, 'alt'] as const;

/** Only the properties this kind of element has: a corner radius means nothing to a text box. */
export function applicableProps(element: SlideElement, props: ElementProps): ElementProps {
  const allowed: readonly string[] =
    element.kind === 'shape' ? SHAPE_PROPS : element.kind === 'text' ? TEXT_PROPS : IMAGE_PROPS;
  return Object.fromEntries(Object.entries(props).filter(([key]) => allowed.includes(key)));
}

/** The design's colours (design/tokens.css), for new shapes. */
export const DEFAULT_FILL = '#7FC8A0';
export const DEFAULT_BORDER_COLOR = '#14281B';
export const DEFAULT_LINE_WIDTH = 6;
export const DEFAULT_CORNER_RADIUS = 40;
export const DEFAULT_TEXT_WIDTH = 640;
/** Until the editor has measured the text: one line of the default size. */
export const DEFAULT_TEXT_HEIGHT = 80;

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

/** A new, empty text box: no fill, no border, no padding. */
export function createText(
  id: Id,
  box: { x: number; y: number; width?: number; height?: number },
  doc: RichText = emptyText(),
): TextElement {
  return {
    id,
    kind: 'text',
    x: box.x,
    y: box.y,
    width: box.width ?? DEFAULT_TEXT_WIDTH,
    height: box.height ?? DEFAULT_TEXT_HEIGHT,
    rotation: 0,
    opacity: 1,
    fill: 'none',
    border: { color: DEFAULT_BORDER_COLOR, width: 0, dash: 'solid' },
    padding: 0,
    doc,
  };
}

/** A new picture, no fill and no border, with its box and what it shows. */
export function createImage(
  id: Id,
  hash: string,
  box: { x: number; y: number; width: number; height: number },
  alt = '',
): ImageElement {
  return {
    id,
    kind: 'image',
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    fill: 'none',
    border: { color: DEFAULT_BORDER_COLOR, width: 0, dash: 'solid' },
    hash,
    alt,
  };
}

/** Keep a property change inside what makes sense, so no command can store nonsense. */
export function normaliseProps(props: ElementProps): ElementProps {
  const out: { -readonly [K in keyof ElementProps]: ElementProps[K] } = { ...props };
  if (out.opacity !== undefined) out.opacity = Math.min(1, Math.max(0, out.opacity));
  if (out.width !== undefined) out.width = Math.max(0, out.width);
  if (out.height !== undefined) out.height = Math.max(0, out.height);
  if (out.cornerRadius !== undefined) out.cornerRadius = Math.max(0, out.cornerRadius);
  if (out.padding !== undefined) out.padding = Math.max(0, out.padding);
  if (out.border !== undefined)
    out.border = { ...out.border, width: Math.max(0, out.border.width) };
  return out;
}
