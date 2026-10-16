import { isLine, isShape, isTextBox, type ShapeKind, type SlideElement } from '@/model';

export const SHAPE_LABELS: Readonly<Record<ShapeKind, string>> = {
  rectangle: 'Rectangle',
  roundedRectangle: 'Rounded rectangle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  line: 'Line',
  arrow: 'Arrow',
};

/** "Rectangle", "Text", or "3 elements" for several. */
export function describeSelection(elements: readonly SlideElement[]): string {
  const [first] = elements;
  if (first === undefined) return '';
  if (elements.length > 1) {
    return elements.every(isShape)
      ? `${String(elements.length)} shapes`
      : `${String(elements.length)} elements`;
  }
  return isShape(first) ? SHAPE_LABELS[first.shape] : 'Text';
}

/** A line or an arrow: it has two ends, not a box with sides. */
export function isLineElement(element: SlideElement): boolean {
  return isShape(element) && isLine(element.shape);
}

/** Can this element be edited as text (Enter, or a double click)? A text box, or a shape that is not a line. */
export function canEditText(element: SlideElement): boolean {
  return isTextBox(element) || (isShape(element) && !isLine(element.shape));
}
