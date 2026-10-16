import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { autumnLaunch } from '../tests/fixtures/autumnLaunch';
import { seedDeck } from './support/seed';

// Sprint 7: present in two windows (PM-1, PM-2) with the keys of the show (PM-6's first part).

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = 'autumn-launch';

/** The slides a window is drawing: two while a transition plays. */
const shown = (page: Page): Locator => page.locator('.show-stage .cue-layer .cue-slide');
/** A window that shows slide `id` and nothing else: it has arrived, no transition is playing. */
const settled = (page: Page, id: string): Locator =>
  page.locator(
    `.show-stage .cue-stage:not(:has(.cue-layer + .cue-layer)) .cue-slide[data-slide-id="${id}"]`,
  );
const opacityOf = (page: Page, element: string) =>
  page
    .locator(`.show-stage [data-element-id="${element}"]`)
    .evaluate((node) => Number(getComputedStyle(node).opacity));

async function openDeck(page: Page) {
  await seedDeck(page, autumnLaunch(), DECK);
}

/** Press Present from the beginning and take the audience window it opens. */
async function present(page: Page, from: 'start' | 'current' = 'start'): Promise<Page> {
  const opened = page.waitForEvent('popup');
  if (from === 'start') {
    await page.getByRole('button', { name: 'Present', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Ways to present' }).click();
    await page.getByRole('menuitem', { name: 'Present from this slide' }).click();
  }
  const audience = await opened;
  await audience.waitForLoadState();
  await expect(shown(audience)).toHaveCount(1);
  await expect(shown(page)).toHaveCount(1);
  return audience;
}

test.describe('Given Autumn Launch, When Present is pressed (PM-1, PM-2)', () => {
  test('Then an audience window opens with only the slide, and this tab is the presenter view', async ({
    page,
  }) => {
    await openDeck(page);

    const audience = await present(page);

    // The presenter view: the slide, what comes next, the notes, every slide, the time.
    await expect(page.getByRole('heading', { name: 'Autumn Launch', level: 1 })).toBeVisible();
    await expect(page.getByText('Presenting', { exact: true })).toBeVisible();
    await expect(page.getByText('Slide 1 of 12')).toBeVisible();
    await expect(settled(page, 's01')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Next · Slide 2' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'All slides' }).getByRole('button')).toHaveCount(
      12,
    );
    await expect(page.getByRole('region', { name: 'Speaker notes' })).toBeVisible();
    await expect(page.getByLabel('Time of day')).toBeVisible();
    // The audience window: the slide and nothing to click, with no cursor.
    await expect(settled(audience, 's01')).toHaveCount(1);
    await expect(audience.getByRole('button')).toHaveCount(0);
    expect(await audience.locator('.audience').evaluate((n) => getComputedStyle(n).cursor)).toBe(
      'none',
    );
  });

  test('Then the audience window shows the whole slide, never cropped, with bars around it', async ({
    page,
  }) => {
    await openDeck(page);
    const audience = await present(page);

    for (const size of [
      { width: 1280, height: 720 },
      { width: 900, height: 900 },
      { width: 1600, height: 500 },
    ]) {
      await audience.setViewportSize(size);
      const box = await audience.locator('.audience-frame').boundingBox();
      if (!box) throw new Error('no frame');
      expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
      expect(box.width).toBeLessThanOrEqual(size.width + 0.5);
      expect(box.height).toBeLessThanOrEqual(size.height + 0.5);
      // It fills the window in one direction.
      expect(Math.abs(box.width - size.width) < 1 || Math.abs(box.height - size.height) < 1).toBe(
        true,
      );
    }
  });

  test('Then Right and Left move both windows, the hero slide plays its three clicks, and B blanks the audience', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    const audience = await present(page, 'current');
    await expect(settled(audience, 's03')).toHaveCount(1);
    await expect(page.getByText('Slide 3 of 12')).toBeVisible();

    // Click 0: the picture, the rows and the circle's journey are still to come.
    expect(await opacityOf(audience, 's03-image')).toBe(0);
    expect(await opacityOf(page, 's03-image')).toBe(0);

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => opacityOf(audience, 's03-image')).toBeGreaterThan(0.5);
    await expect.poll(() => opacityOf(page, 's03-image')).toBeGreaterThan(0.5);
    await expect(page.getByText('Click 1 of 3')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Click 2 of 3')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Click 3 of 3')).toBeVisible();
    await expect.poll(() => opacityOf(audience, 's03-block')).toBe(0);

    // The next press goes to slide 4, and Left comes back to slide 3 with all its clicks played.
    await page.keyboard.press('ArrowRight');
    await expect(settled(audience, 's04')).toHaveCount(1);
    await expect(settled(page, 's04')).toHaveCount(1);
    await page.keyboard.press('ArrowLeft');
    await expect(settled(audience, 's03')).toHaveCount(1);
    await expect(page.getByText('Click 3 of 3')).toBeVisible();
    expect(await opacityOf(audience, 's03-block')).toBe(0);
    // A step back inside the slide shows the click before at once.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Click 2 of 3')).toBeVisible();
    await expect.poll(() => opacityOf(audience, 's03-block')).toBe(1);

    // B blanks the audience window and the same key brings the slide back.
    await page.keyboard.press('b');
    await expect(audience.locator('.audience-blank')).toHaveAttribute('data-colour', 'black');
    await page.keyboard.press('b');
    await expect(audience.locator('.audience-blank')).toHaveCount(0);
  });

  test('Then a number then Enter jumps to that slide, and Space goes forward in either window', async ({
    page,
  }) => {
    await openDeck(page);
    const audience = await present(page);

    await page.keyboard.press('7');
    await page.keyboard.press('Enter');
    await expect(settled(audience, 's07')).toHaveCount(1);
    await expect(page.getByText('Slide 7 of 12')).toBeVisible();
    // The audience window takes keys too, and the presenter follows.
    await audience.keyboard.press('Space');
    await expect(settled(page, 's08')).toHaveCount(1);
    await page.getByRole('button', { name: 'Slide 2', exact: true }).click();
    await expect(settled(audience, 's02')).toHaveCount(1);
  });
});

test.describe('Given a show under way, When it is ended (PM-1)', () => {
  test('Then Esc closes the audience window and the editor is back as it was left', async ({
    page,
  }) => {
    await openDeck(page);
    await page.getByRole('option', { name: 'Slide 3', exact: true }).click();
    await page.getByRole('tab', { name: 'Animate' }).click();
    await page.locator('.slide-frame [data-element-id="s03-circle"]').click();
    await expect(page.locator('.sel-box')).toHaveCount(1);
    const audience = await present(page, 'current');
    const closed = audience.waitForEvent('close');

    await page.keyboard.press('Escape');

    await closed;
    await expect(page.getByRole('option', { name: 'Slide 3', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Animate' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.sel-box')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible();
  });

  test('Then Esc in the audience window ends the show in both', async ({ page }) => {
    await openDeck(page);
    const audience = await present(page);
    const closed = audience.waitForEvent('close');

    // The window closes while the key is still down, so the key's release has nowhere to go.
    await audience.keyboard.press('Escape').catch(() => undefined);

    await closed;
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible();
    expect(new URL(page.url()).hash).toBe(`#/deck/${DECK}`);
  });

  test('Then End show does the same, and the show never changed the deck', async ({ page }) => {
    await openDeck(page);
    const audience = await present(page);
    await page.keyboard.press('ArrowRight');
    const closed = audience.waitForEvent('close');

    await page.getByRole('button', { name: 'End show' }).click();

    await closed;
    await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Undo/ })).toBeDisabled();
  });
});

test.describe('Given a browser that blocks the audience window (PM-1)', () => {
  test('Then the card says how to allow it, and Present in one window runs the show here without notes', async ({
    page,
  }) => {
    await openDeck(page);
    await page.evaluate(() => {
      window.open = () => null;
    });

    await page.getByRole('button', { name: 'Present', exact: true }).click();

    const card = page.getByRole('dialog', { name: 'Your browser blocked the audience window' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Allow pop-ups for this site');
    await card.getByRole('button', { name: 'Present in one window' }).click();

    await expect(settled(page, 's01')).toHaveCount(1);
    await expect(page.locator('.audience')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Speaker notes' })).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(settled(page, 's02')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible();
  });

  test('Then Try again asks for the window again', async ({ page }) => {
    await openDeck(page);
    await page.evaluate(() => {
      window.open = () => null;
    });
    await page.getByRole('button', { name: 'Present', exact: true }).click();
    const card = page.getByRole('dialog', { name: 'Your browser blocked the audience window' });
    await expect(card).toBeVisible();
    await page.evaluate(() => {
      Reflect.set(window, 'tried', 0);
      window.open = () => {
        Reflect.set(window, 'tried', 1);
        return null;
      };
    });

    await card.getByRole('button', { name: 'Try again' }).click();

    await expect(card).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, 'tried') as unknown)).toBe(1);
  });
});

test.describe('Given the show windows (PM-2)', () => {
  test('Then the presenter view and the audience window have no accessibility violations', async ({
    page,
  }) => {
    await openDeck(page);
    const audience = await present(page);

    const presenter = await new AxeBuilder({ page }).exclude('.show-stage').analyze();
    const audienceResults = await new AxeBuilder({ page: audience })
      .exclude('.show-stage')
      .analyze();

    expect(presenter.violations).toEqual([]);
    expect(audienceResults.violations).toEqual([]);
  });
});
