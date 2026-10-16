import { afterEach, describe, expect, test } from 'vitest';
import {
  changeStep,
  createShape,
  createSlide,
  createStep,
  resolve,
  type Slide,
  type Step,
} from '@/model';
import { EDITING, EDITING_FADE, RISE_DISTANCE } from './motion';
import { createSlideRenderer, type SlideRenderer } from './slide';

const hosts: HTMLElement[] = [];
const renderers: SlideRenderer[] = [];

function draw(slide: Slide) {
  const host = document.createElement('div');
  host.style.width = '960px';
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

const box = { x: 200, y: 100, width: 400, height: 300 };
const shape = (id: string, opacity = 1, rotation = 0) => ({
  ...createShape(id, 'rectangle', box),
  opacity,
  rotation,
});
const slideWith = (elements: ReturnType<typeof shape>[], ...steps: Step[]): Slide => ({
  ...createSlide('s1'),
  elements,
  animations: steps,
});
const nodeOf = (host: HTMLElement, id: string) => {
  const node = host.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
  if (!node) throw new Error(`no ${id}`);
  return node;
};
const opacityOf = (host: HTMLElement, id: string) =>
  Number(getComputedStyle(nodeOf(host, id)).opacity);

describe('how a slide with animations looks (AN-1, TR-3)', () => {
  const appear = createStep('st1', 'a', 'appear');

  test('Given an element with an Appear step, When it is drawn plainly, Then it is at its own opacity (thumbnails)', () => {
    const { host } = draw(slideWith([shape('a', 0.6)], appear));

    expect(opacityOf(host, 'a')).toBeCloseTo(0.6, 3);
  });

  test('Given the same slide, When it is drawn for the editor, Then the element that starts hidden is faded, and one without a step is not', () => {
    const { host, renderer } = draw(slideWith([shape('a', 0.6), shape('b', 0.6)], appear));

    renderer.update(slideWith([shape('a', 0.6), shape('b', 0.6)], appear), undefined, EDITING);

    expect(opacityOf(host, 'a')).toBeCloseTo(0.6 * EDITING_FADE, 3);
    expect(opacityOf(host, 'b')).toBeCloseTo(0.6, 3);
  });

  test('Given an element at 60%, When the slide is shown before and after its click, Then it is hidden, then at 60% and not 100% (TR-3)', () => {
    const slide = slideWith([shape('a', 0.6)], appear);
    const { host, renderer } = draw(slide);

    renderer.update(slide, undefined, { mode: 'click', click: 0 });
    expect(opacityOf(host, 'a')).toBe(0);
    renderer.update(slide, undefined, { mode: 'click', click: 1 });

    expect(opacityOf(host, 'a')).toBeCloseTo(0.6, 3);
  });

  test('Given an element that disappears, When the slide is shown after its click, Then it is not shown', () => {
    const slide = slideWith([shape('a')], createStep('st1', 'a', 'disappear'));
    const { host, renderer } = draw(slide);

    renderer.update(slide, undefined, { mode: 'click', click: 1 });

    expect(opacityOf(host, 'a')).toBe(0);
  });

  test('Given an element with no step at 60%, When it is drawn for the editor, as a thumbnail and in Preview, Then the opacity is the same number in all three (TR-3)', () => {
    const slide = slideWith([shape('c', 0.6), shape('a', 0.6)], appear);
    const editor = draw(slide);
    const thumbnail = draw(slide);
    const preview = draw(slide);

    editor.renderer.update(slide, undefined, EDITING);
    preview.renderer.update(slide, undefined, { mode: 'click', click: 1 });

    expect(opacityOf(editor.host, 'c')).toBeCloseTo(0.6, 3);
    expect(opacityOf(thumbnail.host, 'c')).toBeCloseTo(0.6, 3);
    expect(opacityOf(preview.host, 'c')).toBeCloseTo(0.6, 3);
    // An animated element, once its click has played, is the same in Preview as in a thumbnail.
    expect(opacityOf(preview.host, 'a')).toBeCloseTo(opacityOf(thumbnail.host, 'a'), 3);
  });
});

describe('playing a click (AN-1, AN-2)', () => {
  test('Given an Appear with fade, When click 1 plays, Then the element animates up to its own opacity and rests there', async () => {
    const slide = slideWith([shape('a', 0.6)], createStep('st1', 'a', 'appear'));
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    const done = renderer.play(slide, 0, 1);

    const animations = nodeOf(host, 'a').getAnimations();
    expect(animations).toHaveLength(1);
    const timing = animations[0]?.effect?.getTiming();
    expect(timing?.duration).toBe(500);
    expect(timing?.easing).toBe('ease-out');
    expect(timing?.fill).toBe('backwards');
    await done;
    expect(nodeOf(host, 'a').getAnimations()).toHaveLength(0);
    expect(opacityOf(host, 'a')).toBeCloseTo(0.6, 3);
  });

  test('Given an Appear with fade and rise on a turned element, When it plays, Then it rises with its turn kept, and ends only turned', async () => {
    const turned = shape('a', 1, 30);
    const step = changeStep(createStep('st1', 'a', 'appear'), { style: 'rise' });
    const slide = slideWith([turned], step);
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    const done = renderer.play(slide, 0, 1);

    const frames = nodeOf(host, 'a').getAnimations()[0]?.effect;
    const keyframes = frames instanceof KeyframeEffect ? frames.getKeyframes() : [];
    expect(keyframes[0]?.transform).toBe(`translateY(${String(RISE_DISTANCE)}px) rotate(30deg)`);
    expect(keyframes[1]?.transform).toBe('rotate(30deg)');
    await done;
    expect(nodeOf(host, 'a').style.transform).toBe('rotate(30deg)');
  });

  test('Given an instant Appear with no delay, When it plays, Then nothing is animated and the element is there', async () => {
    const step = changeStep(createStep('st1', 'a', 'appear'), { style: 'instant' });
    const slide = slideWith([shape('a')], step);
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    const done = renderer.play(slide, 0, 1);

    expect(nodeOf(host, 'a').getAnimations()).toHaveLength(0);
    await done;
    expect(opacityOf(host, 'a')).toBe(1);
  });

  test('Given an instant Disappear with a delay of 0.3 s, When it plays, Then it waits that long, still shown, then goes', async () => {
    const step = changeStep(createStep('st1', 'a', 'disappear'), { style: 'instant', delay: 0.3 });
    const slide = slideWith([shape('a')], step);
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    const done = renderer.play(slide, 0, 1);

    const timing = nodeOf(host, 'a').getAnimations()[0]?.effect?.getTiming();
    expect(timing?.delay).toBe(300);
    expect(opacityOf(host, 'a')).toBe(1);
    await done;
    expect(opacityOf(host, 'a')).toBe(0);
  });

  test('Given a Disappear with fade, When it plays, Then it animates down and rests at nothing', async () => {
    const slide = slideWith([shape('a', 0.8)], createStep('st1', 'a', 'disappear'));
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    const done = renderer.play(slide, 0, 1);

    expect(nodeOf(host, 'a').getAnimations()).toHaveLength(1);
    await done;
    expect(opacityOf(host, 'a')).toBe(0);
  });

  test('Given two steps on one click, When it plays, Then both animate together, each with its own timing', async () => {
    const slide = slideWith(
      [shape('a'), shape('b')],
      createStep('st1', 'a', 'appear'),
      changeStep(createStep('st2', 'b', 'appear', 'with-previous'), { duration: 1.2, delay: 0.2 }),
    );
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    const done = renderer.play(slide, 0, 1);

    expect(nodeOf(host, 'a').getAnimations()[0]?.effect?.getTiming().duration).toBe(500);
    const second = nodeOf(host, 'b').getAnimations()[0]?.effect?.getTiming();
    expect(second?.duration).toBe(1200);
    expect(second?.delay).toBe(200);
    await done;
  });

  test('Given a click played and then another at once, When both are done, Then every element is exactly as the resolver says for the last click', async () => {
    const slide = slideWith(
      [shape('a'), shape('b'), shape('c')],
      createStep('st1', 'a', 'appear'),
      createStep('st2', 'b', 'appear'),
      createStep('st3', 'a', 'disappear'),
    );
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    void renderer.play(slide, 0, 1);
    await renderer.play(slide, 1, 2);
    await renderer.play(slide, 2, 3);

    const hidden = resolve(slide, 3).hidden;
    for (const id of ['a', 'b', 'c']) expect(opacityOf(host, id)).toBe(hidden.has(id) ? 0 : 1);
    for (const id of ['a', 'b', 'c']) expect(nodeOf(host, id).getAnimations()).toHaveLength(0);
  });

  test('Given a play in progress, When the slide is settled, Then every animation stops and the elements are in the state of the click', () => {
    const slide = slideWith([shape('a')], createStep('st1', 'a', 'appear'));
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });
    void renderer.play(slide, 0, 1);

    renderer.settle();

    expect(nodeOf(host, 'a').getAnimations()).toHaveLength(0);
    expect(opacityOf(host, 'a')).toBe(1);
  });

  test('Given a jump of more than one click, When it is played, Then the slide just shows that click', async () => {
    const slide = slideWith(
      [shape('a'), shape('b')],
      createStep('st1', 'a', 'appear'),
      createStep('st2', 'b', 'appear'),
    );
    const { host, renderer } = draw(slide);
    renderer.update(slide, undefined, { mode: 'click', click: 0 });

    await renderer.play(slide, 0, 2);

    expect(nodeOf(host, 'a').getAnimations()).toHaveLength(0);
    expect(opacityOf(host, 'a')).toBe(1);
    expect(opacityOf(host, 'b')).toBe(1);
  });
});
