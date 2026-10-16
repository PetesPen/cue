import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { copiesOf, parseElements, serialiseElements } from './clipboard';
import { createShape, createText, type SlideElement } from './elements';
import { textFromString } from './richtext';

const shape = (id: string, x = 10, y = 20) =>
  createShape(id, 'ellipse', { x, y, width: 300, height: 200 });
const text = (id: string) =>
  createText(id, { x: 50, y: 60, width: 500, height: 80 }, textFromString('Our approach'));

describe('elements on the clipboard (EL-7)', () => {
  test('Given a shape and a text box, When they are written and read back, Then they are exactly the same', () => {
    const elements: SlideElement[] = [shape('a'), text('b')];

    expect(parseElements(serialiseElements(elements))).toEqual(elements);
  });

  test('Given a shape with text and a faded text box, When they are written and read back, Then the text and the fade survive', () => {
    const elements: SlideElement[] = [
      { ...shape('a'), text: textFromString('Inside'), opacity: 0.4 },
      { ...text('b'), fill: '#E8F0E4', padding: 24 },
    ];

    expect(parseElements(serialiseElements(elements))).toEqual(elements);
  });

  test.each([
    ['plain text', 'just some words'],
    ['empty text', ''],
    ['JSON that is not ours', '{"hello":"world"}'],
    ['an array', '[1,2,3]'],
    ['null', 'null'],
    ['another version', JSON.stringify({ format: 'cue-elements', version: 99, elements: [] })],
    ['no elements', JSON.stringify({ format: 'cue-elements', version: 1, elements: [] })],
    [
      'an element that is not valid',
      JSON.stringify({ format: 'cue-elements', version: 1, elements: [{ id: 'x' }] }),
    ],
  ])(
    'Given %s on the clipboard, When it is read, Then it is not taken for elements',
    (_name, clip) => {
      expect(parseElements(clip)).toBeUndefined();
    },
  );

  test('Given text in the clipboard with an unknown style, When it is read, Then it passes the text gate like any other text', () => {
    const element = {
      ...text('t'),
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'blink' }] }],
          },
        ],
      },
    };
    const clip = JSON.stringify({ format: 'cue-elements', version: 1, elements: [element] });

    const read = parseElements(clip)?.[0];

    expect(read && 'doc' in read && JSON.stringify(read.doc)).not.toContain('blink');
    expect(read && 'doc' in read && JSON.stringify(read.doc)).toContain('bold');
  });

  test('Given elements, When copies are made, Then they have new ids, sit offset, and are otherwise the same', () => {
    const originals = [shape('a'), text('b')];
    let n = 0;

    const copies = copiesOf(originals, () => `new-${String((n += 1))}`, 24);

    expect(copies.map((c) => c.id)).toEqual(['new-1', 'new-2']);
    expect(copies.map((c) => [c.x, c.y])).toEqual([
      [34, 44],
      [74, 84],
    ]);
    // Apart from the id and the place, nothing else differs.
    expect(copies.map((c) => ({ ...c, id: '', x: 0, y: 0 }))).toEqual(
      originals.map((o) => ({ ...o, id: '', x: 0, y: 0 })),
    );
    expect(originals.map((o) => o.id)).toEqual(['a', 'b']);
  });

  test('Given any elements, When they are written and read back, Then they come back the same (property)', () => {
    const finite = fc.double({ min: -5000, max: 5000, noNaN: true }).map((n) => (n === 0 ? 0 : n));
    fc.assert(
      fc.property(fc.array(fc.tuple(finite, finite), { minLength: 1, maxLength: 6 }), (points) => {
        const elements = points.map(([x, y], i) => shape(`e${String(i)}`, x, y));

        expect(parseElements(serialiseElements(elements))).toEqual(elements);
      }),
    );
  });
});
