import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { parseDeck } from '@/model';
import { fiftyElementDeck, fiftySlideDeck } from '../../tests/fixtures/heavyDeck';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore } from './test-helpers';

afterEach(() => {
  closeTestStores();
  window.location.hash = '';
});

// UX-3: the work the editor does must stay small as a slide or a deck grows. The nightly performance
// suite measures frames and time on a real build; these checks count the work itself (which parts of
// the page are touched), so a change that makes an edit redraw everything fails on every pull request,
// on any machine.

async function open(deck: object, id: string) {
  const store = createTestStore();
  await store.save(parseDeck(JSON.parse(JSON.stringify(deck))));
  window.location.hash = `#/deck/${id}`;
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

/** Record every part of `root` that is changed from now on. */
function watch(root: Element) {
  const touched = new Set<Node>();
  const observer = new MutationObserver((records) => {
    for (const record of records) touched.add(record.target);
  });
  observer.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  return {
    touched,
    stop: () => {
      for (const record of observer.takeRecords()) touched.add(record.target);
      observer.disconnect();
    },
  };
}

const idOf = (node: Node) =>
  (node instanceof Element ? node : node.parentElement)
    ?.closest('[data-element-id]')
    ?.getAttribute('data-element-id');

const canvasSlide = () => {
  const found = document.querySelector('.canvas .cue-slide');
  if (!found) throw new Error('no slide on the canvas');
  return found;
};

test('Given a slide of 50 elements, When one is nudged, Then only that element is redrawn on the canvas', async () => {
  await open(fiftyElementDeck(), 'fifty-elements');
  const mover = document.querySelector<HTMLElement>('.canvas [data-element-id="heavy-shape-0"]');
  if (!mover) throw new Error('no shape');
  await userEvent.click(mover);
  const watching = watch(canvasSlide());

  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
  await expect.poll(() => mover.style.left, { timeout: 3000 }).toBe('23px');
  watching.stop();

  const redrawn = new Set([...watching.touched].map(idOf).filter((id) => id !== undefined));
  expect([...redrawn]).toEqual(['heavy-shape-0']);
});

test('Given a deck of 50 slides, When an element on the first is nudged, Then no other thumbnail is touched', async () => {
  await open(fiftySlideDeck(), 'fifty-slides');
  const mover = document.querySelector<HTMLElement>('.canvas [data-element-id="heavy-shape-0"]');
  if (!mover) throw new Error('no shape');
  await userEvent.click(mover);
  const rail = document.querySelector('.rail-list');
  if (!rail) throw new Error('no rail');
  const watching = watch(rail);

  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  await expect.poll(() => mover.style.left, { timeout: 3000 }).toBe('22px');
  watching.stop();

  const items = [...rail.querySelectorAll('.rail-item')];
  const touchedItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => [...watching.touched].some((node) => item.contains(node)))
    .map(({ index }) => index);
  expect(touchedItems).toEqual([0]);
});

test('Given a deck of 50 slides, When the rail opens, Then only the thumbnails near the top are drawn, and scrolling draws more', async () => {
  await open(fiftySlideDeck(), 'fifty-slides');

  const drawn = () => document.querySelectorAll('.rail-item .cue-slide').length;
  expect(drawn()).toBeGreaterThanOrEqual(7);
  expect(drawn()).toBeLessThan(25);
  // Every slide still has its place in the rail, at its size, with its own colour.
  expect(document.querySelectorAll('.rail-item')).toHaveLength(50);

  const rail = document.querySelector('.rail-list');
  if (!rail) throw new Error('no rail');
  rail.scrollTop = rail.scrollHeight;
  const slideAt = (n: number) =>
    document.querySelectorAll('.rail-item')[n]?.querySelector('.cue-slide');
  await expect
    .poll(() => slideAt(49) !== null && slideAt(49) !== undefined, { timeout: 3000 })
    .toBe(true);
  // The ones in the middle, far from both, are still not drawn.
  expect(slideAt(25) ?? null).toBeNull();
  expect(drawn()).toBeLessThan(35);
});

test('Given a deck of 50 slides, When text is typed into a box, Then the other 49 thumbnails stay as they are', async () => {
  const screen = await open(fiftySlideDeck(), 'fifty-slides');
  const text = document.querySelector<HTMLElement>('.canvas [data-element-id="heavy-text-0"]');
  if (!text) throw new Error('no text box');
  await userEvent.dblClick(text);
  await expect
    .poll(() => document.querySelector('.text-edit-box .ProseMirror') !== null)
    .toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const rail = document.querySelector('.rail-list');
  if (!rail) throw new Error('no rail');
  const watching = watch(rail);

  await userEvent.keyboard('{End}hello');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  watching.stop();

  const items = [...rail.querySelectorAll('.rail-item')];
  const touchedItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => [...watching.touched].some((node) => item.contains(node)))
    .map(({ index }) => index);
  expect(touchedItems).toEqual([0]);
  await expect.element(screen.getByRole('option', { name: 'Slide 50', exact: true })).toBeVisible();
});
