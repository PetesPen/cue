import { expect, test } from '@playwright/test';
import {
  fiftyElementDeck,
  fiftyHeavySlidesDeck,
  fiftySlideDeck,
} from '../tests/fixtures/heavyDeck';
import { openDeck, report, startFrameMeter, stopFrameMeter, reloadAndMeasure } from './support';

// A slower computer (UX-3): Chromium with its processor slowed down, which turns a margin into a
// number. If a drag only just holds 60 fps here, a real laptop with a weak processor will not.

test('Given a processor 4 times slower, When one of 50 elements is dragged, Then frames are still mostly on time', async ({
  page,
  browserName,
}, info) => {
  test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium feature');
  await openDeck(page, fiftyElementDeck(), 'fifty-elements');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const box = await page.locator('.canvas .slide-frame').boundingBox();
  if (!box) throw new Error('no slide');
  const at = (x: number, y: number) => ({
    x: box.x + (x / 1920) * box.width,
    y: box.y + (y / 1080) * box.height,
  });
  const from = at(95, 95);
  const to = at(1500, 760);

  await startFrameMeter(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 120; i++) {
    const t = i / 120;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const stats = await stopFrameMeter(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  report(info, 'drag-4x-slower', { ...stats });
  expect(stats.frames).toBeGreaterThan(50);
});

test('Given a processor 4 times slower, When a deck of 50 slides is opened, Then it opens', async ({
  page,
  browserName,
}, info) => {
  test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium feature');
  await openDeck(page, fiftySlideDeck(), 'fifty-slides');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ready = await reloadAndMeasure(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  report(info, 'open-4x-slower', { readyMs: ready });
  expect(ready).toBeGreaterThan(0);
});

test('Given a processor 4 times slower, When 50 slides of 50 elements are opened, Then it still opens', async ({
  page,
  browserName,
}, info) => {
  test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium feature');
  await openDeck(page, fiftyHeavySlidesDeck(), 'fifty-heavy-slides');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ready = await reloadAndMeasure(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  report(info, 'open-worst-4x-slower', { readyMs: ready });
  expect(ready).toBeGreaterThan(0);
});
