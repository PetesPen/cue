import { expect, test } from '@playwright/test';
import { fiftySlideDeck } from '../tests/fixtures/heavyDeck';
import { seedDeck } from './support/seed';

// UX-3 (sprint 5): a deck of 50 slides, one of them with 50 elements, opens and stays usable. The
// frame and time budgets are measured by the nightly performance suite (`npm run perf`, perf/); this
// is the quick check on every pull request that the big deck works at all, on all three engines.

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Given a deck of 50 slides (UX-3)', () => {
  test('When it is opened, Then every slide has its place in the rail and the ones scrolled to are drawn', async ({
    page,
  }) => {
    await seedDeck(page, fiftySlideDeck(), 'fifty-slides');
    await expect(page.getByRole('option')).toHaveCount(50);
    await expect(page.locator('.canvas [data-element-id^="heavy-shape-"]')).toHaveCount(20);

    await page.getByRole('option', { name: 'Slide 50', exact: true }).scrollIntoViewIfNeeded();

    await expect(
      page.getByRole('option', { name: 'Slide 50', exact: true }).locator('.cue-slide'),
    ).toHaveCount(1);
  });

  test('When one of the 50 elements on the first slide is dragged, Then it moves and the deck is saved', async ({
    page,
  }) => {
    await seedDeck(page, fiftySlideDeck(), 'fifty-slides');
    const frame = page.locator('.canvas .slide-frame');
    const box = await frame.boundingBox();
    if (!box) throw new Error('no slide');
    const at = (x: number, y: number) => ({
      x: box.x + (x / 1920) * box.width,
      y: box.y + (y / 1080) * box.height,
    });
    const from = at(95, 95);
    const to = at(700, 600);
    const shape = page.locator('.canvas [data-element-id="heavy-shape-0"]');
    const before = await shape.boundingBox();

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();

    await expect
      .poll(async () => (await shape.boundingBox())?.x ?? 0)
      .toBeGreaterThan((before?.x ?? 0) + 100);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  });
});
