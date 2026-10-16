import { describe, expect, test } from 'vitest';
import {
  DEFAULT_TEXT_HEIGHT,
  DEFAULT_TEXT_WIDTH,
  applicableProps,
  createText,
  isShape,
  isTextBox,
  DEFAULT_BORDER_COLOR,
  DEFAULT_CORNER_RADIUS,
  DEFAULT_FILL,
  DEFAULT_LINE_WIDTH,
  SHAPE_KINDS,
  createShape,
  isLine,
  normaliseProps,
} from './elements';
import { emptyText } from './richtext';

describe('createShape (EL-3)', () => {
  const box = { x: 100, y: 200, width: 300, height: 150 };

  test('Given a rectangle, When it is created, Then it has the default look: mint fill, no border, fully opaque, upright', () => {
    expect(createShape('r', 'rectangle', box)).toEqual({
      id: 'r',
      kind: 'shape',
      shape: 'rectangle',
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      rotation: 0,
      opacity: 1,
      fill: DEFAULT_FILL,
      border: { color: DEFAULT_BORDER_COLOR, width: 0, dash: 'solid' },
      cornerRadius: 0,
    });
  });

  test('Given a rounded rectangle, When it is created, Then it has the default corner radius, and others do not', () => {
    expect(createShape('r', 'roundedRectangle', box).cornerRadius).toBe(DEFAULT_CORNER_RADIUS);
    expect(createShape('e', 'ellipse', box).cornerRadius).toBe(0);
  });

  test.each(['line', 'arrow'] as const)(
    'Given a %s, When it is created from a box, Then it has no height and no fill, and a visible line',
    (shape) => {
      const line = createShape('l', shape, { ...box, rotation: 30 });

      expect(line.height).toBe(0);
      expect(line.fill).toBe('none');
      expect(line.border.width).toBe(DEFAULT_LINE_WIDTH);
      expect(line.rotation).toBe(30);
    },
  );

  test('Given the six shapes, When they are classified, Then only the line and the arrow are lines', () => {
    expect(SHAPE_KINDS.filter(isLine)).toEqual(['line', 'arrow']);
    expect(SHAPE_KINDS).toHaveLength(6);
  });
});

describe('normaliseProps', () => {
  test('Given an opacity outside 0 to 1, When it is normalised, Then it is held inside', () => {
    expect(normaliseProps({ opacity: 1.5 }).opacity).toBe(1);
    expect(normaliseProps({ opacity: -0.2 }).opacity).toBe(0);
    expect(normaliseProps({ opacity: 0.4 }).opacity).toBe(0.4);
  });

  test('Given a negative size, radius or border width, When it is normalised, Then it becomes 0', () => {
    expect(
      normaliseProps({
        width: -5,
        height: -1,
        cornerRadius: -9,
        border: { color: '#000000', width: -2, dash: 'dashed' },
      }),
    ).toEqual({
      width: 0,
      height: 0,
      cornerRadius: 0,
      border: { color: '#000000', width: 0, dash: 'dashed' },
    });
  });

  test('Given only some properties, When they are normalised, Then no others appear', () => {
    expect(normaliseProps({ x: 10 })).toEqual({ x: 10 });
  });
});

describe('createText and applicableProps (EL-1)', () => {
  test('Given a new text box, When it is created, Then it has no fill, no border, no padding and one empty paragraph', () => {
    expect(createText('t', { x: 100, y: 200 })).toEqual({
      id: 't',
      kind: 'text',
      x: 100,
      y: 200,
      width: DEFAULT_TEXT_WIDTH,
      height: DEFAULT_TEXT_HEIGHT,
      rotation: 0,
      opacity: 1,
      fill: 'none',
      border: { color: DEFAULT_BORDER_COLOR, width: 0, dash: 'solid' },
      padding: 0,
      doc: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
  });

  test('Given a text box, When props for shapes are offered, Then only the props a text box has are kept', () => {
    const text = createText('t', { x: 0, y: 0 });

    expect(
      applicableProps(text, {
        x: 5,
        cornerRadius: 9,
        padding: 12,
        text: emptyText(),
        shape: 'ellipse',
      }),
    ).toEqual({
      x: 5,
      padding: 12,
    });
  });

  test('Given a shape, When props for text boxes are offered, Then only the props a shape has are kept', () => {
    const shape = createShape('s', 'rectangle', { x: 0, y: 0, width: 10, height: 10 });

    expect(
      applicableProps(shape, {
        x: 5,
        cornerRadius: 9,
        padding: 12,
        doc: emptyText(),
        text: emptyText(),
      }),
    ).toEqual({
      x: 5,
      cornerRadius: 9,
      text: emptyText(),
    });
  });

  test('Given the two kinds, When they are told apart, Then the guards agree', () => {
    expect(isShape(createShape('s', 'ellipse', { x: 0, y: 0, width: 1, height: 1 }))).toBe(true);
    expect(isTextBox(createText('t', { x: 0, y: 0 }))).toBe(true);
    expect(isShape(createText('t', { x: 0, y: 0 }))).toBe(false);
  });

  test('Given a negative padding, When it is normalised, Then it is 0', () => {
    expect(normaliseProps({ padding: -4 }).padding).toBe(0);
  });
});
