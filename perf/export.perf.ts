import { expect, test, type Page } from '@playwright/test';
import { createImage } from '../src/model';
import { doc, paragraph, run, text, transition, type Json } from '../tests/fixtures/autumnLaunch';
import { seedDeck } from '../e2e/support/seed';
import { enforced, report } from './support';

// SV-4, the export of a standalone web page is fast (sprint 10): a deck of 30 slides with a 2000 x 1500
// picture on each exports in under 10 seconds, timed from the press of Export to the file being saved.
// The pictures are made here (noise scaled up, saved as JPEG at 0.8, as SP-3 did) and put straight into
// the browser's database. Chromium and Firefox are held to the budget in `config/budgets.json`; WebKit is
// measured and printed (SP-4: the runner draws in software). SP-3 measured about half a second.

import budgets from '../config/budgets.json' with { type: 'json' };

const SLIDES = 30;
const PICTURES = 30;
const DECK = 'thirty-pictures';

/** Make `count` pictures in the page and store them in its database; their hashes, in order. */
async function storePictures(
  page: Page,
  count: number,
): Promise<{ hashes: string[]; bytes: number }> {
  return page.evaluate(async (many) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cue');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error('The deck database did not open'));
      };
    });
    const hashes: string[] = [];
    let total = 0;
    for (let at = 0; at < many; at += 1) {
      const small = document.createElement('canvas');
      small.width = 200;
      small.height = 150;
      const smallContext = small.getContext('2d');
      const big = document.createElement('canvas');
      big.width = 2000;
      big.height = 1500;
      const bigContext = big.getContext('2d');
      if (!smallContext || !bigContext) throw new Error('no canvas');
      const noise = smallContext.createImageData(200, 150);
      for (let pixel = 0; pixel < noise.data.length; pixel += 4) {
        noise.data[pixel] = Math.random() * 255;
        noise.data[pixel + 1] = Math.random() * 255;
        noise.data[pixel + 2] = (at * 37) % 255;
        noise.data[pixel + 3] = 255;
      }
      smallContext.putImageData(noise, 0, 0);
      bigContext.imageSmoothingEnabled = true;
      bigContext.drawImage(small, 0, 0, 2000, 1500);
      const blob = await new Promise<Blob | null>((made) => {
        big.toBlob(made, 'image/jpeg', 0.8);
      });
      if (!blob) throw new Error('no picture');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      total += bytes.length;
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
      hashes.push(hash);
      await new Promise<void>((done, fail) => {
        const transaction = db.transaction('images', 'readwrite');
        transaction.objectStore('images').put({ hash, type: 'image/jpeg', bytes });
        transaction.oncomplete = () => {
          done();
        };
        transaction.onerror = () => {
          fail(new Error('A picture was not stored'));
        };
      });
    }
    db.close();
    return { hashes, bytes: total };
  }, count);
}

/** Thirty slides: a title and a picture each, with notes, and a transition into all but the first. */
function thirtySlides(hashes: readonly string[]): Json {
  return {
    schemaVersion: 1,
    id: DECK,
    title: 'Thirty pictures',
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    slides: Array.from({ length: SLIDES }, (_, at) => ({
      id: `p${String(at + 1).padStart(2, '0')}`,
      background: '#FFFFFF',
      notes: `Notes for slide ${String(at + 1)}.`,
      elements: [
        text(
          `p${String(at)}-title`,
          { x: 100, y: 60, width: 1200, height: 120 },
          doc(paragraph(undefined, run(`Picture ${String(at + 1)}`, 80, '#14281B', ['bold']))),
        ),
        {
          ...createImage(
            `p${String(at)}-image`,
            hashes[at % hashes.length] ?? '',
            { x: 420, y: 220, width: 1080, height: 810 },
            'A picture',
          ),
        },
      ],
      animations: [],
      transition: transition(at === 0 ? 'none' : 'fade'),
    })),
  };
}

/** Write the deck into the database as it is, with no page load in between (a load would sweep the pictures). */
async function storeDeck(page: Page, deck: Json): Promise<void> {
  await page.evaluate(async (stored) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cue');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error('The deck database did not open'));
      };
    });
    await new Promise<void>((done, fail) => {
      const transaction = db.transaction('decks', 'readwrite');
      transaction.objectStore('decks').put(stored);
      transaction.oncomplete = () => {
        done();
      };
      transaction.onerror = () => {
        fail(new Error('The deck was not stored'));
      };
    });
    db.close();
  }, deck);
}

test('Given a deck of 30 slides with a picture each, When it is exported as a web page, Then the file is saved in under 10 seconds', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  // The database is made by opening any deck. The pictures and the real deck are then stored together,
  // before the app starts again: at its start it sweeps pictures that no deck shows.
  await seedDeck(page, thirtySlides(['none']), DECK);
  const { hashes, bytes } = await storePictures(page, PICTURES);
  await storeDeck(page, thirtySlides(hashes));
  await page.goto(`/#/deck/${DECK}`);
  await page.reload();
  await expect(page.getByRole('option', { name: 'Slide 30', exact: true })).toBeVisible();
  await page.waitForFunction(() => document.querySelector('[data-fonts="loading"]') === null);

  const started = Date.now();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export deck' });
  const button = dialog.getByRole('button', { name: 'Export web page' });
  await expect(button).toBeEnabled({ timeout: 120_000 });
  const download = page.waitForEvent('download');
  await button.click();
  const taken = await download;
  const elapsed = Date.now() - started;
  expect(await taken.path()).toBeTruthy();

  report(info, 'export-30-slides', {
    elapsedMs: elapsed,
    pictureMB: Math.round(bytes / 1048.576) / 1000,
  });
  if (!enforced(info)) return;
  expect(elapsed).toBeLessThan(budgets.export.thirtySlidesMs);
});
