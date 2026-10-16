import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { savedFill } from './support/db';
import { drag, openNewDeck, type Slide } from './support/slide';

// Sprint 3: the colour picker (EL-10). A colour dragged across the area shows live and is saved once,
// when the pointer is let go (decision 18).

test.use({ viewport: { width: 1440, height: 900 } });

async function drawRectangle(page: Page, slide: Slide) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: 'Rectangle', exact: true }).click();
  await drag(page, slide, [300, 300], [900, 700]);
}

const rectFill = (page: Page) =>
  page.locator('.slide-frame [data-shape="rectangle"] rect').getAttribute('fill');

test.describe('Given a shape, When a colour is picked by eye (EL-10)', () => {
  test('Then dragging across the area shows the colour live, and it is saved once, on release', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    const before = await rectFill(page);
    await page.getByRole('button', { name: 'Choose fill' }).click();
    const area = page.locator('.cp-area');
    const box = await area.boundingBox();
    if (!box) throw new Error('the colour area is not drawn');

    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.3, { steps: 6 });

    // Mid-drag: the shape on the slide has the colour, and nothing has been saved yet.
    const live = await rectFill(page);
    expect(live).not.toBe(before);
    expect(await savedFill(page)).toBe(before);

    await page.mouse.up();

    await expect.poll(() => savedFill(page)).toBe(live);
    await expect(page.getByRole('textbox', { name: 'Fill as hex' })).toHaveValue(
      (live ?? '').replace('#', ''),
    );
  });

  test('Then the colour the deck now uses is offered first the next time', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await page.getByRole('button', { name: 'Choose fill' }).click();
    await page.getByRole('textbox', { name: 'Fill hex code' }).fill('e4572e');
    await page.keyboard.press('Enter');
    await expect.poll(() => savedFill(page)).toBe('#E4572E');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Choose border colour' }).click();

    await expect(
      page
        .getByRole('dialog', { name: 'Border colour picker' })
        .getByRole('button', { name: '#E4572E' }),
    ).toBeVisible();
  });

  test('Then the picker has no accessibility violations', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide);
    await page.getByRole('button', { name: 'Choose fill' }).click();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
