import { expect, test } from 'vitest';
import { ImageImportError, MAX_KEPT_ORIGINAL, importImage } from './importImage';

// EL-4: turning real files into pictures, in a real browser: what the bytes are, how big, scaled or
// not, whether the original is kept, and what the hash is.

async function canvasFile(
  type: 'image/png' | 'image/jpeg' | 'image/webp',
  width: number,
  height: number,
  noise = false,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  if (noise) {
    // Random pixels do not compress, so the file is big.
    const pixels = context.createImageData(width, height);
    crypto.getRandomValues(pixels.data.subarray(0, 65536));
    for (let i = 65536; i < pixels.data.length; i += 65536) {
      pixels.data.copyWithin(i, 0, Math.min(65536, pixels.data.length - i));
    }
    for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = 255;
    context.putImageData(pixels, 0, 0);
  } else {
    context.fillStyle = '#17803F';
    context.fillRect(0, 0, width, height);
  }
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type);
  });
  if (!blob) throw new Error(`cannot make ${type}`);
  return new File([blob], 'picture', { type: blob.type });
}

const decodeSize = async (bytes: Uint8Array<ArrayBuffer>, type: string) => {
  const bitmap = await createImageBitmap(new Blob([bytes], { type }));
  return [bitmap.width, bitmap.height];
};

test('Given a PNG inside the limit, When it is imported, Then it is kept exactly as it is, with its size and a hash of its bytes', async () => {
  const file = await canvasFile('image/png', 640, 480);

  const imported = await importImage(file);

  expect(imported).toMatchObject({ width: 640, height: 480 });
  expect(imported.image.type).toBe('image/png');
  expect(imported.image.bytes.length).toBe(file.size);
  expect(imported.scaledFrom).toBeUndefined();
  expect(imported.original).toBeUndefined();
  expect(imported.image.hash).toMatch(/^[0-9a-f]{64}$/);
});

test('Given the same file imported twice, When the hashes are compared, Then they are equal; a different picture has a different hash', async () => {
  const file = await canvasFile('image/png', 100, 100);
  const other = await canvasFile('image/png', 101, 100);

  const [a, b, c] = await Promise.all([importImage(file), importImage(file), importImage(other)]);

  expect(a.image.hash).toBe(b.image.hash);
  expect(a.image.hash).not.toBe(c.image.hash);
});

test.each(['image/png', 'image/jpeg', 'image/webp'] as const)(
  'Given a %s over the limit, When it is imported, Then it is scaled to 2560 on its longer side, in proportion, and the original is kept',
  async (type) => {
    const file = await canvasFile(type, 3200, 2000);

    const imported = await importImage(file);

    expect(imported.scaledFrom).toEqual({ width: 3200, height: 2000 });
    expect([imported.width, imported.height]).toEqual([2560, 1600]);
    expect(await decodeSize(imported.image.bytes, imported.image.type)).toEqual([2560, 1600]);
    expect(imported.original?.bytes.length).toBe(file.size);
    expect(imported.original?.type).toBe(file.type);
    expect(imported.original?.hash).toBe(imported.image.hash);
  },
);

test('Given a picture over the limit whose file is large, When it is imported, Then it is scaled but the original is not kept', async () => {
  const file = await canvasFile('image/png', 3000, 3000, true);
  expect(file.size).toBeGreaterThan(MAX_KEPT_ORIGINAL);

  const imported = await importImage(file);

  expect(imported.scaledFrom).toEqual({ width: 3000, height: 3000 });
  expect(imported.original).toBeUndefined();
});

test('Given a GIF and an SVG, When they are imported, Then they are kept as they are whatever their size', async () => {
  const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='), (c) =>
    c.charCodeAt(0),
  );
  const gif = new File([bytes], 'dot.gif');
  const big = new File(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="3000"><rect width="5000" height="3000"/></svg>',
    ],
    'big.svg',
  );

  const [a, b] = await Promise.all([importImage(gif), importImage(big)]);

  expect(a.image.type).toBe('image/gif');
  expect(a.image.bytes).toEqual(bytes);
  expect(b.image.type).toBe('image/svg+xml');
  expect([b.width, b.height]).toEqual([5000, 3000]);
  expect(b.scaledFrom).toBeUndefined();
});

test('Given a file whose name says PNG but whose bytes are text, When it is imported, Then it is refused as not a picture', async () => {
  const error = await importImage(new File(['hello'], 'fake.png', { type: 'image/png' })).catch(
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(ImageImportError);
  expect(error instanceof ImageImportError && error.reason).toBe('notImage');
});

test('Given a PNG that starts right and then turns to rubbish, When it is imported, Then it says it cannot be read', async () => {
  const whole = new Uint8Array(await (await canvasFile('image/png', 200, 200)).arrayBuffer());
  // The start of a real PNG and then rubbish.
  const damaged = new File([whole.slice(0, 40), new Uint8Array(20)], 'cut.png');
  const error = await importImage(damaged).catch((e: unknown) => e);

  expect(error instanceof ImageImportError && error.reason).toBe('unreadable');
});

test('Given a file bigger than the limit, When it is imported, Then it is refused before it is read', async () => {
  const huge = new File([new Uint8Array(41 * 1024 * 1024)], 'huge.png');

  const error = await importImage(huge).catch((e: unknown) => e);

  expect(error instanceof ImageImportError && error.reason).toBe('tooBig');
});
