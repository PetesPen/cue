import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { seedDeck } from './support/seed';

// Sprint 9: a phone-sized screen is told, kindly, that Cue is for larger screens (UX-5).

const card = { name: 'Cue is built for larger screens' } as const;

test.describe('Given a phone-sized screen (UX-5)', () => {
  test('When Cue is opened, Then the card is shown instead of the editor, and it has no accessibility violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');

    await expect(page.getByRole('heading', card)).toBeVisible();
    await expect(page.getByText(/Exported web page decks play on any device/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'New deck' })).toHaveCount(0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('When a deck address is opened, Then the deck is not opened or changed behind the card', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/#/deck/autumn-launch');

    await expect(page.getByRole('heading', card)).toBeVisible();
    await expect(page.locator('.rail-item')).toHaveCount(0);
  });

  test('When the window is made wide, Then the library opens by itself, and narrow again brings the card back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', card)).toBeVisible();

    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    await page.setViewportSize({ width: 600, height: 800 });

    await expect(page.getByRole('heading', card)).toBeVisible();
  });

  test('When a show window is small, Then it still runs: the audience window may be any size', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.setViewportSize({ width: 390, height: 600 });

    await page.goto('/#/show/autumn-launch/audience');

    await expect(page.locator('.show-stage .cue-slide')).toBeVisible();
    await expect(page.getByRole('heading', card)).toHaveCount(0);
  });
});
