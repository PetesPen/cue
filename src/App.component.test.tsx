import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { App } from '@/App';

// Tooling smoke test: proves component tests run in a real browser. Replace with real component
// tests (panels, font picker, layers list) as they are built.
test('Given the app, When it renders, Then the Cue heading is shown', async () => {
  const screen = await render(<App />);
  await expect.element(screen.getByRole('heading', { name: 'Cue', level: 1 })).toBeVisible();
});
