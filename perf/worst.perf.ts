import { expect, test } from '@playwright/test';
import { fiftyHeavySlidesDeck } from '../tests/fixtures/heavyDeck';
import { enforced, openDeck, report, reloadAndMeasure } from './support';

// The worst case for UX-3: 50 slides that each hold 50 elements (2,500 elements, 50 thumbnails of 50
// each). Opening it and typing in it must still be fast, which is what drawing only what is needed
// (and only what can be seen) is for. The budgets are in `config/budgets.json`.

import budgets from '../config/budgets.json' with { type: 'json' };

const { perf } = budgets;

test('Given 50 slides of 50 elements each, When the deck is opened, Then the first slide is drawn within the budget', async ({
  page,
}, info) => {
  await openDeck(page, fiftyHeavySlidesDeck(), 'fifty-heavy-slides');
  const ready = await reloadAndMeasure(page);

  report(info, 'open-worst', { readyMs: ready });
  if (!enforced(info)) return;
  expect(ready).toBeLessThanOrEqual(perf.openDeckMs);
});

test('Given 50 slides of 50 elements each, When text is typed, Then no key press waits long for its frame', async ({
  page,
}, info) => {
  await openDeck(page, fiftyHeavySlidesDeck(), 'fifty-heavy-slides');
  const box = await page.locator('.canvas .slide-frame').boundingBox();
  if (!box) throw new Error('the slide has no box');
  await page.mouse.dblclick(box.x + (100 / 1920) * box.width, box.y + (250 / 1080) * box.height);
  await expect(page.locator('.text-edit-box .ProseMirror')).toBeFocused();
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
    'Typing into the heaviest deck there is, with fifty thumbnails of fifty. ',
    {
      delay: 30,
    },
  );
  await page.waitForTimeout(500);
  const waits = await page.evaluate(() => window.__keys ?? []);
  const sorted = [...waits].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  report(info, 'typing-worst', {
    keys: waits.length,
    p95Ms: Math.round(p95),
    maxMs: Math.round(max),
  });
  expect(waits.length).toBeGreaterThan(50);
  if (!enforced(info)) return;
  expect(p95).toBeLessThanOrEqual(perf.typingP95Ms);
  expect(max).toBeLessThanOrEqual(perf.typingMaxMs);
});
