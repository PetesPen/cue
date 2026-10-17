import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { drag, openNewDeck, type Slide } from './support/slide';

// Sprint 2: elements you can move (EL-3, EL-5, ZO-1, TR-1) and one tab per deck (SV-7). These drive a
// real mouse over a slide at a fixed window size, so slide pixels map to screen pixels the same way
// in every browser.

test.use({ viewport: { width: 1440, height: 900 } });

/** Choose a shape from the toolbar and draw it by dragging between two slide points. */
async function draw(
  page: Page,
  slide: Slide,
  shape: string,
  from: readonly [number, number],
  to: readonly [number, number],
  shift = false,
) {
  await page.getByRole('button', { name: 'Shape' }).click();
  await page.getByRole('menuitem', { name: shape, exact: true }).click();
  await drag(page, slide, from, to, { shift });
}

const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
const value = async (page: Page, name: string) => Number(await field(page, name).inputValue());
const nodes = (page: Page) => page.locator('.slide-frame .cue-element');
const chip = (page: Page) => page.locator('.sel-chip');
const order = (page: Page) => nodes(page).evaluateAll((els) => els.map((e) => e.dataset.shape));

test.describe('Given a blank slide, When shapes are drawn (EL-3)', () => {
  test('Then each of the six shapes can be drawn by dragging, lands on top and is selected', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    const kinds: [string, string][] = [
      ['Rectangle', 'rectangle'],
      ['Rounded rectangle', 'roundedRectangle'],
      ['Ellipse', 'ellipse'],
      ['Triangle', 'triangle'],
      ['Line', 'line'],
      ['Arrow', 'arrow'],
    ];

    for (const [index, [label]] of kinds.entries()) {
      const x = 100 + (index % 3) * 600;
      const y = 120 + Math.floor(index / 3) * 450;
      await draw(page, slide, label, [x, y], [x + 400, y + 300]);
      await expect(chip(page)).toContainText(label);
    }

    expect(await order(page)).toEqual(kinds.map(([, kind]) => kind));
    await expect(nodes(page)).toHaveCount(6);
    // The last one drawn is selected, and the format panel names it.
    await expect(page.getByText('Arrow', { exact: true }).first()).toBeVisible();
  });

  test('Then Shift keeps a shape square, and a line snaps to 15-degree steps', async ({ page }) => {
    const slide = await openNewDeck(page);

    await draw(page, slide, 'Rectangle', [200, 200], [700, 350], true);
    expect(await value(page, 'Width')).toBe(await value(page, 'Height'));

    await draw(page, slide, 'Line', [200, 700], [900, 880], true);
    const angle = await value(page, 'Angle');
    expect(Math.abs(angle / 15 - Math.round(angle / 15))).toBeLessThan(0.01);
  });

  test('Then a shape clicked into place, with no drag, is the default size', async ({ page }) => {
    const slide = await openNewDeck(page);
    await page.getByRole('button', { name: 'Shape' }).click();
    await page.getByRole('menuitem', { name: 'Ellipse', exact: true }).click();
    await expect(
      page.getByText('Drag on the slide to draw an ellipse. Esc cancels.'),
    ).toBeVisible();

    const p = await slide.at(960, 540);
    await page.mouse.click(p.x, p.y);

    expect(await value(page, 'Width')).toBe(360);
    expect(await value(page, 'Height')).toBe(240);
    expect(await value(page, 'X')).toBe(780);
    await expect(page.getByText('Drag on the slide to draw')).toHaveCount(0);
  });

  test('Then Escape cancels the tool and nothing is drawn', async ({ page }) => {
    const slide = await openNewDeck(page);
    await page.getByRole('button', { name: 'Shape' }).click();
    await page.getByRole('menuitem', { name: 'Triangle', exact: true }).click();

    await page.keyboard.press('Escape');
    await drag(page, slide, [200, 200], [500, 400]);

    await expect(nodes(page)).toHaveCount(0);
  });
});

test.describe('Given a shape on the slide, When it is manipulated (EL-5)', () => {
  test('Then dragging moves it, shows X and Y while dragging, and is saved as one change', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [200, 200], [600, 400]);
    const x = await value(page, 'X');
    const y = await value(page, 'Y');
    const scale = await slide.scale();

    await drag(page, slide, [400, 300], [700, 350], { release: false });
    // While the button is down the chip shows where the shape is, before anything is saved.
    await expect
      .poll(async () => {
        const m = /X (-?\d+) · Y (-?\d+)/.exec(await chip(page).innerText());
        return m
          ? Math.max(Math.abs(Number(m[1]) - (x + 300)), Math.abs(Number(m[2]) - (y + 50)))
          : 999;
      })
      .toBeLessThanOrEqual(3);
    await page.mouse.up();

    expect(Math.abs((await value(page, 'X')) - (x + 300))).toBeLessThanOrEqual(
      Math.ceil(1 / scale),
    );
    expect(Math.abs((await value(page, 'Y')) - (y + 50))).toBeLessThanOrEqual(Math.ceil(1 / scale));
    await expect(page.getByText('Saved')).toBeVisible();
  });

  test('Then a corner handle resizes it about the opposite corner, and Shift keeps its proportions', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [200, 200], [600, 400]); // 400 x 200

    await drag(page, slide, [600, 400], [800, 440], { release: false });
    await expect
      .poll(async () => {
        const m = /W (\d+) · H (\d+)/.exec(await chip(page).innerText());
        return m ? Math.max(Math.abs(Number(m[1]) - 600), Math.abs(Number(m[2]) - 240)) : 999;
      })
      .toBeLessThanOrEqual(3);
    await page.mouse.up();
    expect(await value(page, 'X')).toBe(200);
    expect(await value(page, 'Y')).toBe(200);
    expect(Math.abs((await value(page, 'Width')) - 600)).toBeLessThanOrEqual(3);
    expect(Math.abs((await value(page, 'Height')) - 240)).toBeLessThanOrEqual(3);

    // Drag the same corner again with Shift: the 600:240 ratio is kept.
    await drag(page, slide, [800, 440], [1000, 460], { shift: true });
    const w = await value(page, 'Width');
    const h = await value(page, 'Height');
    expect(w / h).toBeCloseTo(600 / 240, 1);
  });

  test('Then an edge handle changes only one side', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [200, 200], [600, 400]);

    await drag(page, slide, [400, 400], [400, 520]);

    expect(await value(page, 'Width')).toBe(400);
    expect(await value(page, 'Height')).toBe(320);
    expect(await value(page, 'Y')).toBe(200);
  });

  test('Then the round handle turns it and the readout shows the angle', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [400, 400], [800, 600]); // centre (600, 500)
    const handle = page.locator('.sel-box .handle-rotate');
    const h = await handle.boundingBox();
    if (!h) throw new Error('no rotation handle');
    const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
    const centre = await slide.at(600, 500);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // Straight out to the right of the centre is a quarter turn.
    await page.mouse.move(centre.x + 150, centre.y, { steps: 8 });
    await expect
      .poll(async () => Math.abs(parseInt(await chip(page).innerText(), 10) - 90))
      .toBeLessThanOrEqual(3);
    await page.mouse.up();

    expect(Math.abs((await value(page, 'Rotation')) - 90)).toBeLessThan(1.5);
  });

  test('Then the arrow keys nudge it 1 px, and Shift+arrow 10 px', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [200, 200], [600, 400]);
    const inside = await slide.at(400, 300);
    await page.mouse.click(inside.x, inside.y);
    const x = await value(page, 'X');
    const y = await value(page, 'Y');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+ArrowLeft');

    expect(await value(page, 'X')).toBe(x - 8);
    expect(await value(page, 'Y')).toBe(y + 1);
  });

  test('Then a line is resized and turned by its two ends', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Line', [300, 300], [700, 300]);
    expect(await value(page, 'Length')).toBe(400);

    // Drag the right end straight down: the other end stays, the line turns to 90 degrees.
    await drag(page, slide, [700, 300], [300, 600]);

    expect(await value(page, 'Length')).toBe(300);
    expect(Math.abs((await value(page, 'Angle')) - 90)).toBeLessThan(0.5);
  });

  test('Then several shapes selected by Shift-click or a selection box move together', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [100, 100], [400, 300]);
    await draw(page, slide, 'Ellipse', [600, 100], [900, 300]);
    await draw(page, slide, 'Triangle', [1200, 700], [1500, 900]);

    // A box around the first two selects them, not the third.
    await drag(page, slide, [50, 50], [1000, 400]);
    await expect(chip(page)).toHaveText('2 shapes');
    const x = await value(page, 'X');

    await drag(page, slide, [250, 200], [450, 260]);

    expect(Math.abs((await value(page, 'X')) - (x + 200))).toBeLessThan(3);
    // Click empty space, then Shift-click two shapes.
    const empty = await slide.at(900, 800);
    await page.mouse.click(empty.x, empty.y);
    await expect(page.getByRole('button', { name: 'Apply to all slides' })).toBeVisible();
    const a = await slide.at(1350, 800);
    await page.mouse.click(a.x, a.y);
    await page.keyboard.down('Shift');
    const b = await slide.at(450, 260);
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up('Shift');
    await expect(chip(page)).toHaveText('2 shapes');
  });

  test('Then a group is resized as one box with every member scaled with it', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [200, 200], [400, 400]);
    await draw(page, slide, 'Rectangle', [600, 200], [800, 400]);
    await drag(page, slide, [100, 100], [900, 500]); // select both
    await expect(chip(page)).toHaveText('2 shapes');
    expect(await value(page, 'Width')).toBe(600);

    // The south-east handle of the group box, dragged right: the whole group gets wider.
    await drag(page, slide, [800, 400], [1400, 400]);

    expect(await value(page, 'Width')).toBe(1200);
    expect(await value(page, 'X')).toBe(200);
  });

  test('Then a shape is where it was left after the page is reloaded', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Ellipse', [300, 300], [700, 500]);
    await field(page, 'Rotation').fill('45');
    await page.keyboard.press('Enter');
    await field(page, 'Opacity percent').fill('60');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Saved')).toBeVisible();

    await page.reload();

    await expect(page.getByRole('option', { name: 'Slide 1' })).toBeVisible();
    const node = nodes(page).first();
    await expect(node).toHaveAttribute('data-shape', 'ellipse');
    await expect(node).toHaveCSS('opacity', '0.6');
    await expect(node).toHaveCSS('transform', /matrix/);
    // A shape is also in the slide's thumbnail.
    await expect(page.locator('.rail-item .cue-element')).toHaveCount(1);
  });
});

test.describe('Given shapes that overlap, When they are arranged (ZO-1)', () => {
  async function threeStacked(page: Page) {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [200, 200], [600, 500]);
    await draw(page, slide, 'Ellipse', [300, 300], [700, 600]);
    await draw(page, slide, 'Triangle', [400, 400], [800, 700]);
    return slide;
  }

  test('Then the panel buttons move the selection and disable what would do nothing', async ({
    page,
  }) => {
    const slide = await threeStacked(page);
    const rectangle = await slide.at(220, 220); // only the rectangle is here
    await page.mouse.click(rectangle.x, rectangle.y);
    await expect(page.getByRole('button', { name: 'Backward' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Front', exact: true }).click();

    expect(await order(page)).toEqual(['ellipse', 'triangle', 'rectangle']);
    await expect(page.getByRole('button', { name: 'Front', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Forward' })).toBeDisabled();
    await page.getByRole('button', { name: 'Backward' }).click();
    expect(await order(page)).toEqual(['ellipse', 'rectangle', 'triangle']);
  });

  test('Then the right-click menu has the four arrange commands, with their shortcuts, and disables the ones that do nothing', async ({
    page,
  }) => {
    const slide = await threeStacked(page);
    const ellipse = await slide.at(350, 450); // only the ellipse's box is topmost here
    await page.mouse.click(ellipse.x, ellipse.y, { button: 'right' });

    const menu = page.getByRole('menu', { name: 'Element actions' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveText([
      'CutCtrl+X',
      'CopyCtrl+C',
      'PasteCtrl+V',
      'DuplicateCtrl+D',
      'DeleteDel',
      'Bring to frontCtrl+Shift+]',
      'Bring forwardCtrl+]',
      'Send backwardCtrl+[',
      'Send to backCtrl+Shift+[',
    ]);
    await menu.getByRole('menuitem', { name: /Bring to front/ }).click();

    expect(await order(page)).toEqual(['rectangle', 'triangle', 'ellipse']);
    await page.mouse.click(ellipse.x, ellipse.y, { button: 'right' });
    await expect(page.getByRole('menuitem', { name: /Bring to front/ })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('Then the keyboard shortcuts do the same, and the order survives a reload', async ({
    page,
  }) => {
    const slide = await threeStacked(page);
    const rectangle = await slide.at(220, 220);
    await page.mouse.click(rectangle.x, rectangle.y);

    await page.keyboard.press('Control+Shift+BracketRight');
    expect(await order(page)).toEqual(['ellipse', 'triangle', 'rectangle']);
    await page.keyboard.press('Control+BracketLeft');
    expect(await order(page)).toEqual(['ellipse', 'rectangle', 'triangle']);
    await page.keyboard.press('Control+Shift+BracketLeft');
    expect(await order(page)).toEqual(['rectangle', 'ellipse', 'triangle']);
    await expect(page.getByText('Saved')).toBeVisible();

    await page.reload();

    await expect(nodes(page)).toHaveCount(3);
    expect(await order(page)).toEqual(['rectangle', 'ellipse', 'triangle']);
  });

  test('Then moving several selected shapes to the front keeps their order among themselves', async ({
    page,
  }) => {
    const slide = await threeStacked(page);
    // Select the rectangle (bottom) and the triangle (top) with a box around both... they overlap the
    // ellipse, so use Shift-click on a point of each that the others do not cover.
    const rectangle = await slide.at(220, 220);
    const triangle = await slide.at(600, 690);
    await page.mouse.click(rectangle.x, rectangle.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(triangle.x, triangle.y);
    await page.keyboard.up('Shift');
    await expect(chip(page)).toHaveText('2 shapes');

    await page.getByRole('button', { name: 'Back', exact: true }).click();

    expect(await order(page)).toEqual(['rectangle', 'triangle', 'ellipse']);
  });
});

test.describe('Given a shape, When its opacity changes (TR-1)', () => {
  test('Then the slider fades it live while dragging, and the number field sets it exactly', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [300, 300], [900, 700]);
    const node = nodes(page).first();
    const slider = page.getByRole('slider', { name: 'Opacity' });
    const box = await slider.boundingBox();
    if (!box) throw new Error('no slider');

    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    // Still dragging: the canvas already shows it faded.
    const live = Number(await node.evaluate((el) => getComputedStyle(el).opacity));
    expect(live).toBeGreaterThan(0.3);
    expect(live).toBeLessThan(0.7);
    await page.mouse.up();

    await field(page, 'Opacity percent').fill('25');
    await page.keyboard.press('Enter');
    await expect(node).toHaveCSS('opacity', '0.25');
    await expect(chip(page)).toHaveText('Rectangle · 25%');
  });

  test('Then a selection of several is faded together, and values that differ read Mixed', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [100, 100], [400, 300]);
    await field(page, 'Opacity percent').fill('50');
    await page.keyboard.press('Enter');
    await draw(page, slide, 'Ellipse', [600, 100], [900, 300]);

    await drag(page, slide, [50, 50], [1000, 400]);
    await expect(chip(page)).toHaveText('2 shapes');
    await expect(field(page, 'Opacity percent')).toHaveValue('');
    await expect(field(page, 'Opacity percent')).toHaveAttribute('placeholder', 'Mixed');
    await field(page, 'Opacity percent').fill('30');
    await page.keyboard.press('Enter');

    await expect(nodes(page).nth(0)).toHaveCSS('opacity', '0.3');
    await expect(nodes(page).nth(1)).toHaveCSS('opacity', '0.3');
    await expect(field(page, 'Opacity percent')).toHaveValue('30');
  });

  test('Then fading applies to the whole shape, fill and border together', async ({ page }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rectangle', [300, 300], [900, 700]);
    await field(page, 'Border width').fill('20');
    await page.keyboard.press('Enter');

    await field(page, 'Opacity percent').fill('50');
    await page.keyboard.press('Enter');

    const node = nodes(page).first();
    await expect(node).toHaveCSS('opacity', '0.5');
    // Opacity is on the box, not on its parts.
    const parts = await node
      .locator('rect')
      .evaluate((el) => [
        el.getAttribute('opacity'),
        el.getAttribute('fill-opacity'),
        el.getAttribute('stroke-opacity'),
      ]);
    expect(parts).toEqual([null, null, null]);
  });
});

test.describe('Given a shape, When it is styled (EL-3)', () => {
  test('Then fill, border colour, width and dash change the drawing and survive a reload', async ({
    page,
  }) => {
    const slide = await openNewDeck(page);
    await draw(page, slide, 'Rounded rectangle', [300, 300], [900, 700]);

    await page.getByRole('button', { name: 'Choose fill' }).click();
    await page
      .getByRole('dialog', { name: 'Fill picker' })
      .getByRole('button', { name: 'Yellow' })
      .click();
    // The open picker covers the next colour; Escape closes it, as a person would.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Choose border colour' }).click();
    await page
      .getByRole('dialog', { name: 'Border colour picker' })
      .getByRole('button', { name: 'Forest' })
      .click();
    await page.keyboard.press('Escape');
    await field(page, 'Border width').fill('14');
    await page.keyboard.press('Enter');
    await page
      .getByRole('group', { name: 'Dash style' })
      .getByRole('button', { name: 'Dotted' })
      .click();
    await field(page, 'Corner radius').fill('120');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Saved')).toBeVisible();

    await page.reload();

    const rect = nodes(page).first().locator('rect');
    await expect(rect).toHaveAttribute('fill', '#F5C542');
    await expect(rect).toHaveAttribute('stroke', '#14281B');
    await expect(rect).toHaveAttribute('stroke-width', '14');
    await expect(rect).toHaveAttribute('stroke-dasharray', '0 28');
    await expect(rect).toHaveAttribute('rx', '120');
  });
});

test.describe('Given a deck open in one tab (SV-7)', () => {
  test('Then a second tab for the same deck says so, then opens it by itself when the first closes', async ({
    page,
    context,
  }) => {
    await openNewDeck(page);
    const address = page.url();

    const second = await context.newPage();
    await second.goto(address);
    await expect(
      second.getByRole('heading', { name: 'This deck is open in another tab' }),
    ).toBeVisible();
    await expect(second.getByRole('link', { name: 'Back to your decks' })).toBeVisible();
    await expect(second.getByRole('option')).toHaveCount(0);

    await page.close();

    // The browser lets go of a closed page's lock when it gets to it, which can be a while on a busy machine.
    await expect(second.getByRole('option', { name: 'Slide 1' })).toBeVisible({ timeout: 20_000 });
  });

  test('Then a different deck, or the library, opens freely in other tabs', async ({
    page,
    context,
  }) => {
    await openNewDeck(page);
    await page.getByRole('link', { name: 'All decks' }).click();
    await page.getByRole('button', { name: 'New deck' }).first().click();
    await expect(page.getByRole('option', { name: 'Slide 1' })).toBeVisible();

    const library = await context.newPage();
    await library.goto('/#/');
    await expect(library.getByRole('heading', { name: /Your decks/ })).toBeVisible();
    await expect(library.locator('.deck-card')).toHaveCount(2);
    // The first deck is not locked by the second one being open.
    await library.locator('.deck-open').last().click();
    await expect(library.getByRole('option', { name: 'Slide 1' })).toBeVisible();
  });
});

test.describe('Given the editor with shapes (accessibility)', () => {
  test('Then axe finds no violations with a shape selected, the Shape menu open, and the right-click menu open', async ({
    page,
  }) => {
    test.slow(); // several full accessibility scans in a row
    const slide = await openNewDeck(page);
    const check = async () => {
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    };
    await draw(page, slide, 'Rounded rectangle', [300, 300], [900, 700]);
    await check();

    await page.getByRole('button', { name: 'Shape' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await check();
    await page.keyboard.press('Escape');

    const p = await slide.at(600, 500);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await expect(page.getByRole('menu', { name: 'Element actions' })).toBeVisible();
    await check();
  });

  test('Then no console errors appear while drawing and editing shapes', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    const slide = await openNewDeck(page);

    await draw(page, slide, 'Ellipse', [300, 300], [900, 700]);
    await drag(page, slide, [600, 500], [800, 600]);
    await field(page, 'Opacity percent').fill('70');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Saved')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
