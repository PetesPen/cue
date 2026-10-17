import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openDeck, present } from './support/show';

// Sprint 8: read and resize the notes (PM-4): the divider, A− and A+, and remembering both.

test.use({ viewport: { width: 1440, height: 900 } });

const height = (page: Page, selector: string) =>
  page.locator(selector).evaluate((node) => node.getBoundingClientRect().height);

test.describe('Given the presenter view on a slide with notes (PM-4)', () => {
  test('When the divider is dragged, Then the notes grow against the slides and the view reflows without scrolling', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await present(page, 'current');
    const handle = page.getByRole('separator', { name: 'Resize notes' });
    const slides = await height(page, '.pv-top');
    const notes = await height(page, '.pv-notes');
    const frame = await height(page, '.pv-now-frame');
    const box = await handle.boundingBox();
    if (!box) throw new Error('no divider');

    // Up by 140 pixels: the notes take the room.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 140, { steps: 12 });
    await page.mouse.up();

    expect(await height(page, '.pv-top')).toBeLessThan(slides - 100);
    expect(await height(page, '.pv-notes')).toBeGreaterThan(notes + 100);
    expect(await height(page, '.pv-now-frame')).toBeLessThan(frame);
    // The window did not start to scroll, and the slide strip is still where the window ends.
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
    // Dragging made no move in the show.
    await expect(page.getByText('Slide 3 of 12')).toBeVisible();
  });

  test('When the divider and the text size are changed and the show ends, Then the next show has them as they were left', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    const audience = await present(page, 'current');
    const handle = page.getByRole('separator', { name: 'Resize notes' });
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.getByRole('button', { name: 'Larger text' }).click();
    await page.getByRole('button', { name: 'Larger text' }).click();
    await expect(handle).toHaveAttribute('aria-valuenow', '42');
    await expect(page.getByText('26 px')).toBeVisible();
    const closed = audience.waitForEvent('close');
    await page.keyboard.press('Escape');
    await closed;
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible();

    await present(page, 'current');

    await expect(page.getByRole('separator', { name: 'Resize notes' })).toHaveAttribute(
      'aria-valuenow',
      '42',
    );
    await expect(page.getByText('26 px')).toBeVisible();
    expect(
      await page
        .locator('.pv-notes-text')
        .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    ).toBe(26);
  });

  test('Then the notes panel with its divider and text size has no accessibility violations', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    const audience = await present(page, 'current');
    await expect(audience.locator('.audience-hint')).toHaveCount(0, { timeout: 15_000 });

    const results = await new AxeBuilder({ page }).exclude('.show-stage').analyze();

    expect(results.violations).toEqual([]);
  });
});
