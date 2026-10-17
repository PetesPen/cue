import { expect, test, type Page } from '@playwright/test';

// Sprint 9: install and work offline (UX-7). After one visit the app, its fonts and its lazy parts are in
// the service worker's cache, so it opens and works with the network off.

test.use({ viewport: { width: 1440, height: 900 } });

/** Wait until the service worker is active, which is when everything the app needs has been stored. */
async function workerReady(page: Page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('no active worker');
  });
}

test.describe('Given the app visited once (UX-7)', () => {
  test('When the network is switched off and the page is reloaded, Then the library opens, a deck can be made and edited, text can be typed and fonts draw, with no request failing', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    await workerReady(page);
    // A reload under the worker's control, so everything below comes through it.
    await page.reload();
    await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    const failures: string[] = [];
    page.on('requestfailed', (request) => {
      failures.push(`${request.method()} ${request.url()}`);
    });

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    await page.getByRole('button', { name: 'New deck' }).first().click();
    await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add slide' }).click();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toBeVisible();
    // Text needs the editor that is fetched on first use: from the cache too.
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.locator('.slide-frame').click({ position: { x: 200, y: 150 } });
    const editor = page.locator('.text-edit-box .ProseMirror');
    await expect(editor).toBeVisible();
    await page.keyboard.type('Works with no network');
    await page.keyboard.press('Escape');
    await expect(page.locator('.slide-frame').getByText('Works with no network')).toBeVisible();
    expect(await page.evaluate(() => document.fonts.check('16px "Instrument Sans"'))).toBe(true);
    // And the deck is still there after another reload, still offline.
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toBeVisible();

    expect(failures).toEqual([]);
  });

  test('When the show is opened with the network off, Then the audience window and the presenter view load too', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await workerReady(page);
    await page.reload();
    await page.getByRole('button', { name: 'New deck' }).first().click();
    await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();

    const opened = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    const audience = await opened;
    await audience.waitForLoadState();

    await expect(audience.locator('.show-stage .cue-slide')).toBeVisible();
    await expect(page.getByText('Presenting', { exact: true })).toBeVisible();
  });

  test('Then the manifest names the app, and its icons load from the app itself', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(new URL(href ?? '', page.url()).href);
    const manifest: unknown = await response.json();

    expect(manifest).toMatchObject({
      name: 'Cue',
      short_name: 'Cue',
      display: 'standalone',
      start_url: '/',
    });
    const icons: unknown =
      typeof manifest === 'object' && manifest !== null
        ? Reflect.get(manifest, 'icons')
        : undefined;
    expect(Array.isArray(icons) ? icons : []).toHaveLength(3);
    for (const icon of Array.isArray(icons) ? icons : []) {
      const src: unknown =
        typeof icon === 'object' && icon !== null ? Reflect.get(icon, 'src') : undefined;
      const loaded = await request.get(new URL(String(src), page.url()).href);
      expect(loaded.ok()).toBe(true);
      expect(loaded.headers()['content-type']).toContain('image/png');
    }
  });

  test('Then no update is offered when there is none, and the page makes requests only to its own files', async ({
    page,
  }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') hosts.add(url.host);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    await workerReady(page);

    await expect(page.getByText('A new version of Cue is ready.')).toHaveCount(0);
    expect([...hosts]).toEqual([new URL(page.url()).host]);
  });
});
