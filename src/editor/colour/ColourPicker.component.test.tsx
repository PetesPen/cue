import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { ColourPicker } from './ColourPicker';
import { ColourContext } from './deckColours';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'EyeDropper');
});

interface Options {
  readonly value?: string;
  readonly allowNone?: boolean;
  readonly deck?: readonly string[];
}

async function open({ value = '#7FC8A0', allowNone = false, deck = [] }: Options = {}) {
  const onPreview = vi.fn<(colour: string) => void>();
  const onCommit = vi.fn<(colour: string) => void>();
  const remember = vi.fn<(colour: string) => void>();
  const screen = await render(
    <ColourContext.Provider value={{ colours: deck, remember }}>
      <ColourPicker
        label="Fill"
        value={value}
        allowNone={allowNone}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    </ColourContext.Provider>,
  );
  return { screen, onPreview, onCommit, remember };
}

// EL-10: the colour picker

test('Given the picker, When a design swatch is pressed, Then that colour is saved and remembered', async () => {
  const { screen, onCommit, remember } = await open();

  await screen.getByRole('button', { name: 'Yellow' }).click();

  expect(onCommit).toHaveBeenCalledExactlyOnceWith('#F5C542');
  expect(remember).toHaveBeenCalledWith('#F5C542');
});

test('Given the picker, When a colour code is typed and Enter pressed, Then that colour is saved', async () => {
  const { screen, onCommit } = await open();

  await screen.getByRole('textbox', { name: 'Fill hex code' }).fill('abc');
  await userEvent.keyboard('{Enter}');

  expect(onCommit).toHaveBeenCalledExactlyOnceWith('#AABBCC');
});

test('Given a code that is not a colour, When Enter is pressed, Then nothing is saved', async () => {
  const { screen, onCommit } = await open();

  await screen.getByRole('textbox', { name: 'Fill hex code' }).fill('nope');
  await userEvent.keyboard('{Enter}');

  expect(onCommit).not.toHaveBeenCalled();
});

test('Given the hue slider, When it is moved with the keyboard, Then each step is a saved colour of another hue', async () => {
  const { onCommit } = await open({ value: '#FF0000' });

  document.querySelector<HTMLInputElement>('input[aria-label="Fill: hue"]')?.focus();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');

  expect(onCommit).toHaveBeenCalled();
  const last = onCommit.mock.calls.at(-1)?.[0];
  expect(last).not.toBe('#FF0000');
  expect(last).toMatch(/^#FF[0-9A-F]{2}00$/);
});

test('Given the brightness slider, When it is moved down with the keyboard, Then the colour gets darker', async () => {
  const { onCommit } = await open({ value: '#FF0000' });

  // The sliders under the area are for the keyboard: they are not drawn, so focus is moved to one.
  document.querySelector<HTMLInputElement>('input[aria-label="Fill: brightness"]')?.focus();
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');

  expect(onCommit.mock.calls.at(-1)?.[0]).toBe('#F70000');
});

test('Given the picker, Then a screen reader is told which colour it holds', async () => {
  const { screen } = await open({ value: '#7FC8A0' });

  await expect.element(screen.getByRole('status')).toHaveTextContent('Fill: Mint');
});

test('Given a colour that is not a design colour, Then the screen reader hears its code', async () => {
  const { screen } = await open({ value: '#aabbcc' });

  await expect.element(screen.getByRole('status')).toHaveTextContent('Fill: #AABBCC');
});

test('Given the area and sliders, Then each is named, so a keyboard or screen reader user can use them', async () => {
  const { screen } = await open();

  for (const name of ['Fill: hue', 'Fill: saturation', 'Fill: brightness']) {
    expect(document.querySelector(`input[type="range"][aria-label="${name}"]`)).not.toBeNull();
  }
  await expect.element(screen.getByRole('group', { name: 'Fill' })).toBeVisible();
});

test('Given a shape that may be unfilled, When None is pressed, Then "none" is saved', async () => {
  const { screen, onCommit } = await open({ allowNone: true });

  await screen.getByRole('button', { name: 'No fill' }).click();

  expect(onCommit).toHaveBeenCalledExactlyOnceWith('none');
});

test('Given a colour that cannot be none, When the picker opens, Then there is no None button', async () => {
  const { screen } = await open();

  await expect.element(screen.getByRole('button', { name: 'No fill' })).not.toBeInTheDocument();
});

test('Given colours the deck already uses, Then those that are not design colours are offered, each once', async () => {
  const { screen } = await open({ deck: ['#E4572E', '#17803F', '#E4572E'] });

  await expect.element(screen.getByText('In this deck')).toBeVisible();
  await expect.element(screen.getByRole('button', { name: '#E4572E' })).toBeVisible();
  // The design green is already one of the design colours, so it is not listed twice.
  expect(document.querySelectorAll('[aria-label="Green"]').length).toBe(1);
});

test('Given a deck using only design colours, Then there is no "In this deck" row', async () => {
  const { screen } = await open({ deck: ['#17803F'] });

  await expect.element(screen.getByText('In this deck')).not.toBeInTheDocument();
});

test('Given a browser with an eyedropper, When it picks a colour from the screen, Then that colour is saved', async () => {
  class FakeEyeDropper {
    open() {
      return Promise.resolve({ sRGBHex: '#123456' });
    }
  }
  Object.defineProperty(window, 'EyeDropper', { value: FakeEyeDropper, configurable: true });
  const { screen, onCommit } = await open();

  await screen.getByRole('button', { name: 'Pick a colour from the screen' }).click();

  await vi.waitFor(() => {
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('#123456');
  });
});

test('Given an eyedropper that is closed without a colour, Then nothing is saved and nothing breaks', async () => {
  class FakeEyeDropper {
    open() {
      return Promise.reject(new DOMException('closed', 'AbortError'));
    }
  }
  Object.defineProperty(window, 'EyeDropper', { value: FakeEyeDropper, configurable: true });
  const { screen, onCommit } = await open();

  await screen.getByRole('button', { name: 'Pick a colour from the screen' }).click();
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(onCommit).not.toHaveBeenCalled();
});

test('Given a browser without an eyedropper, Then there is no eyedropper button', async () => {
  Reflect.deleteProperty(window, 'EyeDropper');
  const { screen } = await open();

  await expect
    .element(screen.getByRole('button', { name: 'Pick a colour from the screen' }))
    .not.toBeInTheDocument();
});
