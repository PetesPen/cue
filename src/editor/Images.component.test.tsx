import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createImage, createSlide, imageHashes, isImage, type Deck } from '@/model';
import type { DeckStore, StoredImage } from '@/storage';
import { EditorApp } from './EditorApp';
import { closeTestStores, createTestStore, deckWithSlides } from './test-helpers';

afterEach(() => {
  closeTestStores();
  vi.restoreAllMocks();
  window.location.hash = '';
});

// Real picture files, made in the browser, so each format is a real file with the real bytes.

async function canvasFile(
  type: 'image/png' | 'image/jpeg' | 'image/webp',
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void = (context) => {
    context.fillStyle = '#17803F';
    context.fillRect(0, 0, width, height);
  },
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  paint(context);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type);
  });
  if (!blob) throw new Error(`this browser cannot make a ${type}`);
  return new File([blob], `picture.${type.split('/')[1] ?? 'img'}`, { type: blob.type });
}

const png = (width = 400, height = 300) => canvasFile('image/png', width, height);

/** A 1 x 1 GIF. */
function gif(): File {
  const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='), (c) =>
    c.charCodeAt(0),
  );
  return new File([bytes], 'dot.gif', { type: 'image/gif' });
}

function svg(): File {
  return new File(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#F5C542"/></svg>',
    ],
    'logo.svg',
    { type: 'image/svg+xml' },
  );
}

async function openWith(store: DeckStore, slides = 1) {
  await store.save(deckWithSlides(slides));
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

/** What choosing files in the file chooser does. */
function choose(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('no file chooser');
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  input.files = data.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function dropOnSlide(files: File[], at?: { x: number; y: number }) {
  const frame = document.querySelector<HTMLElement>('.slide-frame');
  if (!frame) throw new Error('no slide');
  const box = frame.getBoundingClientRect();
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  const point = at ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  frame.dispatchEvent(
    new DragEvent('dragover', {
      dataTransfer: data,
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
    }),
  );
  frame.dispatchEvent(
    new DragEvent('drop', {
      dataTransfer: data,
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
    }),
  );
}

function pasteFiles(files: File[]) {
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  (document.activeElement ?? document.body).dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

const pictures = () => [
  ...document.querySelectorAll<HTMLElement>('.slide-frame [data-kind="image"]'),
];
const stored = async (store: DeckStore) => (await store.load('deck'))?.slides[0]?.elements ?? [];

/** Wait for the picture on the slide to be drawn (its bytes loaded and decoded). */
async function drawn(node: HTMLElement | undefined) {
  await expect
    .poll(() => {
      const img = node?.querySelector('img');
      return img?.complete === true && img.naturalWidth > 0;
    })
    .toBe(true);
}

// EL-4: add images

test.each([
  ['PNG', () => png(400, 300), 'image/png', 400, 300],
  ['JPEG', () => canvasFile('image/jpeg', 500, 250), 'image/jpeg', 500, 250],
  ['WebP', () => canvasFile('image/webp', 360, 360), 'image/webp', 360, 360],
  ['GIF', () => Promise.resolve(gif()), 'image/gif', 1, 1],
  ['SVG', () => Promise.resolve(svg()), 'image/svg+xml', 320, 160],
])(
  'Given a %s file, When it is chosen, Then it appears in the middle of the slide at its own proportions',
  async (_name, make, type, width, height) => {
    const store = createTestStore();
    await openWith(store);

    choose(await make());

    await expect.poll(() => pictures().length).toBe(1);
    const [element] = await vi.waitFor(
      async () => {
        const found = await stored(store);
        if (found.length === 0) throw new Error('not saved yet');
        return found;
      },
      { timeout: 4000 },
    );
    expect(element && isImage(element)).toBe(true);
    if (!element) return;
    expect(element.width / element.height).toBeCloseTo(width / height, 1);
    // In the middle of the slide.
    expect(element.x + element.width / 2).toBeCloseTo(960, -1);
    expect(element.y + element.height / 2).toBeCloseTo(540, -1);
    const image = await store.loadImage(isImage(element) ? element.hash : '');
    expect(image?.type).toBe(type);
    await drawn(pictures()[0]);
  },
);

test('Given a picture, When it is chosen, Then it is selected and the panel calls it an image', async () => {
  const store = createTestStore();
  const screen = await openWith(store);

  choose(await png());

  await expect.poll(() => document.querySelector('.sel-chip')?.textContent).toContain('Image');
  await expect.element(screen.getByRole('textbox', { name: 'Image description' })).toBeVisible();
  // A picture has no fill and no text of its own.
  await expect.element(screen.getByRole('group', { name: 'Fill' })).not.toBeInTheDocument();
  await expect.element(screen.getByRole('group', { name: 'Text style' })).not.toBeInTheDocument();
});

test('Given a picture file dropped on the slide, When it lands, Then it is centred on the drop point', async () => {
  const store = createTestStore();
  await openWith(store);
  const frame = document.querySelector<HTMLElement>('.slide-frame')?.getBoundingClientRect();
  if (!frame) throw new Error('no slide');

  // A quarter across and a third down the slide: (480, 360) in slide pixels.
  dropOnSlide([await png(400, 200)], {
    x: frame.left + frame.width * 0.25,
    y: frame.top + frame.height / 3,
  });

  await expect.poll(async () => (await stored(store)).length, { timeout: 4000 }).toBe(1);
  const [element] = await stored(store);
  expect((element?.x ?? 0) + (element?.width ?? 0) / 2).toBeCloseTo(480, -1);
  expect((element?.y ?? 0) + (element?.height ?? 0) / 2).toBeCloseTo(360, -1);
});

test('Given a picture copied from the clipboard, When it is pasted, Then it is added', async () => {
  const store = createTestStore();
  await openWith(store);
  await userEvent.click(document.querySelector<HTMLElement>('.slide-frame') ?? document.body);

  pasteFiles([await png(300, 300)]);

  await expect.poll(() => pictures().length).toBe(1);
});

test('Given three files chosen at once, Then all three are added, one step apart, in one undo', async () => {
  const store = createTestStore();
  const screen = await openWith(store);

  choose(await png(300, 200), await png(200, 300), gif());

  await expect.poll(() => pictures().length).toBe(3);
  const places = pictures().map((p) => p.style.left);
  expect(new Set(places).size).toBe(3);
  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.poll(() => pictures().length).toBe(0);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given a picture bigger than the slide, When it is added, Then it is shrunk to fit with room round it', async () => {
  const store = createTestStore();
  await openWith(store);

  choose(await png(2400, 1600));

  await expect.poll(async () => (await stored(store)).length, { timeout: 5000 }).toBe(1);
  const [element] = await stored(store);
  expect(element?.width).toBeLessThanOrEqual(1536);
  expect(element?.height).toBeLessThanOrEqual(864);
  expect((element?.width ?? 0) / (element?.height ?? 1)).toBeCloseTo(1.5, 2);
});

test('Given a picture of 5000 x 3000, When it is added, Then it is scaled down, the toast says so, and Undo reverses it', async () => {
  const store = createTestStore();
  const screen = await openWith(store);

  choose(await png(5000, 3000));

  await expect.element(screen.getByText('Image scaled to fit')).toBeVisible();
  await expect.element(screen.getByText('5000 × 3000 became', { exact: false })).toBeVisible();
  await expect.poll(async () => (await stored(store)).length, { timeout: 5000 }).toBe(1);
  const [element] = await stored(store);
  const kept = await store.loadImage(element && isImage(element) ? element.hash : '');
  // The stored picture is the scaled one: 2560 on its longer side, 1536 on the other.
  const decoded = await createImageBitmap(
    new Blob([kept?.bytes ?? new Uint8Array()], { type: kept?.type ?? '' }),
  );
  expect([decoded.width, decoded.height]).toEqual([2560, 1536]);

  await screen.getByRole('button', { name: 'Undo', exact: true }).last().click();

  await expect.poll(() => pictures().length).toBe(0);
  await expect.element(screen.getByText('Image scaled to fit')).not.toBeInTheDocument();
});

test('Given a picture inside the size limit, When it is added, Then there is no scaling toast and the bytes are kept as they came', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  const file = await png(800, 600);

  choose(file);

  await expect.poll(async () => (await stored(store)).length, { timeout: 4000 }).toBe(1);
  await expect.element(screen.getByText('Image scaled to fit')).not.toBeInTheDocument();
  const [element] = await stored(store);
  const kept = await store.loadImage(element && isImage(element) ? element.hash : '');
  expect(kept?.bytes.length).toBe(file.size);
});

test('Given a file that is not a picture, When it is chosen, Then a clear message appears and nothing is added or saved', async () => {
  const store = createTestStore();
  const screen = await openWith(store);

  choose(new File(['hello, this is text'], 'notes.png', { type: 'image/png' }));

  await expect.element(screen.getByText('That file isn’t a picture Cue can use')).toBeVisible();
  await expect
    .element(screen.getByText('notes.png: use PNG, JPEG, GIF, SVG or WebP.'))
    .toBeVisible();
  expect(pictures()).toHaveLength(0);
  await expect.element(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('Given a damaged picture, When it is chosen, Then it says it could not be read', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  const real = await png(50, 50);
  const bytes = new Uint8Array(await real.arrayBuffer());
  // The start of a real PNG and then rubbish.
  const damaged = new File([bytes.slice(0, 40), new Uint8Array(20)], 'broken.png', {
    type: 'image/png',
  });

  choose(damaged);

  await expect.element(screen.getByText('That picture couldn’t be read')).toBeVisible();
  expect(pictures()).toHaveLength(0);
});

test('Given one good file and one bad one, When both are chosen, Then the good one is added and the bad one is reported', async () => {
  const store = createTestStore();
  const screen = await openWith(store);

  choose(await png(300, 200), new File(['nope'], 'readme.txt', { type: 'text/plain' }));

  await expect.poll(() => pictures().length).toBe(1);
  await expect.element(screen.getByText('That file isn’t a picture Cue can use')).toBeVisible();
});

// SV-1 and EL-4: pictures are saved with the deck

test('Given a picture on a slide, When the deck is saved and opened again, Then the picture is there and drawn', async () => {
  const store = createTestStore();
  const first = await openWith(store);
  choose(await png(500, 400));
  await expect.poll(async () => (await stored(store)).length, { timeout: 4000 }).toBe(1);
  await first.unmount();

  window.location.hash = '#/deck/deck';
  await render(<EditorApp store={store} />);

  await expect.poll(() => pictures().length).toBe(1);
  await drawn(pictures()[0]);
  const [element] = await stored(store);
  const loaded = await store.load('deck');
  expect(loaded && imageHashes(loaded).size).toBe(1);
  expect(
    element && isImage(element) && (await store.loadImage(element.hash))?.bytes.length,
  ).toBeGreaterThan(0);
});

test('Given a picture added and a store that is full, When the deck cannot be saved, Then neither the deck change nor the picture is half-saved', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  const save = vi.spyOn(store, 'save').mockRejectedValue(quota);

  choose(await png(500, 400));

  await expect.poll(() => pictures().length).toBe(1);
  await expect.element(screen.getByText('Changes can’t be saved.', { exact: false })).toBeVisible();
  expect(save).toHaveBeenCalled();
  // Nothing reached the store: the deck has no picture and no picture bytes were written.
  const call = save.mock.calls[0];
  expect(call?.[1]?.length).toBe(1);
  expect((await store.load('deck'))?.slides[0]?.elements).toHaveLength(0);
});

test('Given a failed save of a picture, When storage works again and Try again is pressed, Then the deck and the picture are saved together', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  const real = store.save.bind(store);
  const save = vi
    .spyOn(store, 'save')
    .mockRejectedValueOnce(quota)
    .mockImplementation((deck, images) => real(deck, images));
  choose(await png(500, 400));
  await expect.element(screen.getByText('Changes can’t be saved.', { exact: false })).toBeVisible();

  await screen.getByRole('button', { name: 'Try again' }).click();

  await expect.poll(async () => (await stored(store)).length, { timeout: 4000 }).toBe(1);
  const [element] = await stored(store);
  expect(element && isImage(element) && (await store.loadImage(element.hash))).toBeTruthy();
  expect(save).toHaveBeenCalledTimes(2);
});

test('Given a picture that was added and then undone before saving, When the deck is saved, Then the picture is not stored', async () => {
  const store = createTestStore();
  await openWith(store);
  const save = vi.spyOn(store, 'save');
  choose(await png(500, 400));
  await expect.poll(() => pictures().length).toBe(1);
  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.poll(() => pictures().length).toBe(0);
  await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
  await userEvent.keyboard('{Control>}z{/Control}');

  await expect.poll(() => save.mock.calls.length, { timeout: 4000 }).toBeGreaterThan(0);
  const saved = save.mock.calls.flatMap<StoredImage>((call) => call[1] ?? []);
  expect(saved).toHaveLength(0);
});

test('Given a photo no deck shows left in storage, When the app opens, Then it is swept away and the photos that decks show stay', async () => {
  const store = createTestStore();
  const deck: Deck = {
    ...deckWithSlides(1),
    slides: [
      {
        ...createSlide('deck-1'),
        elements: [createImage('p', 'kept', { x: 0, y: 0, width: 10, height: 10 })],
      },
    ],
  };
  const image = (hash: string): StoredImage => ({
    hash,
    type: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
  });
  await store.save(deck, [image('kept'), image('lost')]);

  window.location.hash = '#/deck/deck';
  await render(<EditorApp store={store} />);

  await expect.poll(async () => await store.loadImage('lost'), { timeout: 4000 }).toBeUndefined();
  expect(await store.loadImage('kept')).toBeDefined();
});

// Pictures are elements like the others

test('Given a picture, When its description is typed in the panel, Then it is saved with it and drawn as the alt text', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  choose(await png(300, 200));
  await expect.poll(() => pictures().length).toBe(1);

  const field = screen.getByRole('textbox', { name: 'Image description' });
  await field.fill('The team at the offsite');
  await userEvent.tab();

  await expect
    .poll(
      async () => {
        const [first] = await stored(store);
        return first !== undefined && isImage(first);
      },
      { timeout: 4000 },
    )
    .toBe(true);
  await expect.poll(() => pictures()[0]?.querySelector('img')?.alt).toBe('The team at the offsite');
  const [element] = await stored(store);
  expect(element && isImage(element) && element.alt).toBe('The team at the offsite');
});

test('Given a picture, When it is faded, Then the whole picture fades and keeps its own transparency', async () => {
  const store = createTestStore();
  const screen = await openWith(store);
  choose(await png(300, 200));
  await expect.poll(() => pictures().length).toBe(1);

  await screen.getByRole('textbox', { name: 'Opacity percent' }).fill('40');
  await userEvent.keyboard('{Enter}');

  await expect.poll(() => pictures()[0]?.style.opacity).toBe('0.4');
});

test('Given a slide with a picture, When the slide is duplicated, Then the copy shows the same picture', async () => {
  const store = createTestStore();
  await openWith(store);
  choose(await png(300, 200));
  await expect.poll(() => pictures().length).toBe(1);
  await expect.poll(async () => (await stored(store)).length, { timeout: 4000 }).toBe(1);
  const rail = document.querySelector<HTMLElement>('.rail-item');
  if (!rail) throw new Error('no rail');
  await userEvent.click(rail);

  await userEvent.keyboard('{Control>}d{/Control}');

  await expect
    .poll(async () => (await store.load('deck'))?.slides.length, { timeout: 4000 })
    .toBe(2);
  const slides = (await store.load('deck'))?.slides ?? [];
  const hashes = slides.map((slide) => slide.elements.map((e) => (isImage(e) ? e.hash : '')));
  expect(hashes[0]).toEqual(hashes[1]);
  expect(hashes[0]?.[0]).not.toBe('');
});
