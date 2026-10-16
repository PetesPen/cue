import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { drag, openNewDeck } from './support/slide';

// Sprint 5: fast, keyboard-first work (UX-2): the shortcuts of the Shortcuts board, the cheat sheet
// that `?` opens, and the hint on every toolbar button.

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Given the editor, When it is worked with the keyboard (UX-2)', () => {
  test('Then S draws a shape, Ctrl+Shift+D copies the slide, the arrows change slide, Ctrl+Z undoes, I opens the picture chooser, Ctrl+S saves', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await slide.frame.focus();

    await page.keyboard.press('s');
    await drag(page, slide, [300, 300], [800, 600]);
    await expect(page.locator('.slide-frame [data-kind="shape"]')).toHaveCount(1);

    await page.keyboard.press('Control+Shift+d');
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(page.locator('.slide-frame [data-kind="shape"]')).toHaveCount(1);

    await page.keyboard.press('Escape');
    // The copy is the slide now shown, so the frame is found by where it is, not by its number.
    await page.locator('.canvas .slide-frame').focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('option', { name: 'Slide 1', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The shape drawn there is still selected, and an arrow key would move it: let go of it first.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Slide 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.keyboard.press('Control+z');
    await expect(page.getByRole('option')).toHaveCount(1);

    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('i');
    expect((await chooser).isMultiple()).toBe(true);

    await page.getByRole('textbox', { name: 'Speaker notes text' }).fill('Save me now');
    await page.getByRole('textbox', { name: 'Speaker notes text' }).blur();
    await page.keyboard.press('Control+s');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  });

  test('Then ? opens the shortcut list, the search narrows it, and Escape closes it', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await slide.frame.focus();

    await page.keyboard.press('Shift+?');

    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Bring to front', { exact: true })).toBeVisible();
    await dialog.getByRole('searchbox', { name: 'Search shortcuts' }).fill('undo');
    await expect(dialog.getByText('Undo', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Bring to front', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Then the shortcut list has no accessibility violations', async ({ page }) => {
    const slide = await openNewDeck(page);
    await slide.frame.focus();
    await page.keyboard.press('Shift+?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Then every toolbar button shows its shortcut when it is hovered', async ({ page }) => {
    await openNewDeck(page);

    for (const [name, label, keys] of [
      ['Add slide', 'Add slide', 'CtrlM'],
      ['Text', 'Text box', 'T'],
      ['Shape', 'Shape', 'S'],
      ['Add image', 'Add image', 'I'],
    ] as const) {
      await page.getByRole('button', { name, exact: true }).hover();
      await expect(page.getByRole('tooltip')).toHaveText(`${label}${keys}`);
      await page.mouse.move(700, 450);
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    }
  });
});
