import { afterEach, expect, test } from 'vitest';
import { createSlide } from '@/model';
import { mountSlide } from './slide';

const hosts: HTMLElement[] = [];
function hostOfWidth(width: number): HTMLElement {
  const host = document.createElement('div');
  host.style.width = `${String(width)}px`;
  document.body.append(host);
  hosts.push(host);
  return host;
}
afterEach(() => {
  while (hosts.length > 0) hosts.pop()?.remove();
});

const scaleOf = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).a;

test('Given a host 192 px wide, When a slide is mounted, Then the 1920 px slide is scaled to 0.1 and the box is 16:9', () => {
  const host = hostOfWidth(192);

  mountSlide(host, createSlide('s1'));

  const viewport = host.querySelector('.cue-slide-viewport');
  const surface = host.querySelector('.cue-slide');
  expect(viewport?.getBoundingClientRect().height).toBeCloseTo(108, 1);
  expect(surface && scaleOf(surface)).toBeCloseTo(0.1, 5);
});

test('Given a mounted slide, When its host is resized, Then the scale follows', async () => {
  const host = hostOfWidth(192);
  mountSlide(host, createSlide('s1'));

  host.style.width = '960px';

  await expect
    .poll(() => scaleOf(host.querySelector('.cue-slide') ?? host), { timeout: 2000 })
    .toBeCloseTo(0.5, 5);
});

test('Given a slide with a colour and an id, When it is mounted, Then both are drawn', () => {
  const host = hostOfWidth(400);

  mountSlide(host, { ...createSlide('s2'), background: '#14281B' });

  const surface = host.querySelector<HTMLElement>('.cue-slide');
  expect(surface?.dataset.slideId).toBe('s2');
  expect(surface?.style.background).toBe('rgb(20, 40, 27)');
});

test('Given a mounted slide, When it is unmounted, Then nothing is left in the host', () => {
  const host = hostOfWidth(400);

  const unmount = mountSlide(host, { ...createSlide('s1') });
  unmount();

  expect(host.childElementCount).toBe(0);
});
