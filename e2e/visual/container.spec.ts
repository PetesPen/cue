import { expect, test } from '@playwright/test';

// Proves the visual job really runs in the pinned container. Screenshot tests arrive in sprint 1,
// together with their baselines; until then this keeps the job meaningful and green.
test.describe('Given the visual regression job', () => {
  test('When it runs, Then it is inside the pinned Linux container with Chromium', async ({
    page,
    browserName,
  }) => {
    expect(process.env.CUE_VISUAL_CONTAINER).toBe('1');
    expect(process.platform).toBe('linux');
    expect(browserName).toBe('chromium');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Cue', level: 1 })).toBeVisible();
    // The bundled font must be what draws the UI, not a system font that differs between machines.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.fonts]
              .filter((f) => f.status === 'loaded')
              .map((f) => f.family.replaceAll('"', '')),
          ),
        { timeout: 10_000 },
      )
      .toContain('Instrument Sans');
  });
});
