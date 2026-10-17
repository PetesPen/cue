import { afterEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { SmallScreen, UnsupportedBrowser } from './SmallScreen';

// UX-5: phone-sized screens and browsers that are too old are told so, kindly.

afterEach(() => {
  vi.restoreAllMocks();
});

test('Given a phone-sized screen, Then the card says Cue is built for larger screens and that exported pages play anywhere', async () => {
  const screen = await render(<SmallScreen />);

  await expect
    .element(screen.getByRole('heading', { name: 'Cue is built for larger screens' }))
    .toBeVisible();
  await expect
    .element(
      screen.getByText(
        /Open it on a laptop or desktop to edit\. Exported web page decks play on any device, including this one\./,
      ),
    )
    .toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Copy link' })).toBeVisible();
});

test('Given the card, When Copy link is pressed, Then the address is copied and the button says so', async () => {
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const screen = await render(<SmallScreen />);

  await userEvent.click(screen.getByRole('button', { name: 'Copy link' }).element());

  await expect.element(screen.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(write).toHaveBeenCalledExactlyOnceWith(window.location.href);
});

test('Given a browser that cannot copy, When Copy link is pressed, Then nothing breaks and the button stays', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));
  const screen = await render(<SmallScreen />);

  await userEvent.click(screen.getByRole('button', { name: 'Copy link' }).element());

  await expect.element(screen.getByRole('button', { name: 'Copy link' })).toBeVisible();
});

test('Given a browser that is too old, Then the page says which browsers work and what this one lacks', async () => {
  const screen = await render(
    <UnsupportedBrowser
      missing={['animation (Web Animations)', 'saving decks in the browser (IndexedDB)']}
    />,
  );

  await expect
    .element(screen.getByRole('heading', { name: 'This browser is too old for Cue' }))
    .toBeVisible();
  await expect
    .element(screen.getByText(/current Chrome, Edge, Firefox and Safari on a computer/))
    .toBeVisible();
  await expect.element(screen.getByText('animation (Web Animations)')).toBeVisible();
  await expect.element(screen.getByText('saving decks in the browser (IndexedDB)')).toBeVisible();
});
