import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gif, pictureFile, png, svg, type PictureFile } from './support/pictures';
import { openNewDeck } from './support/slide';

// Sprint 4: pictures (EL-4), with real files through the real file chooser, and the storage-full path
// with the browser's database made to say "full".

test.use({ viewport: { width: 1440, height: 900 } });

const chooser = (page: Page) => page.locator('input[type="file"]');
const pictures = (page: Page) => page.locator('.slide-frame [data-kind="image"]');
const frame = (page: Page) => page.getByRole('group', { name: /^Slide 1 of/ });

async function chooseFiles(page: Page, ...files: PictureFile[]) {
  await chooser(page).setInputFiles(files);
}

/** Wait until every picture on the slide is drawn: its bytes have loaded and decoded. */
async function drawn(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLImageElement>('.slide-frame [data-kind="image"] img'),
        ].every((img) => img.complete && img.naturalWidth > 0),
      ),
    )
    .toBe(true);
}

/** Drop files on the slide, as a person does from their file manager. */
async function dropFiles(page: Page, files: PictureFile[], at: { x: number; y: number }) {
  const data = await page.evaluateHandle(
    (encoded) => {
      const transfer = new DataTransfer();
      for (const file of encoded) {
        const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
        transfer.items.add(new File([bytes], file.name, { type: file.mimeType }));
      }
      return transfer;
    },
    files.map((f) => ({ name: f.name, mimeType: f.mimeType, base64: f.buffer.toString('base64') })),
  );
  await frame(page).dispatchEvent('dragover', { dataTransfer: data, clientX: at.x, clientY: at.y });
  await frame(page).dispatchEvent('drop', { dataTransfer: data, clientX: at.x, clientY: at.y });
}

test.describe('Given a slide, When pictures are added (EL-4)', () => {
  test('Then PNG, GIF and SVG files from the chooser each appear, and survive a reload', async ({
    page,
  }) => {
    await openNewDeck(page);

    await chooseFiles(
      page,
      pictureFile('one.png', 'image/png', png(400, 300)),
      pictureFile('two.gif', 'image/gif', gif()),
      pictureFile('three.svg', 'image/svg+xml', svg()),
    );

    await expect(pictures(page)).toHaveCount(3);
    await drawn(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(pictures(page)).toHaveCount(3);
    await drawn(page);
  });

  test('Then a file dropped on the slide lands at the drop point', async ({ page }) => {
    const slide = await openNewDeck(page);
    const point = await slide.at(480, 360);

    await dropFiles(page, [pictureFile('drop.png', 'image/png', png(400, 200))], point);

    await expect(pictures(page)).toHaveCount(1);
    const box = await pictures(page).boundingBox();
    if (!box) throw new Error('nothing drawn');
    expect(box.x + box.width / 2).toBeCloseTo(point.x, -1);
    expect(box.y + box.height / 2).toBeCloseTo(point.y, -1);
    await drawn(page);
  });

  test('Then a picture of 4200 x 2800 is scaled down, the toast says so, and Undo reverses it', async ({
    page,
  }) => {
    await openNewDeck(page);

    await chooseFiles(page, pictureFile('big.png', 'image/png', png(4200, 2800)));

    await expect(page.getByText('Image scaled to fit')).toBeVisible();
    await expect(page.getByText(/4200 × 2800 became/)).toBeVisible();
    await expect(pictures(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
    await expect(pictures(page)).toHaveCount(0);
  });

  test('Then a file that is not a picture gets a clear message and adds nothing', async ({
    page,
  }) => {
    await openNewDeck(page);

    await chooseFiles(page, pictureFile('notes.png', 'image/png', Buffer.from('just some words')));

    await expect(page.getByText('That file isn’t a picture Cue can use')).toBeVisible();
    await expect(pictures(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  });

  test('Then a corner handle keeps the proportions, a side handle stretches', async ({ page }) => {
    await openNewDeck(page);
    await chooseFiles(page, pictureFile('wide.png', 'image/png', png(600, 300)));
    await expect(pictures(page)).toHaveCount(1);
    const before = await pictures(page).boundingBox();
    if (!before) throw new Error('no picture');

    const corner = await page.locator('.handle-se').boundingBox();
    if (!corner) throw new Error('no handle');
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x + 160, corner.y + 10, { steps: 6 });
    await page.mouse.up();
    const grown = await pictures(page).boundingBox();
    if (!grown) throw new Error('no picture');
    expect(grown.width / grown.height).toBeCloseTo(before.width / before.height, 1);
    expect(grown.width).toBeGreaterThan(before.width + 60);

    const side = await page.locator('.handle-e').boundingBox();
    if (!side) throw new Error('no handle');
    await page.mouse.move(side.x + side.width / 2, side.y + side.height / 2);
    await page.mouse.down();
    await page.mouse.move(side.x + 60, side.y + side.height / 2, { steps: 6 });
    await page.mouse.up();
    const stretched = await pictures(page).boundingBox();
    expect(stretched?.height).toBeCloseTo(grown.height, 0);
    expect(stretched?.width).toBeGreaterThan(grown.width + 30);
  });

  test('Then a picture can be described, faded and copied to another slide', async ({ page }) => {
    await openNewDeck(page);
    await chooseFiles(page, pictureFile('team.png', 'image/png', png(500, 300)));
    await expect(pictures(page)).toHaveCount(1);

    await page.getByRole('textbox', { name: 'Image description' }).fill('The team at the offsite');
    await page.keyboard.press('Tab');
    await page.getByRole('textbox', { name: 'Opacity percent' }).fill('50');
    await page.keyboard.press('Enter');
    await pictures(page).click();
    await page.keyboard.press('Control+c');
    await page.getByRole('button', { name: 'New slide' }).click();
    await page.keyboard.press('Control+v');

    await expect(pictures(page)).toHaveCount(1);
    await expect(pictures(page).locator('img')).toHaveAttribute('alt', 'The team at the offsite');
    await expect(pictures(page)).toHaveCSS('opacity', '0.5');
    await drawn(page);
  });

  test('Then the editor with a picture selected and a toast has no accessibility violations', async ({
    page,
  }) => {
    await openNewDeck(page);
    await chooseFiles(page, pictureFile('big.png', 'image/png', png(3000, 2000)));
    await expect(page.getByText('Image scaled to fit')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe('Given a store that is nearly or completely full (SV-1, EL-4)', () => {
  test('Then a picture with no room to keep it is refused with a message', async ({ page }) => {
    await page.addInitScript(() => {
      // The browser says there are 100 bytes left. (The whole object is replaced: WebKit does not
      // let one method of it be.)
      Object.defineProperty(navigator, 'storage', {
        value: { estimate: () => Promise.resolve({ usage: 999_999_900, quota: 1_000_000_000 }) },
        configurable: true,
      });
    });
    await openNewDeck(page);

    await chooseFiles(page, pictureFile('small.png', 'image/png', png(200, 200)));

    await expect(page.getByText('There isn’t room for this picture')).toBeVisible();
    await expect(pictures(page)).toHaveCount(0);
  });

  test('Then a save the database refuses shows the banner, keeps the picture on screen, and Try again saves it with the deck', async ({
    page,
  }) => {
    await openNewDeck(page);
    await page.evaluate(() => {
      // From now on, every write to the database fails as a full store does, until told otherwise.
      let full = true;
      window.addEventListener('set-store-full', (event) => {
        full = event instanceof CustomEvent && event.detail === true;
      });
      for (const name of ['put', 'add'] as const) {
        const original = IDBObjectStore.prototype[name]; // eslint-disable-line @typescript-eslint/unbound-method
        IDBObjectStore.prototype[name] = function (this: IDBObjectStore, ...args) {
          if (full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
          return original.apply(this, args);
        };
      }
    });

    await chooseFiles(page, pictureFile('kept.png', 'image/png', png(300, 200)));

    await expect(page.getByText('Changes can’t be saved.', { exact: false })).toBeVisible();
    await expect(pictures(page)).toHaveCount(1);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('set-store-full', { detail: false }));
    });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Changes can’t be saved.', { exact: false })).toHaveCount(0);
    await page.reload();
    await expect(pictures(page)).toHaveCount(1);
    await drawn(page);
  });
});
