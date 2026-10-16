import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { seedDeck } from './support/seed';
import { drag, openNewDeck } from './support/slide';

// Sprint 5: Appear and Disappear (AN-1, AN-2), the timing controls (AN-4) and a first Preview.

test.use({ viewport: { width: 1440, height: 900 } });

const opacityOf = (page: Page, id: string) =>
  page
    .locator(`.slide-frame [data-element-id="${id}"]`)
    .evaluate((node) => Number(getComputedStyle(node).opacity));
const animate = (page: Page) => page.getByRole('tab', { name: 'Animate' }).click();

async function drawRectangle(page: Page, slideAt: Awaited<ReturnType<typeof openNewDeck>>) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: 'Rectangle', exact: true }).click();
  await drag(page, slideAt, [300, 300], [800, 600]);
}

test.describe('Given an element on a slide, When it is made to appear and disappear (AN-1, AN-2)', () => {
  test('Then the steps are listed, saved with the deck, and Preview plays them click by click', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await animate(page);

    await page.getByRole('button', { name: 'Appear', exact: true }).click();
    await page.getByRole('button', { name: 'Then Disappear' }).click();
    await expect(page.getByText('2 steps · 2 clicks')).toBeVisible();
    await expect(page.locator('.step-badge')).toHaveText(['1', '2']);
    await page
      .getByRole('group', { name: 'Style' })
      .getByRole('button', { name: 'Instant' })
      .click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await animate(page);
    await expect(page.getByText('2 steps · 2 clicks')).toBeVisible();

    await page.getByRole('button', { name: 'Preview' }).click();
    const id = await page
      .locator('.slide-frame [data-kind="shape"]')
      .first()
      .getAttribute('data-element-id');
    if (!id) throw new Error('no shape');
    await expect.poll(() => opacityOf(page, id)).toBe(0);
    await page.keyboard.press('Space');
    await expect.poll(() => opacityOf(page, id)).toBe(1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(page, id)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible();
    await expect.poll(() => opacityOf(page, id)).toBeCloseTo(0.45, 2);
  });
});

test.describe('Given the fixture deck Autumn Launch, When its hero slide is shown in Preview', () => {
  test('Then the picture and the rows come in on the first click, and the block leaves on the second', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await animate(page);
    await expect(page.getByText('5 steps · 2 clicks')).toBeVisible();
    await expect(page.locator('.rail-dot')).toHaveCount(1);

    await page.getByRole('button', { name: 'Preview' }).click();
    await expect.poll(() => opacityOf(page, 's03-row-0')).toBe(0);
    await expect.poll(() => opacityOf(page, 's03-image')).toBe(0);
    expect(await opacityOf(page, 's03-block')).toBe(1);

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(page, 's03-row-2')).toBe(1);
    // The picture was set to 60%: it appears at 60%, not at full strength (TR-3).
    await expect.poll(() => opacityOf(page, 's03-image')).toBeCloseTo(0.6, 2);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(page, 's03-block')).toBe(0);
  });

  test('Then the Animate tab, the badges and the Preview bar have no accessibility violations', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await animate(page);
    await page.locator('.step-row').first().click();
    await expect(page.locator('[data-fonts="loading"]')).toHaveCount(0);
    // The slide's own words are the author's to colour, and elements that start hidden are drawn
    // faded in the editor (AN-1): neither is the app's text.
    const app = () => new AxeBuilder({ page }).exclude('.canvas .cue-slide');

    expect((await app().analyze()).violations).toEqual([]);

    await page.getByRole('button', { name: 'Preview' }).click();
    expect((await app().analyze()).violations).toEqual([]);
  });
});
