import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Given a first visit to the app', () => {
  test('When it loads, Then it is titled Cue, shows the heading and logs no console errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');

    await expect(page).toHaveTitle('Cue');
    await expect(page.getByRole('heading', { name: 'Cue', level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('When it loads, Then only the Instrument Sans UI font is fetched, from the app itself', async ({
    page,
  }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url());
    });

    await page.goto('/');
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((face) => face.status === 'loaded').map((f) => f.family);
    });

    expect(new Set(loaded.map((family) => family.replaceAll('"', '')))).toEqual(
      new Set(['Instrument Sans']),
    );
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) expect(new URL(url).hostname).toBe('127.0.0.1');
  });

  test('When it loads, Then axe finds no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
