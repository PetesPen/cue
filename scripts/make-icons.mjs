// Makes the app icons (public/) from the working logo (brand/working-logo.png).
// Usage: npm run icons
// The logo is drawn on a canvas in Chromium (already installed for the end-to-end tests), so soft edges
// and transparency come out right at every size. When Peter gives final art, replace the file in brand/
// and run this again: nothing else changes.
/* global Image, document -- the drawing function runs in the browser page, not in Node */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const source = readFileSync('brand/working-logo.png');

// The page draws the logo into a square of a given size. `fill` is how much of the square the logo
// fills (its longest side); `background` is a colour or nothing (transparent).
const draw = ({ data, size, fill, background }) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Find what is drawn (any pixel that is not nearly transparent), so the logo is centred by its
      // artwork and not by the empty margin of the file.
      const probe = document.createElement('canvas');
      probe.width = image.width;
      probe.height = image.height;
      const probeContext = probe.getContext('2d');
      probeContext.drawImage(image, 0, 0);
      const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
      let left = probe.width;
      let top = probe.height;
      let right = 0;
      let bottom = 0;
      for (let y = 0; y < probe.height; y += 1) {
        for (let x = 0; x < probe.width; x += 1) {
          if (pixels[(y * probe.width + x) * 4 + 3] > 24) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      const width = right - left + 1;
      const height = bottom - top + 1;
      const scale = (size * fill) / Math.max(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, size, size);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        image,
        left,
        top,
        width,
        height,
        (size - width * scale) / 2,
        (size - height * scale) / 2,
        width * scale,
        height * scale,
      );
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    image.onerror = () => {
      reject(new Error('The logo could not be read.'));
    };
    image.src = `data:image/png;base64,${data}`;
  });

// The app's own light background (design/tokens.css), behind the icons that cannot be transparent.
const BACKGROUND = '#F4F8F1';

const icons = [
  // Any shape, transparent: the logo fills most of the square.
  { file: 'public/icon-192.png', size: 192, fill: 0.84 },
  { file: 'public/icon-512.png', size: 512, fill: 0.84 },
  // Maskable: the system cuts the icon to a circle or a rounded square, so the logo stays inside the
  // safe zone (the middle 80 percent) on a full background.
  { file: 'public/icon-maskable-512.png', size: 512, fill: 0.62, background: BACKGROUND },
  // Apple devices fill a transparent icon with black, so this one has a background.
  { file: 'public/apple-touch-icon.png', size: 180, fill: 0.74, background: BACKGROUND },
  { file: 'public/favicon-48.png', size: 48, fill: 0.92 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>icons</title>');
  const data = source.toString('base64');
  for (const icon of icons) {
    const made = await page.evaluate(draw, { data, ...icon });
    writeFileSync(icon.file, Buffer.from(made, 'base64'));
    console.log(`${icon.file} (${String(icon.size)} px)`);
  }
} finally {
  await browser.close();
}
