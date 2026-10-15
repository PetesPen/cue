import type { Border, ShapeElement } from '@/model';

/**
 * Every shape is a small SVG laid out in slide pixels (no viewBox), so border widths, dashes and
 * arrowheads mean the same thing at any zoom. The border is drawn inside the box, so the box is also
 * what you see and what the selection handles surround.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

type Attributes = Record<string, string | number>;

function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Attributes,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function dashAttributes(border: Border): Attributes {
  const unit = Math.max(border.width, 1);
  if (border.dash === 'dashed')
    return { 'stroke-dasharray': `${String(3 * unit)} ${String(2 * unit)}` };
  // A dot is a zero-length dash with a round end.
  if (border.dash === 'dotted') {
    return { 'stroke-dasharray': `0 ${String(2 * unit)}`, 'stroke-linecap': 'round' };
  }
  return {};
}

function outline(shape: ShapeElement): Attributes {
  const { border } = shape;
  return {
    fill: shape.fill,
    stroke: border.width > 0 ? border.color : 'none',
    'stroke-width': border.width,
    'stroke-linejoin': 'round',
    ...(border.width > 0 ? dashAttributes(border) : {}),
  };
}

/** The arrowhead's size follows the line's width, with a floor so a thin arrow still has a head. */
export function arrowHead(borderWidth: number): {
  readonly length: number;
  readonly width: number;
} {
  return { length: Math.max(borderWidth * 4, 28), width: Math.max(borderWidth * 3.5, 24) };
}

/** Draw (or redraw) a shape into its SVG, and set the SVG's size. */
export function drawShape(svg: SVGSVGElement, shape: ShapeElement): void {
  const { width, height, border } = shape;
  // An SVG with no width or height is not drawn at all, so a line (height 0) gets 1 px; its stroke
  // still shows because the SVG's overflow is visible.
  svg.setAttribute('width', String(Math.max(width, 1)));
  svg.setAttribute('height', String(Math.max(height, 1)));
  const inset = border.width / 2;
  const style = outline(shape);

  switch (shape.shape) {
    case 'rectangle':
    case 'roundedRectangle': {
      const radius =
        shape.shape === 'roundedRectangle'
          ? Math.min(shape.cornerRadius, (width - border.width) / 2, (height - border.width) / 2)
          : 0;
      svg.replaceChildren(
        node('rect', {
          x: inset,
          y: inset,
          width: Math.max(0, width - border.width),
          height: Math.max(0, height - border.width),
          rx: Math.max(0, radius),
          ...style,
        }),
      );
      break;
    }
    case 'ellipse':
      svg.replaceChildren(
        node('ellipse', {
          cx: width / 2,
          cy: height / 2,
          rx: Math.max(0, (width - border.width) / 2),
          ry: Math.max(0, (height - border.width) / 2),
          ...style,
        }),
      );
      break;
    case 'triangle':
      svg.replaceChildren(
        node('polygon', {
          points: [
            `${String(width / 2)},${String(inset)}`,
            `${String(width - inset)},${String(height - inset)}`,
            `${String(inset)},${String(height - inset)}`,
          ].join(' '),
          ...style,
        }),
      );
      break;
    case 'line':
      svg.replaceChildren(
        node('line', {
          x1: 0,
          y1: 0,
          x2: width,
          y2: 0,
          stroke: border.width > 0 ? border.color : 'none',
          'stroke-width': border.width,
          ...(border.width > 0 ? dashAttributes(border) : {}),
        }),
      );
      break;
    case 'arrow': {
      const head = arrowHead(border.width);
      const shaftEnd = Math.max(0, width - head.length * 0.8);
      svg.replaceChildren(
        node('line', {
          x1: 0,
          y1: 0,
          x2: shaftEnd,
          y2: 0,
          stroke: border.width > 0 ? border.color : 'none',
          'stroke-width': border.width,
          ...(border.width > 0 ? dashAttributes(border) : {}),
        }),
        node('polygon', {
          points: [
            `${String(width)},0`,
            `${String(width - head.length)},${String(-head.width / 2)}`,
            `${String(width - head.length)},${String(head.width / 2)}`,
          ].join(' '),
          fill: border.width > 0 ? border.color : 'none',
          stroke: 'none',
        }),
      );
      break;
    }
  }
}
