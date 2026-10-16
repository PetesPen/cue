import { describe, expect, test } from 'vitest';
import { createShape, textFromString } from '@/model';
import { idsOf, labelFor, labelForChanges } from './historyLabels';

describe('what a step is called (EL-8)', () => {
  test.each([
    [{ x: 1, y: 2 }, 'Move'],
    [{ x: 1 }, 'Move'],
    [{ x: 1, y: 2, width: 3, height: 4 }, 'Resize'],
    [{ width: 3 }, 'Resize'],
    [{ rotation: 10 }, 'Rotate'],
    [{ opacity: 0.5 }, 'Fade'],
    [{ fill: '#FFFFFF' }, 'Change look'],
    [{ doc: textFromString('x'), height: 90 }, 'Edit text'],
    [{ text: textFromString('x') }, 'Edit text'],
    [{ padding: 8 }, 'Change'],
  ])('Given a change of %j, When it is named, Then it is "%s"', (props, label) => {
    expect(labelForChanges([{ id: 'a', props }])).toBe(label);
  });

  test('Given every kind of command, When each is named, Then each has a name', () => {
    const shape = createShape('a', 'ellipse', { x: 0, y: 0, width: 1, height: 1 });

    expect(labelFor({ type: 'addSlide', slideId: 's', afterSlideId: 't', at: 1 })).toBe(
      'Add slide',
    );
    expect(labelFor({ type: 'renameDeck', title: 'x', at: 1 })).toBe('Rename deck');
    expect(labelFor({ type: 'addElement', slideId: 's', element: shape, at: 1 })).toBe('Add');
    expect(labelFor({ type: 'removeElements', slideId: 's', ids: ['a'], at: 1 })).toBe('Delete');
    expect(labelFor({ type: 'addElements', slideId: 's', elements: [shape], at: 1 })).toBe('Paste');
    expect(labelFor({ type: 'setNotes', slideId: 's', notes: '', at: 1 })).toBe('Edit notes');
    expect(
      labelFor({ type: 'reorderElements', slideId: 's', ids: ['a'], mode: 'front', at: 1 }),
    ).toBe('Arrange');
  });

  test('Given commands about elements, When their elements are asked for, Then they are those; slide-wide commands have none', () => {
    const shape = createShape('a', 'ellipse', { x: 0, y: 0, width: 1, height: 1 });

    expect(idsOf({ type: 'addElement', slideId: 's', element: shape, at: 1 })).toEqual(['a']);
    expect(idsOf({ type: 'removeElements', slideId: 's', ids: ['a', 'b'], at: 1 })).toEqual([
      'a',
      'b',
    ]);
    expect(
      idsOf({ type: 'updateElements', slideId: 's', changes: [{ id: 'c', props: {} }], at: 1 }),
    ).toEqual(['c']);
    expect(idsOf({ type: 'setNotes', slideId: 's', notes: '', at: 1 })).toEqual([]);
    expect(idsOf({ type: 'renameDeck', title: 'x', at: 1 })).toEqual([]);
  });
});
