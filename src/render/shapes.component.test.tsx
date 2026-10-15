import { afterEach, describe, expect, test } from 'vitest';
import { createShape, createSlide, type ShapeElement, type ShapeKind, type Slide } from '@/model';
import { createSlideRenderer, type SlideRenderer } from './slide';

const hosts: HTMLElement[] = [];
const renderers: SlideRenderer[] = [];

/** A host 960 px wide, so the 1920 px slide is drawn at half size. */
function draw(slide: Slide, width = 960) {
  const host = document.createElement('div');
  host.style.width = `${String(width)}px`;
  document.body.append(host);
  hosts.push(host);
  const renderer = createSlideRenderer(host, slide);
  renderers.push(renderer);
  return { host, renderer };
}

afterEach(() => {
  while (renderers.length > 0) renderers.pop()?.destroy();
  while (hosts.length > 0) hosts.pop()?.remove();
});

const slideWith = (...elements: ShapeElement[]): Slide => ({ ...createSlide('s1'), elements });
const box = { x: 200, y: 100, width: 400, height: 300 };
const nodeOf = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
const idsInOrder = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLElement>('.cue-element')].map((n) => n.dataset.elementId);

describe('shapes are drawn as boxes in slide space (EL-3)', () => {
  test('Given a shape at (200, 100) of 400 x 300 on a slide drawn at half size, When it is drawn, Then it sits at (100, 50) and is 200 x 150 on screen', () => {
    const { host } = draw(slideWith(createShape('a', 'rectangle', box)));

    const surface = host.querySelector('.cue-slide')?.getBoundingClientRect();
    const shape = nodeOf(host, 'a')?.getBoundingClientRect();
    expect(shape?.x).toBeCloseTo((surface?.x ?? 0) + 100, 1);
    expect(shape?.y).toBeCloseTo((surface?.y ?? 0) + 50, 1);
    expect(shape?.width).toBeCloseTo(200, 1);
    expect(shape?.height).toBeCloseTo(150, 1);
  });

  test('Given a rotated shape, When it is drawn, Then it turns about its centre', () => {
    const { host } = draw(slideWith({ ...createShape('a', 'rectangle', box), rotation: 90 }));

    const rect = nodeOf(host, 'a')?.getBoundingClientRect();
    // 400 x 300 turned a quarter turn is 300 x 400, around the same centre (400, 250) / 2 = (200, 125).
    expect(rect?.width).toBeCloseTo(150, 0);
    expect(rect?.height).toBeCloseTo(200, 0);
    const surface = host.querySelector('.cue-slide')?.getBoundingClientRect();
    expect((rect?.x ?? 0) + (rect?.width ?? 0) / 2).toBeCloseTo((surface?.x ?? 0) + 200, 0);
  });

  test.each([
    ['rectangle', 'rect'],
    ['roundedRectangle', 'rect'],
    ['ellipse', 'ellipse'],
    ['triangle', 'polygon'],
    ['line', 'line'],
  ] as [ShapeKind, string][])(
    'Given a %s, When it is drawn, Then its SVG holds a <%s>',
    (shape, tag) => {
      const { host } = draw(slideWith(createShape('a', shape, box)));

      const svg = nodeOf(host, 'a')?.querySelector('svg');
      expect(svg?.children).toHaveLength(1);
      expect(svg?.firstElementChild?.tagName.toLowerCase()).toBe(tag);
      expect(nodeOf(host, 'a')?.dataset.shape).toBe(shape);
    },
  );

  test('Given an arrow, When it is drawn, Then it has a shaft and a head, and the shaft stops short of the tip', () => {
    const { host } = draw(slideWith(createShape('a', 'arrow', { ...box, width: 400 })));

    const [shaft, head] = [...(nodeOf(host, 'a')?.querySelectorAll('svg > *') ?? [])];
    expect(shaft?.tagName.toLowerCase()).toBe('line');
    expect(head?.tagName.toLowerCase()).toBe('polygon');
    expect(Number(shaft?.getAttribute('x2'))).toBeLessThan(400);
    expect(head?.getAttribute('points')?.startsWith('400,0')).toBe(true);
  });

  test('Given a line and an arrow, When they are drawn, Then they really paint something (an SVG of no height is not drawn at all)', () => {
    const { host } = draw(
      slideWith(createShape('l', 'line', box), createShape('a', 'arrow', { ...box, y: 400 })),
    );

    for (const id of ['l', 'a']) {
      const svg = nodeOf(host, id)?.querySelector('svg');
      // An SVG with no size is not painted at all; a line's SVG is at least 1 px (half a pixel here).
      expect(svg?.getBoundingClientRect().height, id).toBeGreaterThan(0.4);
      expect(svg?.getBoundingClientRect().width, id).toBeGreaterThan(100);
      expect(Number(svg?.getAttribute('height')), id).toBeGreaterThanOrEqual(1);
    }
  });

  test('Given a line, When it is drawn, Then its box has no height and it is a visible stroke of the border colour', () => {
    const { host } = draw(slideWith(createShape('a', 'line', box)));

    const line = nodeOf(host, 'a')?.querySelector('line');
    expect(nodeOf(host, 'a')?.style.height).toBe('0px');
    expect(line?.getAttribute('stroke')).toBe('#14281B');
    expect(line?.getAttribute('stroke-width')).toBe('6');
  });
});

describe('style (EL-3, TR-1)', () => {
  test('Given a border of 20 px, When a rectangle is drawn, Then the border is inside the box, not outside it', () => {
    const { host } = draw(
      slideWith({
        ...createShape('a', 'rectangle', box),
        border: { color: '#17803F', width: 20, dash: 'solid' },
      }),
    );

    const rect = nodeOf(host, 'a')?.querySelector('rect');
    expect(rect?.getAttribute('x')).toBe('10');
    expect(rect?.getAttribute('width')).toBe('380');
    expect(rect?.getAttribute('stroke')).toBe('#17803F');
  });

  test('Given no border, When a shape is drawn, Then it has no stroke', () => {
    const { host } = draw(slideWith(createShape('a', 'ellipse', box)));

    expect(nodeOf(host, 'a')?.querySelector('ellipse')?.getAttribute('stroke')).toBe('none');
  });

  test('Given a fill of none, When a shape is drawn, Then it is not filled', () => {
    const { host } = draw(slideWith({ ...createShape('a', 'rectangle', box), fill: 'none' }));

    expect(nodeOf(host, 'a')?.querySelector('rect')?.getAttribute('fill')).toBe('none');
  });

  test('Given a corner radius larger than the box allows, When a rounded rectangle is drawn, Then the radius is held to half the short side', () => {
    const { host } = draw(
      slideWith({
        ...createShape('a', 'roundedRectangle', { ...box, height: 100 }),
        cornerRadius: 500,
      }),
    );

    expect(nodeOf(host, 'a')?.querySelector('rect')?.getAttribute('rx')).toBe('50');
  });

  test.each([
    ['solid', null],
    ['dashed', '18 12'],
    ['dotted', '0 12'],
  ] as const)(
    'Given a %s border of 6 px, When it is drawn, Then the dash array is %s',
    (dash, array) => {
      const { host } = draw(
        slideWith({
          ...createShape('a', 'rectangle', box),
          border: { color: '#14281B', width: 6, dash },
        }),
      );

      const rect = nodeOf(host, 'a')?.querySelector('rect');
      expect(rect?.getAttribute('stroke-dasharray')).toBe(array);
      if (dash === 'dotted') expect(rect?.getAttribute('stroke-linecap')).toBe('round');
    },
  );

  test('Given an opacity of 50%, When a shape with a fill and a border is drawn, Then the whole box is 50% and the parts carry no opacity of their own', () => {
    const { host } = draw(
      slideWith({
        ...createShape('a', 'rectangle', box),
        opacity: 0.5,
        border: { color: '#14281B', width: 8, dash: 'solid' },
      }),
    );

    const node = nodeOf(host, 'a');
    expect(node?.style.opacity).toBe('0.5');
    expect(getComputedStyle(node ?? host).opacity).toBe('0.5');
    const rect = node?.querySelector('rect');
    expect(rect?.hasAttribute('opacity')).toBe(false);
    expect(rect?.hasAttribute('fill-opacity')).toBe(false);
    expect(rect?.hasAttribute('stroke-opacity')).toBe(false);
  });

  test('Given a fully opaque shape, When it is drawn, Then no opacity is set', () => {
    const { host } = draw(slideWith(createShape('a', 'rectangle', box)));

    expect(nodeOf(host, 'a')?.style.opacity).toBe('');
  });
});

describe('update draws only what changed (EL-5)', () => {
  test('Given three shapes, When one is moved, Then only that node is touched and the others are the same nodes', () => {
    const a = createShape('a', 'rectangle', box);
    const b = createShape('b', 'ellipse', box);
    const c = createShape('c', 'triangle', box);
    const { host, renderer } = draw(slideWith(a, b, c));
    const [nodeA, nodeB, nodeC] = ['a', 'b', 'c'].map((id) => nodeOf(host, id));
    const svgA = nodeA?.querySelector('svg');
    const childOfA = svgA?.firstElementChild;

    renderer.update(slideWith(a, { ...b, x: 700 }, c));

    expect(nodeOf(host, 'a')).toBe(nodeA);
    expect(nodeOf(host, 'b')).toBe(nodeB);
    expect(nodeOf(host, 'c')).toBe(nodeC);
    expect(nodeB?.style.left).toBe('700px');
    expect(nodeA?.querySelector('svg')?.firstElementChild).toBe(childOfA);
  });

  test('Given a drawn slide, When an element is added and one removed, Then the DOM matches the new slide', () => {
    const a = createShape('a', 'rectangle', box);
    const b = createShape('b', 'ellipse', box);
    const { host, renderer } = draw(slideWith(a, b));

    renderer.update(slideWith(b, createShape('c', 'line', box)));

    expect(idsInOrder(host)).toEqual(['b', 'c']);
  });

  test('Given a drawn slide, When the order changes, Then the DOM order follows, back to front', () => {
    const a = createShape('a', 'rectangle', box);
    const b = createShape('b', 'rectangle', box);
    const c = createShape('c', 'rectangle', box);
    const { host, renderer } = draw(slideWith(a, b, c));
    const nodeA = nodeOf(host, 'a');

    renderer.update(slideWith(b, c, a));

    expect(idsInOrder(host)).toEqual(['b', 'c', 'a']);
    expect(nodeOf(host, 'a')).toBe(nodeA);
  });

  test('Given a drawn slide, When it is updated with another slide, Then the slide id and background follow', () => {
    const { host, renderer } = draw(slideWith());

    renderer.update({ ...createSlide('s2'), background: '#14281B' });

    const surface = host.querySelector<HTMLElement>('.cue-slide');
    expect(surface?.dataset.slideId).toBe('s2');
    expect(surface?.style.background).toBe('rgb(20, 40, 27)');
  });

  test('Given shapes, When the renderer is destroyed, Then nothing is left in the host', () => {
    const { host, renderer } = draw(slideWith(createShape('a', 'rectangle', box)));

    renderer.destroy();

    expect(host.childElementCount).toBe(0);
  });
});
