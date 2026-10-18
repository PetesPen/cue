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

test.describe('Given an element on a slide, When it is made to appear and disappear (AN-1, AN-2, TR-3)', () => {
  test('Then the steps are listed, saved with the deck, and Preview plays them click by click', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await animate(page);

    await page.getByRole('button', { name: '+ Appear', exact: true }).click();
    await page.getByRole('button', { name: '+ Disappear', exact: true }).click();
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

test.describe('Given the fixture deck Autumn Launch, When its hero slide is shown in Preview (AN-6)', () => {
  test('Then the picture and the rows come in on the first click, the circle moves on the second and the block leaves on the third', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await animate(page);
    await expect(page.getByText('6 steps · 3 clicks')).toBeVisible();
    await expect(page.locator('.rail-dot')).toHaveCount(1);

    await page.getByRole('button', { name: 'Preview' }).click();
    await expect.poll(() => opacityOf(page, 's03-row-0')).toBe(0);
    await expect.poll(() => opacityOf(page, 's03-image')).toBe(0);
    expect(await opacityOf(page, 's03-block')).toBe(1);

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(page, 's03-row-2')).toBe(1);
    // The picture was set to 60%: it appears at 60%, not at full strength (TR-3).
    await expect.poll(() => opacityOf(page, 's03-image')).toBeCloseTo(0.6, 2);
    // The circle moves to the end of its Move (1010, 400) and stays.
    const circle = page.locator('.slide-frame [data-element-id="s03-circle"]');
    const startedAt = await circle.boundingBox();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => ((await circle.boundingBox())?.x ?? 0) - (startedAt?.x ?? 0))
      .toBeGreaterThan(50);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(page, 's03-block')).toBe(0);
    await expect
      .poll(async () => ((await circle.boundingBox())?.x ?? 0) - (startedAt?.x ?? 0))
      .toBeGreaterThan(50);
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

test.describe('Given an element on a slide, When it is made to move (AN-3)', () => {
  test('Then the ghost of its end is dragged into place, Preview moves the element there, and it is saved', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await animate(page);
    await page.getByRole('button', { name: '+ Move', exact: true }).click();
    const ghost = page.locator('.move-ghost');
    await expect(ghost).toBeVisible();
    await expect(page.getByText('Ends here · drag')).toBeVisible();

    const box = await ghost.boundingBox();
    if (!box) throw new Error('no ghost');
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 250, from.y + 120, { steps: 10 });
    await page.mouse.up();

    const moved = await ghost.boundingBox();
    expect((moved?.x ?? 0) - box.x).toBeCloseTo(250, -1);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await animate(page);
    await page.locator('.step-row').first().click();
    const afterReload = await page.locator('.move-ghost').boundingBox();
    expect(afterReload?.x).toBeCloseTo(moved?.x ?? 0, -1);

    const element = page.locator('.canvas .slide-frame [data-kind="shape"]').first();
    const own = await element.boundingBox();
    await page.getByRole('button', { name: 'Preview' }).click();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await element.boundingBox())?.x ?? 0)
      .toBeCloseTo(moved?.x ?? 0, -1);
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => (await element.boundingBox())?.x ?? 0)
      .toBeCloseTo(own?.x ?? 0, 0);
  });
});

test.describe('Given the steps of the hero slide, When they are put in a new order (AN-5)', () => {
  test('Then a step dragged with the mouse lands where the line showed, and the order is saved', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await animate(page);
    const ids = () =>
      page
        .locator('.step-row')
        .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-step-id')));
    expect(await ids()).toEqual([
      's03-step-1',
      's03-step-2',
      's03-step-3',
      's03-step-4',
      's03-step-5',
      's03-step-6',
    ]);

    // The last step (the block leaves) is dragged above the one before it (the circle moves).
    const last = await page.locator('.step-row').nth(5).boundingBox();
    const before = await page.locator('.step-row').nth(4).boundingBox();
    if (!last || !before) throw new Error('no rows');
    await page.mouse.move(last.x + 60, last.y + last.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + 60, before.y + 4, { steps: 8 });
    await expect(page.locator('.step-drop-line')).toBeVisible();
    await page.mouse.up();

    await expect
      .poll(ids)
      .toEqual([
        's03-step-1',
        's03-step-2',
        's03-step-3',
        's03-step-4',
        's03-step-6',
        's03-step-5',
      ]);
    await expect(page.getByText('6 steps · 3 clicks')).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await animate(page);
    await expect.poll(async () => (await ids()).slice(4)).toEqual(['s03-step-6', 's03-step-5']);
  });

  test('Then Alt and the arrow keys move the focused step, and Undo puts it back', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await animate(page);
    const ids = () =>
      page
        .locator('.step-row')
        .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-step-id')));

    await page.locator('.step-row').nth(4).focus();
    await page.keyboard.press('Alt+ArrowDown');

    await expect
      .poll(ids)
      .toEqual([
        's03-step-1',
        's03-step-2',
        's03-step-3',
        's03-step-4',
        's03-step-6',
        's03-step-5',
      ]);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await ids()).slice(4)).toEqual(['s03-step-5', 's03-step-6']);
  });
});
