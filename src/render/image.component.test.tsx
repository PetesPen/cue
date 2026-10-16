import { afterEach, expect, test } from 'vitest';
import { createImage, createSlide, type Slide } from '@/model';
import type { ImageSource } from './images';
import { setImageSource } from './images';
import { createSlideRenderer, mountSlide } from './slide';

// EL-4: pictures are drawn by the same renderer as everything else, from whatever the image source
// gives it: the editor's cache now, the pictures inlined in the file for the HTML export later.

const hosts: HTMLElement[] = [];
function host(): HTMLElement {
  const element = document.createElement('div');
  element.style.width = '960px';
  document.body.append(element);
  hosts.push(element);
  return element;
}
afterEach(() => {
  setImageSource(undefined);
  while (hosts.length > 0) hosts.pop()?.remove();
});

const slideWith = (...elements: Slide['elements'][number][]): Slide => ({
  ...createSlide('s'),
  elements,
});
const picture = (hash: string, extra: object = {}) => ({
  ...createImage('p', hash, { x: 100, y: 200, width: 400, height: 300 }, 'A red square'),
  ...extra,
});

/** A source that has the pictures in `ready` now and the ones in `later` when `arrive` is called. */
function source(ready: Record<string, string>, later: Record<string, string> = {}) {
  const urls = new Map(Object.entries(ready));
  const waiting = new Map<string, (() => void)[]>();
  const asked: string[] = [];
  const api: ImageSource = {
    url: (hash) => urls.get(hash),
    load: (hash, done) => {
      asked.push(hash);
      waiting.set(hash, [...(waiting.get(hash) ?? []), done]);
    },
  };
  return {
    api,
    asked,
    arrive(hash: string) {
      const url = later[hash];
      if (url !== undefined) urls.set(hash, url);
      for (const done of waiting.get(hash) ?? []) done();
    },
  };
}

const RED =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="red"/%3E%3C/svg%3E';
const BLUE = RED.replace('red', 'blue');

test('Given a picture the source has, When the slide is drawn, Then the box shows it filling the box, with its description', () => {
  const given = source({ h1: RED });
  setImageSource(given.api);
  const target = host();

  mountSlide(target, slideWith(picture('h1')));

  const node = target.querySelector<HTMLElement>('[data-kind="image"]');
  const img = node?.querySelector('img');
  expect(node?.style.left).toBe('100px');
  expect(node?.style.width).toBe('400px');
  expect(node?.style.height).toBe('300px');
  expect(img?.getAttribute('src')).toBe(RED);
  expect(img?.alt).toBe('A red square');
  expect(img && getComputedStyle(img).objectFit).toBe('fill');
});

test('Given a picture that is not loaded yet, When it arrives, Then the box draws it', () => {
  const given = source({}, { h1: RED });
  setImageSource(given.api);
  const target = host();
  mountSlide(target, slideWith(picture('h1')));
  const img = target.querySelector('img');
  expect(img?.hasAttribute('src')).toBe(false);
  expect(given.asked).toEqual(['h1']);

  given.arrive('h1');

  expect(img?.getAttribute('src')).toBe(RED);
});

test('Given a box whose picture is changed while the first is still loading, When the first arrives, Then it does not replace the second', () => {
  const given = source({ h2: BLUE }, { h1: RED });
  setImageSource(given.api);
  const target = host();
  const renderer = createSlideRenderer(target, slideWith(picture('h1')));

  renderer.update(slideWith(picture('h2')));
  given.arrive('h1');

  expect(target.querySelector('img')?.getAttribute('src')).toBe(BLUE);
});

test('Given a faded picture with a frame and a fill, When it is drawn, Then the whole box fades with its fill and border', () => {
  setImageSource(source({ h1: RED }).api);
  const target = host();

  mountSlide(
    target,
    slideWith(
      picture('h1', {
        opacity: 0.5,
        fill: '#F5C542',
        border: { color: '#14281B', width: 6, dash: 'solid' },
        rotation: 10,
      }),
    ),
  );

  const node = target.querySelector<HTMLElement>('[data-kind="image"]');
  expect(node?.style.opacity).toBe('0.5');
  expect(node?.style.background).toContain('rgb(245, 197, 66)');
  expect(node?.style.border).toContain('6px');
  expect(node?.style.transform).toBe('rotate(10deg)');
});

test('Given no image source, When a picture is drawn, Then the box is there and empty, and nothing breaks', () => {
  const target = host();

  mountSlide(target, slideWith(picture('h1')));

  expect(target.querySelector('[data-kind="image"] img')?.hasAttribute('src')).toBe(false);
});

test('Given the same picture drawn again unchanged, When the slide is updated, Then the box is not redrawn from scratch', () => {
  const given = source({ h1: RED });
  setImageSource(given.api);
  const target = host();
  const first = slideWith(picture('h1'));
  const renderer = createSlideRenderer(target, first);
  const img = target.querySelector('img');

  renderer.update({ ...first, elements: [picture('h1', { x: 900 })] });

  expect(target.querySelector('img')).toBe(img);
  expect(target.querySelector<HTMLElement>('[data-kind="image"]')?.style.left).toBe('900px');
});
