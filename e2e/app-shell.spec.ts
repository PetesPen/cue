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
    baseURL,
  }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url());
    });

    await page.goto('/');
    // The font request can start after the load event on a slower host, so wait for it rather than
    // reading the state once.
    const loadedFamilies = () =>
      page.evaluate(() => [
        ...new Set(
          [...document.fonts]
            .filter((face) => face.status === 'loaded')
            .map((f) => f.family.replaceAll('"', '')),
        ),
      ]);
    await expect.poll(loadedFamilies, { timeout: 10_000 }).toEqual(['Instrument Sans']);
    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests)
      expect(new URL(url).hostname).toBe(new URL(baseURL ?? '').hostname);
  });

  // The hostname uses the reserved .invalid domain, which never resolves. If the policy were missing
  // the fetch would still fail, but no violation would be reported, so this tells the two apart.
  test('When a script tries to reach another host, Then the browser blocks it by policy (no external requests)', async ({
    page,
  }) => {
    await page.goto('/');

    const violated = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          document.addEventListener('securitypolicyviolation', (event) => {
            resolve(event.effectiveDirective);
          });
          fetch('https://external-request-check.invalid/').catch(() => undefined);
          setTimeout(() => {
            resolve('no violation reported');
          }, 3000);
        }),
    );

    expect(violated).toBe('connect-src');
  });

  test('When it loads, Then axe finds no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
