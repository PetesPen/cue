import { expect, test, type Page } from '@playwright/test';
import { openDeck, opacityOf, present, settled } from './support/show';

// Sprint 8: the two windows stay together (PM-3): within 100 ms, when one is closed or reloaded, and
// Reconnect. Web Locks tell a window that the other is gone (SP-1).

import budgets from '../config/budgets.json' with { type: 'json' };

test.use({ viewport: { width: 1440, height: 900 } });

const { show } = budgets;

/** The audience window's own reading of the slide it shows. */
const slideOf = (page: Page) =>
  page.evaluate(
    () => document.querySelector('.show-stage .cue-slide')?.getAttribute('data-slide-id') ?? '',
  );

test.describe('Given the two windows (PM-3)', () => {
  test('When a key is pressed in one, Then the other draws the change within 100 ms', async ({
    page,
  }, info) => {
    await openDeck(page);
    // Slides 7 to 12 have no transition, so a change is drawn at once.
    await page.getByRole('option', { name: 'Slide 7', exact: true }).click();
    const audience = await present(page, 'current');
    await expect(settled(audience, 's07')).toHaveCount(1);

    // The moment each key press reaches the presenter view, and the moment the audience window changes,
    // on one clock (both are this computer's, in milliseconds since the epoch).
    await page.evaluate(() => {
      const pressed: number[] = [];
      window.addEventListener(
        'keydown',
        (event) => {
          pressed.push(performance.timeOrigin + event.timeStamp);
        },
        true,
      );
      Object.assign(window, { pressed });
    });
    await audience.evaluate(() => {
      const drawn: number[] = [];
      let last = document.querySelector('.show-stage .cue-slide')?.getAttribute('data-slide-id');
      new MutationObserver(() => {
        const now = document.querySelector('.show-stage .cue-slide')?.getAttribute('data-slide-id');
        if (now !== last) {
          last = now;
          drawn.push(performance.timeOrigin + performance.now());
        }
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-slide-id'],
      });
      Object.assign(window, { drawn });
    });

    // Five slides forward and back again, twice.
    const keys = [...Array<string>(5).fill('ArrowRight'), ...Array<string>(5).fill('ArrowLeft')];
    for (const key of [...keys, ...keys]) {
      const before = await audience.evaluate(() => Reflect.get(window, 'drawn') as unknown);
      const count = Array.isArray(before) ? before.length : 0;
      await page.keyboard.press(key);
      await expect
        .poll(async () => {
          const now = await audience.evaluate(() => Reflect.get(window, 'drawn') as unknown);
          return Array.isArray(now) ? now.length : 0;
        })
        .toBe(count + 1);
    }

    const times = async (window: Page, name: string): Promise<number[]> => {
      const list = await window.evaluate((key) => Reflect.get(globalThis, key) as unknown, name);
      return Array.isArray(list) ? list.map(Number) : [];
    };
    const pressed = await times(page, 'pressed');
    const drawn = await times(audience, 'drawn');
    const latencies = drawn
      .map((at, i) => Math.max(0, at - (pressed[i] ?? at)))
      .sort((a, b) => a - b);
    expect(latencies).toHaveLength(20);
    const median = latencies[Math.floor(latencies.length / 2)] ?? 0;
    const p90 = latencies[Math.floor(latencies.length * 0.9)] ?? 0;
    info.annotations.push({
      type: 'perf',
      description: `[perf] ${info.project.name} sync median ${String(Math.round(median))} ms, p90 ${String(Math.round(p90))} ms, max ${String(Math.round(latencies[latencies.length - 1] ?? 0))} ms`,
    });
    console.log(
      `[perf] ${info.project.name} sync median ${String(Math.round(median))} ms, p90 ${String(Math.round(p90))} ms`,
    );
    // WebKit is measured and reported, as for the frame budgets (the runner draws in software).
    if (info.project.name !== 'webkit') expect(p90).toBeLessThanOrEqual(show.syncLatencyMs);
  });

  test('When the audience window is closed, Then the presenter view keeps working and Reconnect opens it again at the same place', async ({
    page,
  }) => {
    await openDeck(page);
    const audience = await present(page);
    await page.keyboard.press('ArrowRight');
    await audience.close();

    const banner = page.getByRole('status').filter({ hasText: 'The audience window was closed' });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    // The show goes on without it.
    await page.keyboard.press('ArrowRight');
    await expect(settled(page, 's03')).toHaveCount(1);

    const opened = page.waitForEvent('popup');
    await banner.getByRole('button', { name: 'Reconnect' }).click();
    const again = await opened;
    await again.waitForLoadState();

    await expect(settled(again, 's03')).toHaveCount(1);
    await expect(banner).toHaveCount(0);
    // And they are together again.
    // Slide 3 is on its first click: one more press brings its picture in, in the new window too.
    expect(await opacityOf(again, 's03-image')).toBe(0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(again, 's03-image')).toBeGreaterThan(0.5);
  });

  test('When the presenter tab is reloaded, Then it comes back at the same place and the audience window stays', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    const audience = await present(page, 'current');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Click 2 of 3')).toBeVisible();

    await page.reload();

    await expect(page.getByText('Slide 3 of 12')).toBeVisible();
    await expect(page.getByText('Click 2 of 3')).toBeVisible();
    // Past the few seconds a reload is given, the audience window is still there, and still follows.
    await page.waitForTimeout(5500);
    expect(audience.isClosed()).toBe(false);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Click 3 of 3')).toBeVisible();
    await expect.poll(() => slideOf(audience)).toBe('s03');
    await expect
      .poll(() =>
        audience.evaluate(() =>
          Number(
            getComputedStyle(
              document.querySelector('.show-stage [data-element-id="s03-block"]') ?? document.body,
            ).opacity,
          ),
        ),
      )
      .toBe(0);
  });

  test('When the audience window is reloaded, Then it comes back at the same place and still follows', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 5', exact: true }).click();
    const audience = await present(page, 'current');
    await page.keyboard.press('ArrowRight');
    await expect(settled(audience, 's06')).toHaveCount(1);

    await audience.reload();

    await expect(settled(audience, 's06')).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(settled(audience, 's07')).toHaveCount(1);
  });

  test('When the presenter tab is closed, Then the audience window closes', async ({
    page,
    browserName,
  }) => {
    // Playwright's WebKit does not really destroy a closed page (SP-1): real Safari is a manual check.
    test.skip(
      browserName === 'webkit',
      'closing a page does not release its locks in Playwright WebKit',
    );
    await openDeck(page);
    const audience = await present(page);
    await page.keyboard.press('ArrowRight');
    const closed = audience.waitForEvent('close', { timeout: 20_000 });

    await page.close();

    await closed;
  });

  test('When the show is ended from either window, Then both end and nobody is told the other is gone', async ({
    page,
  }) => {
    await openDeck(page);
    const audience = await present(page);
    const closed = audience.waitForEvent('close');

    await page.keyboard.press('Escape');

    await closed;
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible();
    await expect(page.getByText('The audience window was closed')).toHaveCount(0);
  });
});
