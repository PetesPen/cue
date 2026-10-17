import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { seedDeck } from './support/seed';
import { openNewDeck } from './support/slide';

// Sprint 6: choose how a slide arrives (TN-1). Sprint 7: Preview transition (TN-4).

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

// Sprint 7: Preview transition (TN-4) on the fixture deck, where slide 3 arrives with Slide.

test.describe('Given Autumn Launch, When Preview transition is pressed on slide 3 (TN-4)', () => {
  test('Then slide 2 gives way to slide 3 coming in, and the canvas ends on slide 3 with nothing saved', async ({
    page,
  }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    const railId = (n: number) =>
      page
        .getByRole('option', { name: `Slide ${String(n)}`, exact: true })
        .locator('.cue-slide')
        .evaluate((node) => (node instanceof HTMLElement ? node.dataset.slideId : undefined));
    const [two, three] = [await railId(2), await railId(3)];
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();
    await expect(effect(page, 'Slide')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('toolbar', { name: 'Transition preview' })).toContainText(
      'Slide 2',
    );

    // The transition is over in under a second: record the slides on the canvas as they change.
    await page.evaluate(() => {
      const seen: (string | undefined)[][] = [];
      const canvas = document.querySelector('.canvas');
      const note = () => {
        seen.push(
          [...document.querySelectorAll('.canvas .cue-layer .cue-slide')].map((node) =>
            node instanceof HTMLElement ? node.dataset.slideId : undefined,
          ),
        );
      };
      if (canvas) new MutationObserver(note).observe(canvas, { childList: true, subtree: true });
      Object.assign(window, { seenOnCanvas: seen });
    });
    await page.getByRole('button', { name: 'Preview transition' }).click();

    const layers = page.locator('.canvas .cue-layer');
    await expect(layers).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Preview transition' })).toBeEnabled();
    const seen = await page.evaluate(() => Reflect.get(window, 'seenOnCanvas') as unknown);
    expect(seen).toContainEqual([two, three]);
    await expect(layers.locator('.cue-slide')).toHaveAttribute('data-slide-id', three ?? '');
    // Playing it is not an edit.
    await expect(page.getByRole('button', { name: /^Undo/ })).toBeDisabled();
  });

  test('Then the bar has no accessibility violations', async ({ page }) => {
    await seedDeck(page, autumnLaunch(), 'autumn-launch');
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();

    const results = await new AxeBuilder({ page }).exclude('.canvas .cue-slide').analyze();

    expect(results.violations).toEqual([]);
  });
});

// Sprint 8: direction and duration (TN-2), apply to all slides (TN-3).

test.describe('Given a deck of three slides (TN-2, TN-3)', () => {
  test('When a direction and a duration are chosen and applied to all slides, Then every slide but the first has them, one undo takes them back, and they are saved', async ({
    page,
  }) => {
    await openNewDeck(page);
    await page.getByRole('button', { name: 'New slide' }).click();
    await page.getByRole('button', { name: 'New slide' }).click();
    await page.getByRole('option', { name: 'Slide 2', exact: true }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();
    await effect(page, 'Push').click();
    await page
      .getByRole('group', { name: 'Direction' })
      .getByRole('button', { name: 'From the bottom' })
      .click();
    await expect(page.getByText('New slide comes in from the bottom.')).toBeVisible();
    const duration = page.getByRole('slider', { name: 'Duration' });
    await duration.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await expect(page.getByText('3.0 s').first()).toBeVisible();

    await page.getByRole('button', { name: 'Apply to all slides' }).click();

    await expect(page.locator('.rail-transition')).toHaveCount(2);
    // One undo takes it back from every slide at once, and redo puts it back.
    await page.keyboard.press('Control+z');
    await expect(page.locator('.rail-transition')).toHaveCount(1);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.rail-transition')).toHaveCount(2);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await expect(effect(page, 'Push')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('New slide comes in from the bottom.')).toBeVisible();
    await expect(page.getByText('3.0 s').first()).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();
    await expect(effect(page, 'Push')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('New slide comes in from the bottom.')).toBeVisible();
  });

  test('Then the Transition tab with Direction and Duration has no accessibility violations', async ({
    page,
  }) => {
    await openNewDeck(page);
    await page.getByRole('button', { name: 'New slide' }).click();
    await page.getByRole('tab', { name: 'Transition' }).click();
    await effect(page, 'Slide').click();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
