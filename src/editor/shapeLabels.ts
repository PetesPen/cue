import { isImage, isLine, isShape, isTextBox, type ShapeKind, type SlideElement } from '@/model';

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
  if (isShape(first)) return SHAPE_LABELS[first.shape];
  return isImage(first) ? 'Image' : 'Text';
}

/** Can this element have a fill? Not a line, and not a picture (a picture is its own colours). */
export function hasFill(element: SlideElement): boolean {
  return !isLineElement(element) && !isImage(element);
}

/** A line or an arrow: it has two ends, not a box with sides. */
export function isLineElement(element: SlideElement): boolean {
  return isShape(element) && isLine(element.shape);
}

/** Can this element be edited as text (Enter, or a double click)? A text box, or a shape that is not a line. */
export function canEditText(element: SlideElement): boolean {
  return isTextBox(element) || (isShape(element) && !isLine(element.shape));
}
