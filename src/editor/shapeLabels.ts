import type { ShapeKind } from '@/model';

export const SHAPE_LABELS: Readonly<Record<ShapeKind, string>> = {
  rectangle: 'Rectangle',
  roundedRectangle: 'Rounded rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  line: 'Line',
  arrow: 'Arrow',
};

/** "Rectangle", or "3 shapes" for several. */
export function describeSelection(shapes: readonly ShapeKind[]): string {
  const [first] = shapes;
  if (first === undefined) return '';
  return shapes.length === 1 ? SHAPE_LABELS[first] : `${String(shapes.length)} shapes`;
}
