import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { createShape, type Deck, type SlideElement } from '@/model';
import type { DeckStore } from '@/storage';
import { EditorApp } from './EditorApp';
import { SHORTCUTS, displayKeys, listed, shortcutById } from './shortcuts';
import {
  closeTestStores,
  createTestStore,
  deckWithSlides,
  railSlideIds,
  selectedSlideId,
} from './test-helpers';
import { clearInternalClipboard } from './useClipboard';

beforeEach(clearInternalClipboard);
afterEach(() => {
  closeTestStores();
  window.location.hash = '';
  vi.restoreAllMocks();
});

const rectangle = (id: string, x: number, y = 300) =>
  createShape(id, 'rectangle', { x, y, width: 300, height: 200 });

async function openWith(store: DeckStore, slides: number, ...elements: SlideElement[]) {
  const base = deckWithSlides(slides);
  const deck: Deck = {
    ...base,
    slides: base.slides.map((slide, i) => (i === 0 ? { ...slide, elements } : slide)),
  };
  await store.save(deck);
  window.location.hash = '#/deck/deck';
  const screen = await render(<EditorApp store={store} />);
  await expect.element(screen.getByRole('option', { name: 'Slide 1', exact: true })).toBeVisible();
  return screen;
}

const node = (id: string) => {
  const found = document.querySelector<HTMLElement>(`.slide-frame [data-element-id="${id}"]`);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const order = () =>
  [...document.querySelectorAll<HTMLElement>('.slide-frame .cue-element')].map(
    (e) => e.dataset.elementId,
  );
const frame = () => {
  const found = document.querySelector<HTMLElement>('.slide-frame');
  if (!found) throw new Error('no slide');
  return found;
};
const slideCount = () => document.querySelectorAll('.rail-item').length;
const pick = (id: string) => userEvent.click(node(id));

// Each shortcut of the table does what its name says (UX-2) ----------------------------------------

test('Given a slide, When Ctrl+M is pressed (New slide), Then a slide is added', async () => {
  await openWith(createTestStore(), 1);

  await userEvent.keyboard('{Control>}m{/Control}');

  await expect.poll(slideCount).toBe(2);
});

test('Given a slide with a shape, When Ctrl+Shift+D is pressed (Duplicate slide), Then a copy follows it with the shape', async () => {
  await openWith(createTestStore(), 1, rectangle('a', 100));

  await userEvent.keyboard('{Control>}{Shift>}d{/Shift}{/Control}');

  await expect.poll(slideCount).toBe(2);
  await expect.poll(selectedSlideId).not.toBe('deck-1');
  expect(document.querySelectorAll('.slide-frame .cue-element')).toHaveLength(1);
});

test('Given two slides and the rail focused, When Delete is pressed (Delete slide), Then the slide is removed', async () => {
  const screen = await openWith(createTestStore(), 2);
  screen.getByRole('option', { name: 'Slide 2', exact: true }).element().focus();
  await userEvent.click(screen.getByRole('option', { name: 'Slide 2', exact: true }));

  await userEvent.keyboard('{Delete}');

  await expect.poll(slideCount).toBe(1);
});

test('Given two slides and nothing selected, When the down and up arrows are pressed (Previous or next slide), Then the slide changes', async () => {
  await openWith(createTestStore(), 2);
  frame().focus();

  await userEvent.keyboard('{ArrowDown}');
  await expect.poll(selectedSlideId).toBe(railSlideIds()[1]);
  await userEvent.keyboard('{ArrowUp}');

  await expect.poll(selectedSlideId).toBe(railSlideIds()[0]);
});

test('Given a selected shape, When an arrow key is pressed with a slide to go to, Then the shape moves and the slide stays (nudge wins)', async () => {
  await openWith(createTestStore(), 2, rectangle('a', 100));
  await pick('a');

  await userEvent.keyboard('{ArrowDown}');

  await expect.poll(() => node('a').style.top).toBe('301px');
  expect(selectedSlideId()).toBe(railSlideIds()[0]);
});

test.each([
  ['order.forward', '{Control>}]{/Control}', ['b', 'a', 'c']],
  ['order.front', '{Control>}{Shift>}]{/Shift}{/Control}', ['b', 'c', 'a']],
] as const)(
  'Given a selected shape at the back, When %s is pressed, Then it moves up in the order',
  async (_id, keys, expected) => {
    await openWith(
      createTestStore(),
      1,
      rectangle('a', 100),
      rectangle('b', 500),
      rectangle('c', 900),
    );
    await pick('a');

    await userEvent.keyboard(keys);

    await expect.poll(order).toEqual(expected);
  },
);

test.each([
  ['order.backward', '{Control>}[[{/Control}', ['a', 'c', 'b']],
  ['order.back', '{Control>}{Shift>}[[{/Shift}{/Control}', ['c', 'a', 'b']],
] as const)(
  'Given a selected shape at the front, When %s is pressed, Then it moves down in the order',
  async (_id, keys, expected) => {
    await openWith(
      createTestStore(),
      1,
      rectangle('a', 100),
      rectangle('b', 500),
      rectangle('c', 900),
    );
    await pick('c');

    await userEvent.keyboard(keys);

    await expect.poll(order).toEqual(expected);
  },
);

test('Given an edit, When Ctrl+Z and Ctrl+Shift+Z are pressed (Undo, Redo), Then it is undone and redone', async () => {
  await openWith(createTestStore(), 1, rectangle('a', 100));
  await pick('a');
  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => node('a').style.left).toBe('101px');

  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.poll(() => node('a').style.left).toBe('100px');
  await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

  await expect.poll(() => node('a').style.left).toBe('101px');
});

test('Given notes typed a moment ago, When Ctrl+S is pressed (Save now), Then they are saved at once, not after the pause', async () => {
  const store = createTestStore();
  const screen = await openWith(store, 1);
  await screen.getByRole('textbox', { name: 'Speaker notes text' }).fill('Say it twice.');

  await userEvent.keyboard('{Control>}s{/Control}');

  const saved = async () => (await store.load('deck'))?.slides[0]?.notes;
  await expect.poll(saved, { timeout: 250 }).toBe('Say it twice.');
});

test('Given the editor, When T is pressed (Text box), Then the text tool is armed', async () => {
  const screen = await openWith(createTestStore(), 1);

  await userEvent.keyboard('t');

  await expect
    .element(screen.getByRole('button', { name: 'Text', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
});

test('Given the editor, When S is pressed (Shape), Then a rectangle is ready to draw; after an ellipse was drawn, S arms the ellipse', async () => {
  const screen = await openWith(createTestStore(), 1);

  await userEvent.keyboard('s');
  await expect.element(screen.getByText(/to draw a rectangle/)).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await screen.getByRole('button', { name: 'Shape' }).click();
  await screen.getByRole('menuitem', { name: 'Ellipse', exact: true }).click();
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard('s');

  await expect.element(screen.getByText(/to draw an ellipse/)).toBeVisible();
});

test('Given the editor, When I is pressed (Image), Then the picture chooser opens', async () => {
  await openWith(createTestStore(), 1);
  const opened = vi.spyOn(HTMLInputElement.prototype, 'click');

  await userEvent.keyboard('i');

  await expect
    .poll(() =>
      opened.mock.contexts.some(
        (input) => input instanceof HTMLInputElement && input.type === 'file',
      ),
    )
    .toBe(true);
});

test('Given a selected shape, When Ctrl+D is pressed (Duplicate), Then a copy is added', async () => {
  await openWith(createTestStore(), 1, rectangle('a', 100));
  await pick('a');

  await userEvent.keyboard('{Control>}d{/Control}');

  await expect.poll(() => document.querySelectorAll('.slide-frame .cue-element').length).toBe(2);
});

test('Given a selected shape, When the arrows are pressed, Then it moves 1 px each (Nudge), and 10 px with Shift (Nudge further)', async () => {
  await openWith(createTestStore(), 1, rectangle('a', 100));
  await pick('a');

  await userEvent.keyboard('{ArrowRight}');
  await expect.poll(() => node('a').style.left).toBe('101px');
  await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');

  await expect.poll(() => node('a').style.left).toBe('111px');
});

test('Given a key typed into a field, Then single-key shortcuts do not fire (S, I, T, ? belong to the text)', async () => {
  const screen = await openWith(createTestStore(), 1);
  const notes = screen.getByRole('textbox', { name: 'Speaker notes text' });

  await notes.fill('');
  await userEvent.click(notes);
  await userEvent.keyboard('Stop? Is it ');

  await expect.element(notes).toHaveValue('Stop? Is it ');
  expect(document.querySelector('dialog[open]')).toBeNull();
  expect(document.querySelector('.slide-frame-drawing')).toBeNull();
});

// The cheat sheet (UX-2; design: Shortcuts) ---------------------------------------------------------

test('Given the editor, When ? is pressed, Then the shortcut list opens with focus in it, and Escape closes it and gives focus back', async () => {
  const screen = await openWith(createTestStore(), 1);
  frame().focus();

  await userEvent.keyboard('?');

  await expect.element(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  expect(document.querySelector('dialog')?.contains(document.activeElement)).toBe(true);
  await userEvent.keyboard('{Escape}');
  await expect.poll(() => document.querySelector('dialog[open]')).toBeNull();
  expect(document.activeElement).toBe(frame());
});

test('Given the list, Then it shows every shortcut that works, in its groups, and none that does nothing yet', async () => {
  const screen = await openWith(createTestStore(), 1);
  await userEvent.keyboard('?');
  const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect.element(dialog).toBeVisible();

  for (const shortcut of listed()) {
    await expect.element(dialog.getByText(shortcut.label, { exact: true })).toBeVisible();
  }
  for (const shortcut of SHORTCUTS.filter((s) => s.planned === true)) {
    expect(document.body.textContent).not.toContain(shortcut.label);
  }
  for (const group of ['Slides', 'Order', 'General', 'Elements']) {
    await expect.element(dialog.getByRole('region', { name: group })).toBeVisible();
  }
});

test('Given the list, When text is typed in the search field, Then it narrows to the shortcuts that match, by name or by key', async () => {
  const screen = await openWith(createTestStore(), 1);
  await userEvent.keyboard('?');
  const search = screen.getByRole('searchbox', { name: 'Search shortcuts' });

  await search.fill('duplicate');
  await expect.element(screen.getByText('Duplicate slide', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('Duplicate', { exact: true })).toBeVisible();
  expect(document.body.textContent).not.toContain('Bring forward');

  await search.fill('zzzz');
  await expect.element(screen.getByText(/No shortcut matches/)).toBeVisible();
});

test('Given the list, When Done is pressed, Then it closes', async () => {
  const screen = await openWith(createTestStore(), 1);
  await userEvent.keyboard('?');

  await screen.getByRole('button', { name: 'Done' }).click();

  await expect.poll(() => document.querySelector('dialog[open]')).toBeNull();
});

test('Given a Mac, When the list opens, Then it shows ⌘ where it said Ctrl', async () => {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  const screen = await openWith(createTestStore(), 1);

  await userEvent.keyboard('?');

  const row = screen.getByRole('dialog').getByText('New slide', { exact: true });
  await expect.element(row).toBeVisible();
  expect(row.element().closest('li')?.textContent).toBe('New slide⌘M');
});

// Tooltips (UX-2): every toolbar button with a shortcut shows it -----------------------------------------

const hinted: readonly [string, string, string][] = [
  ['Add slide', 'slide.new', 'Add slide'],
  ['Text', 'element.text', 'Text box'],
  ['Shape', 'element.shape', 'Shape'],
  ['Add image', 'element.image', 'Add image'],
  ['Undo', 'general.undo', 'Undo'],
  ['Redo', 'general.redo', 'Redo'],
];

test.each(hinted)(
  'Given the %s button, When it is hovered, Then its hint names it and shows its keys (%s)',
  async (button, id, name) => {
    const screen = await openWith(createTestStore(), 1);

    await userEvent.hover(screen.getByRole('button', { name: button, exact: true }));

    const tooltip = screen.getByRole('tooltip');
    await expect.element(tooltip).toBeVisible();
    const keys = displayKeys(shortcutById(id), false);
    expect(tooltip.element().textContent).toBe(`${name}${keys.join('')}`);
    expect([...tooltip.element().querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(keys);
  },
);

test('Given the Shape button reached by the keyboard, When it is focused, Then the hint shows at once', async () => {
  const screen = await openWith(createTestStore(), 1);
  const add = screen.getByRole('button', { name: 'Add slide', exact: true });
  add.element().focus();

  await userEvent.keyboard('{Tab}{Tab}');

  await expect.element(screen.getByRole('tooltip')).toBeVisible();
  expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('Shape');
});

test('Given a hint showing, When Escape is pressed, Then it goes', async () => {
  const screen = await openWith(createTestStore(), 1);
  await userEvent.hover(screen.getByRole('button', { name: 'Text', exact: true }));
  await expect.element(screen.getByRole('tooltip')).toBeVisible();

  await userEvent.keyboard('{Escape}');

  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});

test('Given a button with a hint showing, Then the button is described by it', async () => {
  const screen = await openWith(createTestStore(), 1);
  const text = screen.getByRole('button', { name: 'Text', exact: true });

  await userEvent.hover(text);

  await expect.element(screen.getByRole('tooltip')).toBeVisible();
  expect(text.element().getAttribute('aria-describedby')).toBe(
    document.querySelector('[role="tooltip"]')?.id,
  );
});

test('Given a selected shape, When an Arrange button is hovered, Then its hint shows the keys of that command', async () => {
  const screen = await openWith(createTestStore(), 1, rectangle('a', 100), rectangle('b', 500));
  await pick('a');

  await userEvent.hover(screen.getByRole('button', { name: 'Front', exact: true }));

  const tooltip = screen.getByRole('tooltip');
  await expect.element(tooltip).toBeVisible();
  expect(tooltip.element().textContent).toBe('Bring to frontCtrlShift]');
});
