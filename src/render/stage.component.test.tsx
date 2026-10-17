import { afterEach, describe, expect, test } from 'vitest';
import {
  createShape,
  createSlide,
  createStep,
  TRANSITION_KINDS,
  TRANSITION_SIDES,
  type Slide,
  type Transition,
  type TransitionKind,
  type TransitionSide,
} from '@/model';
import { createSlideRenderer } from './slide';
import { createSlideStage, layerMotion, ZOOM_FROM, type SlideStage } from './stage';

const hosts: HTMLElement[] = [];
const stages: SlideStage[] = [];

function mount(slide: Slide) {
  const host = document.createElement('div');
  host.style.width = '960px';
  document.body.append(host);
  hosts.push(host);
  const stage = createSlideStage(host, slide);
  stages.push(stage);
  return { host, stage };
}

afterEach(() => {
  while (stages.length > 0) stages.pop()?.destroy();
  while (hosts.length > 0) hosts.pop()?.remove();
});

const box = { x: 200, y: 100, width: 400, height: 300 };
const slideWith = (id: string, fill: string, ...ids: string[]): Slide => ({
  ...createSlide(id),
  background: fill,
  elements: ids.map((element) => createShape(element, 'rectangle', box)),
});

const outgoing = slideWith('one', '#112233', 'a');
const incoming = slideWith('two', '#AABBCC', 'b');

/** A transition short enough for a test. */
const quick = (
  kind: TransitionKind,
  from: TransitionSide = 'right',
  seconds = 0.4,
): Transition => ({
  kind,
  from,
  duration: seconds,
});

const layers = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('.cue-layer')];
const slideIn = (layer: HTMLElement | undefined) =>
  layer?.querySelector<HTMLElement>('.cue-slide')?.dataset.slideId;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function must(host: HTMLElement, selector: string): HTMLElement {
  const node = host.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`nothing matches ${selector}`);
  return node;
}
const opacityOf = (host: HTMLElement, id: string) =>
  Number(getComputedStyle(must(host, `[data-element-id="${id}"]`)).opacity);

/** The nodes the running animations under the host move. */
const movedNodes = (host: HTMLElement) =>
  host
    .getAnimations({ subtree: true })
    .flatMap((animation) =>
      animation.effect instanceof KeyframeEffect && animation.effect.target
        ? [animation.effect.target]
        : [],
    );

/** The properties every running animation under the stage changes. */
function animatedProperties(host: HTMLElement): string[] {
  const names = new Set<string>();
  for (const animation of host.getAnimations({ subtree: true })) {
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect)) continue;
    for (const frame of effect.getKeyframes()) {
      for (const name of Object.keys(frame)) {
        if (!['offset', 'computedOffset', 'easing', 'composite'].includes(name)) names.add(name);
      }
    }
  }
  return [...names].sort();
}

describe('what a transition moves (TN-5)', () => {
  test.each(TRANSITION_KINDS)(
    'Given %s on every side, When its layer motion is read, Then it changes only opacity and transform',
    (kind) => {
      for (const from of TRANSITION_SIDES) {
        const motion = layerMotion(quick(kind, from));
        const names = [...motion.top, ...(motion.bottom ?? [])].flatMap((frame) =>
          Object.keys(frame).filter((name) => name !== 'offset'),
        );

        for (const name of names) expect(['opacity', 'transform']).toContain(name);
      }
    },
  );

  test('Given Zoom, When it plays, Then the new slide grows from a part of its size and fades in', () => {
    const [from, to] = layerMotion(quick('zoom')).top;

    expect(from).toEqual({ transform: `scale(${String(ZOOM_FROM)})`, opacity: 0 });
    expect(to).toEqual({ transform: 'none', opacity: 1 });
  });

  test('Given Slide and Push, When they come from each side, Then the new slide starts out of view on that side, and only Push moves the old one', () => {
    const slide = layerMotion(quick('slide', 'left'));
    const push = layerMotion(quick('push', 'bottom'));

    expect(slide.top[0]).toEqual({ transform: 'translate(-100%, 0)' });
    expect(slide.bottom).toBeUndefined();
    expect(push.top[0]).toEqual({ transform: 'translate(0, 100%)' });
    expect(push.bottom?.[1]).toEqual({ transform: 'translate(0, -100%)' });
  });
});

describe('playing a transition on the stage (TN-5)', () => {
  test.each(['fade', 'slide', 'push', 'zoom'] as const)(
    'Given %s, When it plays, Then only opacity and transform change, and at the end the new slide is exactly a plain draw of it',
    async (kind) => {
      const { host, stage } = mount(outgoing);

      const done = stage.transition(incoming, { mode: 'click', click: 0 }, quick(kind), false);

      expect(layers(host)).toHaveLength(2);
      for (const name of animatedProperties(host)) expect(['opacity', 'transform']).toContain(name);
      await done;

      expect(layers(host)).toHaveLength(1);
      expect(host.getAnimations({ subtree: true })).toHaveLength(0);
      const fresh = document.createElement('div');
      fresh.style.width = '960px';
      document.body.append(fresh);
      hosts.push(fresh);
      createSlideRenderer(fresh, incoming).update(incoming, undefined, { mode: 'click', click: 0 });
      expect(host.querySelector('.cue-slide')?.outerHTML).toBe(
        fresh.querySelector('.cue-slide')?.outerHTML,
      );
    },
  );

  test('Given a transition going forward, Then the new slide is drawn over the old one', async () => {
    const { host, stage } = mount(outgoing);

    const done = stage.transition(incoming, { mode: 'plain' }, quick('slide'), false);

    expect(layers(host).map(slideIn)).toEqual(['one', 'two']);
    await done;
  });

  test('Given a transition going back, Then the old slide goes away over the new one, with the same motion undone', async () => {
    const { host, stage } = mount(outgoing);

    const done = stage.transition(incoming, { mode: 'plain' }, quick('slide'), true);

    expect(layers(host).map(slideIn)).toEqual(['two', 'one']);
    const [animation] = host.getAnimations({ subtree: true });
    expect(animation?.effect?.getTiming().direction).toBe('reverse');
    expect(movedNodes(host)).toEqual([layers(host)[1]]);
    await done;
    expect(layers(host).map(slideIn)).toEqual(['two']);
  });

  test('Given Push, When it plays, Then both layers move', async () => {
    const { host, stage } = mount(outgoing);

    const done = stage.transition(incoming, { mode: 'plain' }, quick('push', 'right'), false);

    const targets = movedNodes(host);
    expect(targets).toEqual(expect.arrayContaining(layers(host)));
    expect(targets).toHaveLength(2);
    await done;
  });

  test('Given a transition of None, When it is asked for, Then the new slide is there at once with nothing animating', async () => {
    const { host, stage } = mount(outgoing);

    await stage.transition(incoming, { mode: 'plain' }, quick('none'), false);

    expect(layers(host).map(slideIn)).toEqual(['two']);
  });

  test('Given a slide with steps, When the show arrives at it, Then none of its steps plays during the transition', async () => {
    const stepped: Slide = {
      ...slideWith('two', '#AABBCC', 'b', 'c'),
      animations: [createStep('s1', 'b', 'appear'), createStep('s2', 'c', 'appear')],
    };
    const { host, stage } = mount(outgoing);

    const done = stage.transition(stepped, { mode: 'click', click: 0 }, quick('fade'), false);

    // The only animation is the layer's own; no element of the new slide is animating, and they are not shown.
    const targets = movedNodes(host);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target.classList.contains('cue-layer'))).toBe(true);
    expect([opacityOf(host, 'b'), opacityOf(host, 'c')]).toEqual([0, 0]);
    await done;
  });

  test('Given a transition cut short, When the stage is settled, Then the new slide is there at rest and nothing is still animating', async () => {
    const { host, stage } = mount(outgoing);

    const done = stage.transition(incoming, { mode: 'plain' }, quick('push', 'right', 5), false);
    await wait(60);
    stage.settle();

    expect(layers(host).map(slideIn)).toEqual(['two']);
    expect(host.getAnimations({ subtree: true })).toHaveLength(0);
    expect(getComputedStyle(must(host, '.cue-layer')).transform).toBe('none');
    // The promise still resolves.
    await done;
  });

  test('Given a transition in progress, When another starts, Then the first lands and the second plays from it', async () => {
    const third = slideWith('three', '#556677', 'c');
    const { host, stage } = mount(outgoing);

    const first = stage.transition(incoming, { mode: 'plain' }, quick('slide', 'right', 5), false);
    await wait(30);
    const second = stage.transition(third, { mode: 'plain' }, quick('fade', 'right', 0.2), false);

    // Never more than the slide that had arrived and the one arriving now.
    expect(layers(host).map(slideIn)).toEqual(['two', 'three']);
    await Promise.all([first, second]);
    expect(layers(host).map(slideIn)).toEqual(['three']);
  });

  test('Given the stage, When a slide is shown at once while a transition runs, Then the transition is over', () => {
    const { host, stage } = mount(outgoing);

    void stage.transition(incoming, { mode: 'plain' }, quick('fade', 'right', 5), false);
    stage.show(incoming, { mode: 'click', click: 0 });

    expect(layers(host).map(slideIn)).toEqual(['two']);
    expect(host.getAnimations({ subtree: true })).toHaveLength(0);
  });

  test('Given a click on the slide on the stage, When it is played, Then the stage shows it as the slide renderer does', async () => {
    const stepped: Slide = {
      ...slideWith('one', '#112233', 'a'),
      animations: [createStep('s1', 'a', 'appear')],
    };
    const { host, stage } = mount(stepped);
    stage.show(stepped, { mode: 'click', click: 0 });
    expect(opacityOf(host, 'a')).toBe(0);

    await stage.play(stepped, 0, 1);

    expect(opacityOf(host, 'a')).toBe(1);
  });

  test('Given the stage, When it is destroyed during a transition, Then nothing is left in the page', () => {
    const { host, stage } = mount(outgoing);

    void stage.transition(incoming, { mode: 'plain' }, quick('push', 'right', 5), false);
    stage.destroy();

    expect(host.querySelector('.cue-stage')).toBeNull();
    expect(host.getAnimations({ subtree: true })).toHaveLength(0);
  });
});
