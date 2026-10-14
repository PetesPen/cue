import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { Inspector } from './Inspector';

test('Given the inspector, When it first renders, Then Design is selected and only its panel is visible', async () => {
  const screen = await render(<Inspector />);

  await expect
    .element(screen.getByRole('tab', { name: 'Design' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(screen.getByRole('tab', { name: 'Animate' }))
    .toHaveAttribute('aria-selected', 'false');
  await expect.element(screen.getByRole('tabpanel', { name: 'Design' })).toBeVisible();
  await expect.element(screen.getByRole('tabpanel', { name: 'Animate' })).not.toBeInTheDocument();
});

test('Given the inspector, When the Transition tab is clicked, Then its panel is shown instead', async () => {
  const screen = await render(<Inspector />);

  await screen.getByRole('tab', { name: 'Transition' }).click();

  await expect.element(screen.getByRole('tabpanel', { name: 'Transition' })).toBeVisible();
  await expect.element(screen.getByRole('tabpanel', { name: 'Design' })).not.toBeInTheDocument();
});

test('Given the Design tab has focus, When ArrowRight is pressed, Then Animate is selected and focused', async () => {
  const screen = await render(<Inspector />);
  await screen.getByRole('tab', { name: 'Design' }).click();

  await userEvent.keyboard('{ArrowRight}');

  await expect
    .element(screen.getByRole('tab', { name: 'Animate' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.element(screen.getByRole('tab', { name: 'Animate' })).toHaveFocus();
});

test('Given the Design tab has focus, When ArrowLeft is pressed, Then focus wraps to the Transition tab', async () => {
  const screen = await render(<Inspector />);
  await screen.getByRole('tab', { name: 'Design' }).click();

  await userEvent.keyboard('{ArrowLeft}');

  await expect
    .element(screen.getByRole('tab', { name: 'Transition' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.element(screen.getByRole('tab', { name: 'Transition' })).toHaveFocus();
});

test('Given a tab has focus, When End and then Home are pressed, Then the last and first tabs are selected', async () => {
  const screen = await render(<Inspector />);
  await screen.getByRole('tab', { name: 'Design' }).click();

  await userEvent.keyboard('{End}');
  await expect
    .element(screen.getByRole('tab', { name: 'Transition' }))
    .toHaveAttribute('aria-selected', 'true');

  await userEvent.keyboard('{Home}');
  await expect
    .element(screen.getByRole('tab', { name: 'Design' }))
    .toHaveAttribute('aria-selected', 'true');
});

test('Given the inspector, When the tabs are read, Then only the selected tab is in the Tab order', async () => {
  const screen = await render(<Inspector />);

  await expect
    .element(screen.getByRole('tab', { name: 'Design' }))
    .toHaveAttribute('tabindex', '0');
  await expect
    .element(screen.getByRole('tab', { name: 'Animate' }))
    .toHaveAttribute('tabindex', '-1');
  await expect
    .element(screen.getByRole('tab', { name: 'Transition' }))
    .toHaveAttribute('tabindex', '-1');
});
