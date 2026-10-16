import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openNewDeck } from './support/slide';

// Sprint 5: slide background (SL-5), the solid colour and "Apply to all slides".

test.use({ viewport: { width: 1440, height: 900 } });

const surface = (page: Page) => page.locator('.canvas .cue-slide');
const colourOf = (page: Page, thumbnail?: number) =>
  (thumbnail === undefined ? surface(page) : page.locator('.rail-item .cue-slide').nth(thumbnail))
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);

async function setBackground(page: Page, hex: string) {
  await page.getByRole('textbox', { name: 'Background as hex' }).fill(hex);
  await page.keyboard.press('Enter');
}

test.describe('Given a slide with nothing selected, When its background is chosen (SL-5)', () => {
  test('Then the slide shows it and it survives a reload', async ({ page }) => {
    await openNewDeck(page);

    await setBackground(page, '14281B');
    await expect.poll(() => colourOf(page)).toBe('rgb(20, 40, 27)');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();

    await expect.poll(() => colourOf(page)).toBe('rgb(20, 40, 27)');
  });

  test('Then Undo takes it back, and Redo puts it again', async ({ page }) => {
    await openNewDeck(page);
    await setBackground(page, '14281B');
    await expect.poll(() => colourOf(page)).toBe('rgb(20, 40, 27)');

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => colourOf(page)).toBe('rgb(255, 255, 255)');
    await page.getByRole('button', { name: 'Redo' }).click();

    await expect.poll(() => colourOf(page)).toBe('rgb(20, 40, 27)');
  });

  test('Then "Apply to all slides" gives every slide the colour', async ({ page }) => {
    await openNewDeck(page);
    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await setBackground(page, 'F5C542');
    await expect.poll(() => colourOf(page, 1)).toBe('rgb(245, 197, 66)');
    expect(await colourOf(page, 0)).toBe('rgb(255, 255, 255)');

    await page.getByRole('button', { name: 'Apply to all slides' }).click();

    await expect.poll(() => colourOf(page, 0)).toBe('rgb(245, 197, 66)');
    expect(await colourOf(page, 1)).toBe('rgb(245, 197, 66)');
  });

  test('Then the Slide section has no accessibility violations', async ({ page }) => {
    await openNewDeck(page);
    await setBackground(page, '14281B');
    await expect.poll(() => colourOf(page)).toBe('rgb(20, 40, 27)');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
