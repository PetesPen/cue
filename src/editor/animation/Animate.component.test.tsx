import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { EDITING_FADE } from '@/render';
import { changeStep, createShape, createSlide, createStep, type Deck, type Step } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from '../EditorApp';
import { closeTestStores, createTestStore } from '../test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

const shape = (id: string, x: number, opacity = 1) => ({
  ...createShape(id, 'rectangle', { x, y: 200, width: 300, height: 200 }),
  opacity,
});

/** One slide with three rectangles a, b, c, and the given steps. */
async function openWith(store: DeckStore, steps: Step[] = []) {
  const deck: Deck = {
    schemaVersion: 1,
    id: 'deck',
    title: 'Deck',
    createdAt: 1000,
    updatedAt: Date.now(),
    slides: [
      {
        ...createSlide('s1'),
        elements: [shape('a', 100, 0.6), shape('b', 600), shape('c', 1100)],
        animations: steps,
      },
    ],
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

type Screen = Awaited<ReturnType<typeof openWith>>;

const node = (id: string) => {
  const found = document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const opacityOf = (id: string) => Number(getComputedStyle(node(id)).opacity);
const stored = async (store: DeckStore) => (await store.load('deck'))?.slides[0]?.animations ?? [];

async function openAnimate(screen: Screen) {
  await screen.getByRole('tab', { name: 'Animate' }).click();
}
async function pick(id: string) {
  await userEvent.click(node(id));
}

// AN-1: Appear

test('Given a selected element, When Appear is chosen in the Animate tab, Then a step is added and saved, with the defaults', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  await openAnimate(screen);
  await pick('b');

  await screen.getByRole('button', { name: 'Appear', exact: true }).click();

  await expect
    .poll(async () => (await stored(store)).map((s) => [s.element, s.effect, s.style]), {
      timeout: 3000,
    })
    .toEqual([['b', 'appear', 'fade']]);
  const [step] = await stored(store);
  expect(step).toMatchObject({ trigger: 'click', duration: 0.5, delay: 0, easing: 'ease-out' });
  await expect.element(screen.getByText('1 step · 1 click')).toBeVisible();
});

test('Given an element with an Appear step, When the slide is shown in the editor, Then it is faded and carries a badge with its click', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'appear'),
  ]);
  await openAnimate(screen);

  await expect.poll(() => opacityOf('a')).toBeCloseTo(0.6 * EDITING_FADE, 2);
  expect(opacityOf('c')).toBe(1);
  const badges = [...document.querySelectorAll('.step-badge')].map((b) => b.textContent);
  expect(badges).toEqual(['1', '2']);
});

test('Given the Design tab, When the slide has steps, Then there are no badges there', async () => {
  const store = createTestStore();
  await openWith(store, [createStep('st1', 'a', 'appear')]);

  expect(document.querySelectorAll('.step-badge')).toHaveLength(0);
});

test('Given an Appear step, When each style is chosen, Then the step keeps it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'appear')]);
  await openAnimate(screen);
  await pick('a');
  const style = screen.getByRole('group', { name: 'Style' });

  await style.getByRole('button', { name: 'Fade and rise' }).click();
  await expect.poll(async () => (await stored(store))[0]).toMatchObject({ style: 'rise' });
  await style.getByRole('button', { name: 'Instant' }).click();

  await expect.poll(async () => (await stored(store))[0]).toMatchObject({ style: 'instant' });
});

test('Given a slide with steps, When it is reloaded, Then the steps and their settings are as they were', async () => {
  const store = createTestStore();
  const steps = [
    changeStep(createStep('st1', 'a', 'appear'), { style: 'rise', duration: 1.2, delay: 0.3 }),
    createStep('st2', 'b', 'disappear', 'click'),
  ];
  await openWith(store, steps);

  expect(await stored(store)).toEqual(steps);
});

// AN-2: Disappear

test('Given an element with an Appear step, When a Disappear is added, Then both are listed in order with two badges', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'appear')]);
  await openAnimate(screen);
  await pick('a');

  await screen.getByRole('button', { name: 'Then Disappear' }).click();

  await expect
    .poll(async () => (await stored(store)).map((s) => s.effect), { timeout: 3000 })
    .toEqual(['appear', 'disappear']);
  expect([...document.querySelectorAll('.step-badge')].map((b) => b.textContent)).toEqual([
    '1',
    '2',
  ]);
  await expect.element(screen.getByText('2 steps · 2 clicks')).toBeVisible();
});

test('Given a Disappear step, When Instant or Fade out is chosen, Then the step keeps it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'disappear')]);
  await openAnimate(screen);
  await pick('a');

  await screen
    .getByRole('group', { name: 'Style' })
    .getByRole('button', { name: 'Instant' })
    .click();

  await expect.poll(async () => (await stored(store))[0]).toMatchObject({ style: 'instant' });
  await expect
    .element(screen.getByRole('group', { name: 'Style' }).getByRole('button', { name: 'Fade out' }))
    .toBeVisible();
});

test('Given an Appear step, When its effect is changed to Disappear, Then it keeps its element and takes a style that fits', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    changeStep(createStep('st1', 'a', 'appear'), { style: 'rise' }),
  ]);
  await openAnimate(screen);
  await pick('a');

  await screen
    .getByRole('group', { name: 'Effect' })
    .getByRole('button', { name: 'Disappear' })
    .click();

  await expect
    .poll(async () => (await stored(store))[0])
    .toMatchObject({ element: 'a', effect: 'disappear', style: 'fade' });
});

// AN-4: timing

test('Given a step, When Duration, Delay and an easing are set, Then each is saved, in tenths', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'appear')]);
  await openAnimate(screen);
  await pick('a');

  screen.getByRole('slider', { name: 'Duration' }).element().focus();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  await expect.poll(async () => (await stored(store))[0]?.duration, { timeout: 3000 }).toBe(0.7);
  screen.getByRole('slider', { name: 'Delay' }).element().focus();
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(async () => (await stored(store))[0]?.delay, { timeout: 3000 }).toBe(0.1);
  await screen
    .getByRole('group', { name: 'Easing' })
    .getByRole('button', { name: 'Linear' })
    .click();

  await expect.poll(async () => (await stored(store))[0]?.easing, { timeout: 3000 }).toBe('linear');
  await expect.element(screen.getByText('0.7 s')).toBeVisible();
});

// AN-5: the first step is on a click of its own

test('Given the first step, Then With previous is not available; the second can have it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'appear'),
  ]);
  await openAnimate(screen);
  await pick('a');
  const when = () =>
    screen.getByRole('group', { name: 'When' }).getByRole('button', { name: 'With previous' });
  await expect.element(when()).toBeDisabled();

  await pick('b');
  await expect.element(when()).toBeEnabled();
  await when().click();

  await expect
    .poll(async () => (await stored(store))[1]?.trigger, { timeout: 3000 })
    .toBe('with-previous');
  await expect.element(screen.getByText('2 steps · 1 click')).toBeVisible();
});

test('Given a step, When Remove step is pressed, Then it is gone, and Undo brings it back', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'appear')]);
  await openAnimate(screen);
  await pick('a');

  await screen.getByRole('button', { name: 'Remove step' }).click();

  await expect.poll(async () => (await stored(store)).length, { timeout: 3000 }).toBe(0);
  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect.element(screen.getByText('1 step · 1 click')).toBeVisible();
});

test('Given an element with steps, When it is deleted, Then its steps go with it, and Undo brings both back', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'appear'),
  ]);
  await openAnimate(screen);
  await pick('a');

  await userEvent.keyboard('{Delete}');

  await expect.element(screen.getByText('1 step · 1 click')).toBeVisible();
  await screen.getByRole('button', { name: 'Undo' }).click();
  await expect.element(screen.getByText('2 steps · 2 clicks')).toBeVisible();
  expect(node('a')).toBeTruthy();
});

test('Given a slide with steps, Then its thumbnail in the rail has the small dot, and a slide without does not', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'appear')]);

  expect(document.querySelectorAll('.rail-dot')).toHaveLength(1);
  await openAnimate(screen);
  await pick('a');
  await screen.getByRole('button', { name: 'Remove step' }).click();
  await expect.poll(() => document.querySelectorAll('.rail-dot').length).toBe(0);
});

test('Given the rail, Then thumbnails draw every element at its own opacity, not faded', async () => {
  const store = createTestStore();
  await openWith(store, [createStep('st1', 'a', 'appear')]);

  const thumb = document.querySelector<HTMLElement>('.rail-item [data-element-id="a"]');
  expect(Number(getComputedStyle(thumb ?? document.body).opacity)).toBeCloseTo(0.6, 2);
});

// AN-6: Preview

test('Given a slide with steps, When Preview is pressed, Then elements that appear are hidden and the bar says where we are', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'appear'),
  ]);
  await openAnimate(screen);

  await screen.getByRole('button', { name: 'Preview' }).click();

  await expect.poll(() => opacityOf('a')).toBe(0);
  expect(opacityOf('b')).toBe(0);
  expect(opacityOf('c')).toBe(1);
  await expect.element(screen.getByRole('button', { name: 'Play click 1' })).toBeVisible();
  await expect.element(screen.getByText('Click 1 of 2')).toBeVisible();
  expect(document.querySelector('.sel-overlay')).toBeNull();
  expect(document.querySelectorAll('.step-badge')).toHaveLength(0);
});

test('Given a Preview, When the slide is clicked, Then the next click plays: the element ends at its own opacity', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'appear'),
  ]);
  await openAnimate(screen);
  await screen.getByRole('button', { name: 'Preview' }).click();
  await expect.poll(() => opacityOf('a')).toBe(0);

  await userEvent.click(document.querySelector<HTMLElement>('.slide-frame') ?? document.body);

  await expect.poll(() => opacityOf('a'), { timeout: 3000 }).toBeCloseTo(0.6, 2);
  expect(opacityOf('b')).toBe(0);
  await expect.element(screen.getByText('Click 2 of 2')).toBeVisible();
});

test('Given a Preview, When the keys are used, Then Space and the right arrow play, the left arrow steps back, and Escape ends it', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'appear'),
  ]);
  await openAnimate(screen);
  await screen.getByRole('button', { name: 'Preview' }).click();

  await userEvent.keyboard(' ');
  await expect.poll(() => opacityOf('a'), { timeout: 3000 }).toBeCloseTo(0.6, 2);
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => opacityOf('b'), { timeout: 3000 }).toBe(1);
  await expect.element(screen.getByText('2 of 2 played')).toBeVisible();

  await userEvent.keyboard('{ArrowLeft}');
  await expect.poll(() => opacityOf('b')).toBe(0);
  expect(opacityOf('a')).toBeCloseTo(0.6, 2);

  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('button', { name: 'Preview' })).toBeVisible();
});

test('Given a Preview played to the end or stopped halfway, When it ends, Then every element is back as the editor shows it, and the deck, the history and the saved copy are unchanged', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [
    createStep('st1', 'a', 'appear'),
    createStep('st2', 'b', 'disappear'),
  ]);
  const before = await store.load('deck');
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await openAnimate(screen);
  await screen.getByRole('button', { name: 'Preview' }).click();
  await userEvent.keyboard('{ArrowRight}');
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => opacityOf('b'), { timeout: 3000 }).toBe(0);

  await screen.getByRole('button', { name: 'Stop preview' }).click();

  await expect.poll(() => opacityOf('a')).toBeCloseTo(0.6 * EDITING_FADE, 2);
  expect(opacityOf('b')).toBe(1);
  expect(opacityOf('c')).toBe(1);
  expect(node('a').getAnimations()).toHaveLength(0);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(await store.load('deck')).toEqual(before);
});

test('Given a Preview, When another tab is opened, Then it ends', async () => {
  const store = createTestStore();
  const screen = await openWith(store, [createStep('st1', 'a', 'appear')]);
  await openAnimate(screen);
  await screen.getByRole('button', { name: 'Preview' }).click();
  await expect.poll(() => opacityOf('a')).toBe(0);

  await screen.getByRole('tab', { name: 'Design' }).click();

  await expect.poll(() => opacityOf('a')).toBeCloseTo(0.6 * EDITING_FADE, 2);
  expect(document.querySelector('.preview-bar')).toBeNull();
});

test('Given a slide without steps, Then Preview is disabled and the panel says so', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  await openAnimate(screen);

  await expect.element(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  await expect.element(screen.getByText(/No animations on this slide/)).toBeVisible();
});
