import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openNewDeck } from './support/slide';

// Sprint 6: choose how a slide arrives (TN-1). Playing it comes with the show (sprint 7).

test.use({ viewport: { width: 1440, height: 900 } });

const effect = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Effect' }).getByRole('button', { name, exact: true });

test.describe('Given a deck of two slides, When a transition is chosen (TN-1)', () => {
  test('Then the choice is saved, the thumbnail shows a small arrow, and the first slide has nothing to choose', async ({
    page,
  }) => {
    await openNewDeck(page);
    await page.getByRole('button', { name: 'New slide' }).click();
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('tab', { name: 'Transition' }).click();
    await expect(page.getByText('Slide 2 transition')).toBeVisible();
    await expect(effect(page, 'None')).toHaveAttribute('aria-pressed', 'true');
    await effect(page, 'Slide').click();

    await expect(effect(page, 'Slide')).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('option', { name: 'Slide 2', exact: true }).locator('.rail-transition'),
    ).toHaveCount(1);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole('option', { name: 'Slide 2', exact: true }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();
    await expect(effect(page, 'Slide')).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('option', { name: 'Slide 1', exact: true }).click();
    await expect(page.getByText(/no incoming transition/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Effect' })).toHaveCount(0);
  });

  test('Then the Transition tab has no accessibility violations', async ({ page }) => {
    await openNewDeck(page);
    await page.getByRole('button', { name: 'New slide' }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();
    await effect(page, 'Fade').click();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
