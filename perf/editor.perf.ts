import { expect, test, type Page } from '@playwright/test';
import { fiftyElementDeck, fiftySlideDeck, HEAVY_SLIDE_ID } from '../tests/fixtures/heavyDeck';
import {
  enforced,
  openDeck,
  report,
  startFrameMeter,
  stopFrameMeter,
  withFrameTrace,
  reloadAndMeasure,
} from './support';

// UX-3, responsive performance (sprint 5): dragging and resizing on a slide of 50 elements, opening a
// deck of 50 slides, and typing in it. The method and the budgets follow spike SP-4: on the nightly
// runner (no graphics card) Chromium and Firefox are held to a share of late frames, 60 fps itself is
// confirmed by hand on a real laptop and a Mac. The budgets are in `config/budgets.json`.

import budgets from '../config/budgets.json' with { type: 'json' };

const { perf } = budgets;

/** Slide pixels to page pixels, for the slide on the canvas. */
async function slidePoint(page: Page, x: number, y: number) {
  const box = await page.locator('.canvas .slide-frame').boundingBox();
  if (!box) throw new Error('the slide has no box');
  return { x: box.x + (x / 1920) * box.width, y: box.y + (y / 1080) * box.height };
}

/** Press at `from`, move to `to` in many small steps one frame apart, and release. */
async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  moves = 120,
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= moves; i++) {
    const t = i / moves;
    // A curve, not a straight line, so the move is never a single repeated delta.
    await page.mouse.move(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t + Math.sin(t * Math.PI * 2) * 30,
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

test.describe('Given a slide of 50 elements (UX-3)', () => {
  test('When one is dragged across the slide, Then the frames stay on time', async ({
    page,
    browser,
  }, info) => {
    await openDeck(page, fiftyElementDeck(), 'fifty-elements');
    const from = await slidePoint(page, 95, 95);
    const to = await slidePoint(page, 1500, 760);

    await startFrameMeter(page);
    const { trace } = await withFrameTrace(browser, page, () => dragBetween(page, from, to));
    const stats = await stopFrameMeter(page);

    report(info, 'drag', { ...stats, trace });
    // It really moved.
    const box = await page
      .locator(`.canvas [data-element-id="${HEAVY_SLIDE_ID}-shape-0"]`)
      .boundingBox();
    expect(box?.x).toBeGreaterThan(to.x - 200);
    if (!enforced(info)) return;
    expect(stats.lateShare).toBeLessThanOrEqual(perf.lateFrameShare);
    if (trace) expect(trace.droppedShare).toBeLessThanOrEqual(perf.droppedFrameShare);
  });

  test('When one is resized by a corner handle, Then the frames stay on time', async ({
    page,
    browser,
  }, info) => {
    await openDeck(page, fiftyElementDeck(), 'fifty-elements');
    const shape = await slidePoint(page, 95, 95);
    await page.mouse.click(shape.x, shape.y);
    const handle = page.locator('.sel-box .handle[data-handle="se"]');
    const at = await handle.boundingBox();
    if (!at) throw new Error('no handle');
    const from = { x: at.x + at.width / 2, y: at.y + at.height / 2 };
    const to = { x: from.x + 260, y: from.y + 150 };

    await startFrameMeter(page);
    const { trace } = await withFrameTrace(browser, page, () => dragBetween(page, from, to, 90));
    const stats = await stopFrameMeter(page);

    report(info, 'resize', { ...stats, trace });
    if (!enforced(info)) return;
    expect(stats.lateShare).toBeLessThanOrEqual(perf.lateFrameShare);
    if (trace) expect(trace.droppedShare).toBeLessThanOrEqual(perf.droppedFrameShare);
  });
});

test.describe('Given a deck of 50 slides (UX-3)', () => {
  test('When it is opened, Then the first slide is drawn with its fonts, and the first thumbnails are there, within the budget', async ({
    page,
  }, info) => {
    await openDeck(page, fiftySlideDeck(), 'fifty-slides');
    const ready = await reloadAndMeasure(page);

    report(info, 'open', { readyMs: ready });
    if (!enforced(info)) return;
    expect(ready).toBeLessThanOrEqual(perf.openDeckMs);
  });

  test('When text is typed, Then no key press waits long for its frame, with the thumbnails kept up to date', async ({
    page,
  }, info) => {
    await openDeck(page, fiftySlideDeck(), 'fifty-slides');
    const word = await slidePoint(page, 100, 250);
    await page.mouse.dblclick(word.x, word.y);
    const editor = page.locator('.text-edit-box .ProseMirror');
    await expect(editor).toBeFocused();
    // ProseMirror ignores cursor moves for a moment after it opens (a person cannot type that fast).
    await page.waitForTimeout(400);
    await page.keyboard.press('End');
    await page.evaluate(() => {
      const waits: number[] = [];
      window.__keys = waits;
      window.addEventListener(
        'keydown',
        () => {
          const t0 = performance.now();
          requestAnimationFrame(() => {
            setTimeout(() => {
              waits.push(performance.now() - t0);
            }, 0);
          });
        },
        true,
      );
    });

    await page.keyboard.type(
      'Typing a sentence into a deck of fifty slides, with a thumbnail for each. ',
      {
        delay: 30,
      },
    );
    await page.waitForTimeout(500);
    const waits = await page.evaluate(() => window.__keys ?? []);
    const sorted = [...waits].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;

    report(info, 'typing', {
      keys: waits.length,
      p95Ms: Math.round(p95),
      maxMs: Math.round(max),
    });
    expect(waits.length).toBeGreaterThan(50);
    if (!enforced(info)) return;
    expect(p95).toBeLessThanOrEqual(perf.typingP95Ms);
    expect(max).toBeLessThanOrEqual(perf.typingMaxMs);
  });
});
