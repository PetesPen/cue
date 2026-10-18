import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  createDeck,
  createShape,
  createSlide,
  createStep,
  PAGE_KEYS,
  SHOW_KEYS,
  type Deck,
  type Env,
} from '@/model';
import type { PageData } from './data';
import { mountPage } from './page';

// SV-4: the exported page's program, mounted in a real browser. It is the program of the file, so what
// these tests press and read is what a person gets from the exported page.

const env: Env = { newId: () => 'id', now: () => 0 };
const box = { x: 200, y: 100, width: 400, height: 300 };

/** Three slides: the second has two clicks and notes; the third arrives with Fade. */
const deck: Deck = {
  ...createDeck(env, 'A short talk'),
  slides: [
    { ...createSlide('a'), notes: 'Welcome everyone.' },
    {
      ...createSlide('b'),
      notes: 'The problem, in one sentence.',
      elements: [createShape('e1', 'rectangle', box), createShape('e2', 'ellipse', box)],
      animations: [createStep('s1', 'e1', 'appear'), createStep('s2', 'e2', 'appear')],
    },
    {
      ...createSlide('c'),
      notes: '',
      transition: { kind: 'fade', from: 'right', duration: 0.2 },
    },
  ],
};

const unmounts: (() => void)[] = [];
const roots: HTMLElement[] = [];

function mount(options: { notes?: boolean; startAt?: number; licences?: string } = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  roots.push(root);
  const data: PageData = {
    deck,
    notes: options.notes ?? true,
    licences: options.licences ?? '',
    images: new Map(),
  };
  unmounts.push(mountPage(root, data, options.startAt));
  return root;
}

afterEach(() => {
  while (unmounts.length > 0) unmounts.pop()?.();
  while (roots.length > 0) roots.pop()?.remove();
});

const place = (root: HTMLElement) => ({
  slide: root.dataset.slide,
  click: root.dataset.click,
  blank: root.dataset.blank,
});

describe('the exported page shows the deck (SV-4)', () => {
  test('Given a deck, When the page opens, Then the first slide is drawn at 16:9 and the count says so', () => {
    const root = mount();
    expect(root.querySelector('.cue-slide')).not.toBeNull();
    expect(root.querySelector('.cp-count')?.textContent).toBe('1 / 3');
    expect(place(root)).toEqual({ slide: '1', click: '0', blank: 'none' });
    const frame = root.querySelector('.cp-frame')?.getBoundingClientRect();
    expect(frame?.width && frame.height ? frame.width / frame.height : 0).toBeCloseTo(16 / 9, 2);
  });

  test('Given an address with a slide number, When the page opens, Then it starts there', () => {
    expect(place(mount({ startAt: 3 })).slide).toBe('3');
    expect(place(mount({ startAt: 99 })).slide).toBe('3');
    expect(place(mount({ startAt: 0 })).slide).toBe('1');
  });

  test('Given the page is open, Then it names the slide for a screen reader and is in the address', () => {
    const root = mount();
    expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe('Slide 1 of 3');
    expect(root.querySelector('main')?.getAttribute('aria-label')).toBe('A short talk');
    expect(location.hash).toBe('#1');
  });
});

describe('the keys of the show work in the page (SV-4)', () => {
  test('Given the show keys, When they are pressed, Then clicks come before slides, as in the show', async () => {
    const root = mount();
    await userEvent.keyboard('{ArrowRight}');
    expect(place(root)).toMatchObject({ slide: '2', click: '0' });
    await userEvent.keyboard('{ArrowRight}');
    expect(place(root)).toMatchObject({ slide: '2', click: '1' });
    await userEvent.keyboard(' ');
    expect(place(root)).toMatchObject({ slide: '2', click: '2' });
    await userEvent.keyboard('{PageDown}');
    expect(place(root)).toMatchObject({ slide: '3', click: '0' });
    await userEvent.keyboard('{ArrowRight}');
    expect(place(root)).toMatchObject({ slide: '3', click: '0' });
    // Back shows the slide before with every click played.
    await userEvent.keyboard('{ArrowLeft}');
    expect(place(root)).toMatchObject({ slide: '2', click: '2' });
    await userEvent.keyboard('{Backspace}');
    expect(place(root)).toMatchObject({ slide: '2', click: '1' });
  });

  test('Given Home, End and a number then Enter, Then the page jumps', async () => {
    const root = mount();
    await userEvent.keyboard('{End}');
    expect(place(root).slide).toBe('3');
    await userEvent.keyboard('{Home}');
    expect(place(root).slide).toBe('1');
    await userEvent.keyboard('2{Enter}');
    expect(place(root)).toMatchObject({ slide: '2', click: '0' });
    await userEvent.keyboard('9{Enter}');
    expect(place(root).slide).toBe('3');
  });

  test('Given B and W, Then the screen is blanked, and the first move only brings the slide back', async () => {
    const root = mount();
    await userEvent.keyboard('b');
    expect(place(root).blank).toBe('black');
    expect(root.querySelector<HTMLElement>('.cp-blank')?.hidden).toBe(false);
    await userEvent.keyboard('w');
    expect(place(root).blank).toBe('white');
    await userEvent.keyboard('{ArrowRight}');
    expect(place(root)).toEqual({ slide: '1', click: '0', blank: 'none' });
    expect(root.querySelector<HTMLElement>('.cp-blank')?.hidden).toBe(true);
  });

  test('Given a key with Ctrl, Then the page leaves it to the browser', async () => {
    const root = mount();
    await userEvent.keyboard('{Control>}{ArrowRight}{/Control}');
    expect(place(root).slide).toBe('1');
  });

  test('Given every key of the show, Then the page lists it (the table is shared)', async () => {
    // The page's handler is a record over every action, so a new key in the table cannot be forgotten:
    // here, the table's actions are the ones the page's list of keys draws.
    const root = mount();
    await userEvent.keyboard('?');
    const listed = root.querySelectorAll('.cp-keys-caps').length;
    expect(listed).toBe(SHOW_KEYS.length - 1 + PAGE_KEYS.length);
  });
});

describe('the notes of the page (SV-4)', () => {
  test('Given the notes are in the file, When N is pressed, Then the notes of the slide show beside it, and N hides them', async () => {
    const root = mount();
    const panel = root.querySelector<HTMLElement>('.cp-notes');
    expect(panel?.hidden).toBe(true);
    await userEvent.keyboard('n');
    expect(panel?.hidden).toBe(false);
    expect(panel?.textContent).toContain('Welcome everyone.');
    expect(panel?.textContent).toContain('Notes · Slide 1 of 3');
    expect(panel?.textContent).toContain('Next · Slide 2');
    await userEvent.keyboard('{ArrowRight}');
    expect(panel?.textContent).toContain('The problem, in one sentence.');
    expect(panel?.textContent).toContain('Next · Click 1 of 2');
    await userEvent.keyboard('{End}');
    expect(panel?.textContent).toContain('No notes for this slide.');
    await userEvent.keyboard('N');
    expect(panel?.hidden).toBe(true);
  });

  test('Given the notes are open, When Esc is pressed, Then they close', async () => {
    const root = mount();
    await userEvent.keyboard('n');
    await userEvent.keyboard('{Escape}');
    expect(root.querySelector<HTMLElement>('.cp-notes')?.hidden).toBe(true);
  });

  test('Given the notes are not in the file, Then there is no Notes button and N does nothing', async () => {
    const root = mount({ notes: false });
    expect(root.querySelector<HTMLElement>('button[aria-label="Notes"]')?.hidden).toBe(true);
    await userEvent.keyboard('n');
    expect(root.querySelector<HTMLElement>('.cp-notes')?.hidden).toBe(true);
  });
});

describe('the bar, the key list and touch (SV-4)', () => {
  test('Given the bar, When its buttons are pressed, Then the page moves', async () => {
    const root = mount();
    await userEvent.click(root.querySelector<HTMLElement>('button[aria-label="Next"]') ?? root);
    expect(place(root).slide).toBe('2');
    await userEvent.click(root.querySelector<HTMLElement>('button[aria-label="Previous"]') ?? root);
    expect(place(root).slide).toBe('1');
  });

  test('Given ?, Then the keys are listed and Esc closes the list', async () => {
    const root = mount({ licences: 'Figtree\n\nSIL Open Font License' });
    await userEvent.keyboard('?');
    const dialog = root.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain('Next click or slide');
    expect(dialog?.textContent).toContain('Show or hide the notes');
    expect(dialog?.textContent).toContain('Font licences');
    expect(dialog?.textContent).toContain('SIL Open Font License');
    // While the list is open the keys are the list's: the page does not move.
    await userEvent.keyboard('{ArrowRight}');
    expect(place(root).slide).toBe('1');
    await userEvent.keyboard('{Escape}');
    expect(dialog?.open).toBe(false);
  });

  test('Given no font licences, Then the list has no licence section', async () => {
    const root = mount();
    await userEvent.keyboard('?');
    expect(root.querySelector('dialog')?.textContent).not.toContain('Font licences');
  });

  test('Given a tap on the right, a tap on the left and swipes, Then the page moves on and back', () => {
    const root = mount();
    const area = root.querySelector<HTMLElement>('.cp-area');
    if (!area) throw new Error('no slide area');
    const box = area.getBoundingClientRect();
    const touch = (type: string, x: number, y: number) =>
      area.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }),
      );
    const tap = (x: number) => {
      touch('pointerdown', x, box.top + 100);
      touch('pointerup', x, box.top + 100);
    };
    const swipe = (from: number, to: number) => {
      touch('pointerdown', from, box.top + 100);
      touch('pointerup', to, box.top + 110);
    };

    tap(box.left + box.width * 0.8);
    expect(place(root).slide).toBe('2');
    tap(box.left + box.width * 0.1);
    expect(place(root).slide).toBe('1');
    swipe(box.left + 300, box.left + 100);
    expect(place(root).slide).toBe('2');
    swipe(box.left + 100, box.left + 300);
    expect(place(root).slide).toBe('1');
    // A short drag is neither: it does nothing.
    swipe(box.left + 100, box.left + 130);
    expect(place(root).slide).toBe('1');
  });

  test('Given a page that is taken down, Then its listeners are gone and the keys do nothing', async () => {
    const root = mount();
    unmounts.pop()?.();
    await userEvent.keyboard('{ArrowRight}');
    expect(root.childElementCount).toBe(0);
  });
});

describe('the pictures of the page (SV-4)', () => {
  test('Given a picture block, When a slide needs it, Then it is made from the block and drawn', async () => {
    const { imageSourceFor } = await import('./data');
    const block = document.createElement('script');
    // The smallest PNG: one transparent pixel.
    block.textContent =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHm9xwAAAAABJRU5ErkJggg==';
    const source = imageSourceFor(new Map([['h', { type: 'image/png', block }]]));
    expect(source.url('h')).toBeUndefined();
    await new Promise<void>((ready) => {
      source.load('h', ready);
    });
    expect(source.url('h')).toMatch(/^blob:/);
    // Once made, the text is let go.
    expect(block.textContent).toBe('');
    source.release();
    expect(source.url('h')).toBeUndefined();
  });
});
