import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** The library, then a new deck in the editor: the layout under test is the editor's. */
async function openNewDeck(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New deck' }).first().click();
  await expect(page.getByRole('option', { name: 'Slide 1' })).toBeVisible();
}

// The Studio layout sizes from design/tokens.json, measured at the design's 1440 x 900 frame.
test.describe('Given the app at the design size of 1440 by 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('When a deck opens, Then the top bar is 52 px, the rail 208 px, the inspector 296 px and the notes strip 124 px', async ({
    page,
  }) => {
    await openNewDeck(page);

    const topBar = await page.getByRole('banner').boundingBox();
    const rail = await page.getByRole('complementary', { name: 'Slide panel' }).boundingBox();
    const inspector = await page.getByRole('complementary', { name: 'Inspector' }).boundingBox();
    const notes = await page.getByRole('region', { name: 'Speaker notes' }).boundingBox();
    const canvas = await page.getByRole('main').boundingBox();

    expect(topBar).toMatchObject({ x: 0, y: 0, width: 1440, height: 52 });
    expect(rail).toMatchObject({ x: 0, y: 52, width: 208, height: 848 });
    expect(inspector).toMatchObject({ x: 1440 - 296, y: 52, width: 296, height: 848 });
    expect(notes).toMatchObject({ x: 208, y: 900 - 124, width: 1440 - 208 - 296, height: 124 });
    expect(canvas).toMatchObject({ x: 208, y: 52, width: 1440 - 208 - 296 });
  });

  test('When a deck opens, Then the blank slide is 16:9 and sits inside the canvas', async ({
    page,
  }) => {
    await openNewDeck(page);

    const canvas = await page.getByRole('main').boundingBox();
    const slide = await page.locator('.slide-frame').boundingBox();

    expect(canvas).not.toBeNull();
    expect(slide).not.toBeNull();
    if (!canvas || !slide) return;
    expect(slide.width / slide.height).toBeCloseTo(16 / 9, 2);
    expect(slide.x).toBeGreaterThanOrEqual(canvas.x);
    expect(slide.x + slide.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(slide.y).toBeGreaterThanOrEqual(canvas.y);
    expect(slide.y + slide.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  });

  test('When the window is made smaller, Then the slide still fits inside the canvas', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 640 });
    await openNewDeck(page);

    const canvas = await page.getByRole('main').boundingBox();
    const slide = await page.locator('.slide-frame').boundingBox();

    if (!canvas || !slide) throw new Error('Canvas or slide has no box');
    expect(slide.width / slide.height).toBeCloseTo(16 / 9, 2);
    expect(slide.x + slide.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(slide.y + slide.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  });

  test('When the Animate tab is chosen with the keyboard, Then its panel shows and axe still finds no violations', async ({
    page,
  }) => {
    await openNewDeck(page);

    await page.getByRole('tab', { name: 'Design' }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByRole('tab', { name: 'Animate' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tabpanel', { name: 'Animate' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
