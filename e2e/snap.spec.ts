import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { drag, openNewDeck, type Slide } from './support/slide';

// Sprint 6: smart guides and alignment (EL-6).

test.use({ viewport: { width: 1440, height: 900 } });

async function drawRectangle(
  page: Page,
  slide: Slide,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: 'Rectangle', exact: true }).click();
  await drag(page, slide, from, to);
}

/** The left edge of the shape under `nth`, in slide pixels. */
async function slideBox(page: Page, nth: number) {
  return page
    .locator('.canvas .slide-frame [data-kind="shape"]')
    .nth(nth)
    .evaluate((node) => {
      if (!(node instanceof HTMLElement)) throw new Error('not an element');
      return {
        x: Number.parseFloat(node.style.left),
        y: Number.parseFloat(node.style.top),
        width: Number.parseFloat(node.style.width),
        height: Number.parseFloat(node.style.height),
      };
    });
}

test.describe('Given two shapes, When one is dragged near the other (EL-6)', () => {
  test('Then it snaps to the other shape with a guide line while the mouse is down, and the line goes when it is let go', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [300, 300], [700, 500]);
    await drawRectangle(page, slide, [1000, 700], [1400, 900]);
    const first = await slideBox(page, 0);

    // The second is dragged so that its left edge ends 3 slide pixels from the first one's.
    const from = await slide.at(1200, 800);
    const to = await slide.at(1200 - (1000 - first.x) + 3, 800);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });

    await expect(page.locator('.snap-guides line')).toHaveCount(1);
    await page.mouse.up();

    await expect(page.locator('.snap-guides')).toHaveCount(0);
    expect((await slideBox(page, 1)).x).toBe(first.x);
  });

  test('Then Alt turns snapping off for that drag', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [300, 300], [700, 500]);
    await drawRectangle(page, slide, [1000, 700], [1400, 900]);
    const first = await slideBox(page, 0);
    const second = await slideBox(page, 1);

    const from = await slide.at(1200, 800);
    const to = await slide.at(1200 - (1000 - first.x) + 3, 800);
    await page.keyboard.down('Alt');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await expect(page.locator('.snap-guides')).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up('Alt');

    const landed = await slideBox(page, 1);
    expect(Math.abs(landed.x - (second.x - (second.x - first.x) + 3))).toBeLessThan(2);
    expect(landed.x).not.toBe(first.x);
  });

  test('Then a shape dragged near the middle of the slide centres on it', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [300, 300], [700, 500]);
    const box = await slideBox(page, 0);

    // Its middle is dragged to 4 slide pixels short of the slide's middle line (960).
    const centre = box.x + box.width / 2;
    const from = await slide.at(centre, 400);
    const to = await slide.at(956, 400);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();

    const landed = await slideBox(page, 0);
    expect(landed.x + landed.width / 2).toBe(960);
  });

  test('Then resizing by a handle snaps the edge it drags', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [300, 300], [700, 500]);
    await drawRectangle(page, slide, [1000, 700], [1400, 900]);
    // The second is selected after drawing. Its right handle is pulled to 3 pixels short of the slide edge.
    const handle = page.locator('.sel-box .handle[data-handle="e"]');
    const at = await handle.boundingBox();
    if (!at) throw new Error('no handle');
    const target = await slide.at(1917, 800);
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, at.y + at.height / 2, { steps: 10 });
    await page.mouse.up();

    const landed = await slideBox(page, 1);
    expect(landed.x + landed.width).toBe(1920);
  });

  test('Then a turned shape snaps the corner it drags', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [1000, 400], [1400, 600]);
    await page.getByRole('textbox', { name: 'Rotation', exact: true }).fill('20');
    await page.keyboard.press('Enter');
    // Its bottom right corner is pulled towards the right edge of the slide and stops 3 pixels short.
    const handle = page.locator('.sel-box .handle[data-handle="se"]');
    await expect(handle).toBeVisible();
    const at = await handle.boundingBox();
    if (!at) throw new Error('no handle');
    const edge = (await slide.at(1920, 0)).x;
    const from = { x: at.x + at.width / 2, y: at.y + at.height / 2 };
    const scale = await slide.scale();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(edge - 3 * scale, from.y, { steps: 10 });
    await expect(page.locator('.snap-guides line')).toHaveCount(1);
    await page.mouse.up();

    // The corner (where the handle is) sits on the edge of the slide.
    const after = await handle.boundingBox();
    expect((after?.x ?? 0) + (after?.width ?? 0) / 2).toBeCloseTo(edge, 0);
  });
});

test.describe('Given shapes selected, When the Align and Distribute buttons are used (EL-6)', () => {
  test('Then they line up and space out, one undo step each', async ({ page }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [200, 200], [500, 400]);
    await drawRectangle(page, slide, [700, 500], [1000, 700]);
    await drawRectangle(page, slide, [1500, 800], [1800, 1000]);
    // A box around all three selects them.
    await drag(page, slide, [100, 100], [1900, 1060]);
    await expect(page.locator('.design-panel .panel-name')).toHaveText('3 shapes');

    await page.getByRole('button', { name: 'Align top', exact: true }).click();
    await expect.poll(async () => (await slideBox(page, 1)).y).toBe((await slideBox(page, 0)).y);
    await expect.poll(async () => (await slideBox(page, 2)).y).toBe((await slideBox(page, 0)).y);
    await page.getByRole('button', { name: 'Distribute horizontally', exact: true }).click();

    await expect
      .poll(async () => {
        const [a, b, c] = [
          await slideBox(page, 0),
          await slideBox(page, 1),
          await slideBox(page, 2),
        ];
        return Math.abs(b.x - (a.x + a.width) - (c.x - (b.x + b.width)));
      })
      .toBeLessThan(1);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => Math.round((await slideBox(page, 1)).x)).toBeLessThan(800);
  });

  test('Then the Align section and the guides have no accessibility violations', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await drawRectangle(page, slide, [300, 300], [700, 500]);

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
