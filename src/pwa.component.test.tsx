import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { EditorApp } from '@/editor/EditorApp';
import type { InstallApi } from '@/editor/InstallContext';
import { closeTestStores, createTestStore } from '@/editor/test-helpers';
import { Installer, Updater, type Register } from './pwa';
import { UpdateBanner } from './UpdateBanner';

// UX-7: the update that waits for the person's say, and the install action only where it is offered.

afterEach(() => {
  closeTestStores();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.location.hash = '';
});

/** A register that keeps what it was given, and an update that does what the test says. */
function fakeRegister(update: (reload?: boolean) => Promise<void> = () => Promise.resolve()) {
  const hooks: { onNeedRefresh?: () => void; immediate?: boolean } = {};
  const updateNow = vi.fn(update);
  const register: Register = (given) => {
    Object.assign(hooks, given);
    return updateNow;
  };
  return { register, hooks, updateNow };
}

describe('a new version waits until the person chooses (UX-7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('Given the app started, When nothing new is waiting, Then it is idle; when a version waits, Then it is ready and nothing has reloaded', () => {
    const { register, hooks, updateNow } = fakeRegister();
    const rescue = vi.fn(() => Promise.resolve());
    const updater = new Updater(register, rescue);

    updater.start();
    expect(hooks.immediate).toBe(true);
    expect(updater.getState()).toBe('idle');
    hooks.onNeedRefresh?.();

    expect(updater.getState()).toBe('ready');
    vi.advanceTimersByTime(60_000);
    expect(updateNow).not.toHaveBeenCalled();
    expect(rescue).not.toHaveBeenCalled();
  });

  test('Given a version waiting, When Update now is chosen, Then the version is asked to take over, and nothing is cleared while it does', async () => {
    const { register, hooks, updateNow } = fakeRegister();
    const rescue = vi.fn(() => Promise.resolve());
    const updater = new Updater(register, rescue, 3000);
    updater.start();
    hooks.onNeedRefresh?.();

    await updater.apply();

    expect(updateNow).toHaveBeenCalledExactlyOnceWith(true);
    expect(updater.getState()).toBe('applying');
    // A page that has reloaded takes its timer with it; here the page stays, so the rescue comes after 3 s.
    await vi.advanceTimersByTimeAsync(2999);
    expect(rescue).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(rescue).toHaveBeenCalledTimes(1);
  });

  test('Given an update that fails, When Update now is chosen, Then the worker and caches are cleared after the wait', async () => {
    const { register, hooks } = fakeRegister(() => Promise.reject(new Error('no controller')));
    const rescue = vi.fn(() => Promise.resolve());
    const updater = new Updater(register, rescue, 1000);
    updater.start();
    hooks.onNeedRefresh?.();

    await updater.apply();
    await vi.advanceTimersByTimeAsync(1100);

    expect(rescue).toHaveBeenCalledTimes(1);
  });

  test('Given Update now chosen when nothing waits, Then nothing happens', async () => {
    const { register, updateNow } = fakeRegister();
    const updater = new Updater(register, () => Promise.resolve());
    updater.start();

    await updater.apply();

    expect(updateNow).not.toHaveBeenCalled();
    expect(updater.getState()).toBe('idle');
  });

  test('Given a version waiting, When Later is chosen, Then the banner goes, and a newer one waiting brings it back', () => {
    const { register, hooks, updateNow } = fakeRegister();
    const updater = new Updater(register, () => Promise.resolve());
    updater.start();
    hooks.onNeedRefresh?.();

    updater.later();
    expect(updater.getState()).toBe('idle');
    hooks.onNeedRefresh?.();

    expect(updater.getState()).toBe('ready');
    expect(updateNow).not.toHaveBeenCalled();
  });
});

describe('the banner (UX-7)', () => {
  test('Given no waiting version, Then there is no banner; given one, Then it offers Update now and Later', async () => {
    const { register, hooks } = fakeRegister();
    const updater = new Updater(register, () => Promise.resolve());
    updater.start();
    const screen = await render(<UpdateBanner updater={updater} />);
    expect(screen.getByRole('status').elements()).toHaveLength(0);

    hooks.onNeedRefresh?.();

    await expect.element(screen.getByText('A new version of Cue is ready.')).toBeVisible();
    await expect.element(screen.getByText(/Your decks stay exactly as they are/)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Update now' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Later' })).toBeVisible();
  });

  test('Given the banner, When Later is pressed, Then it goes; when Update now is pressed, Then it says it is updating and the buttons are off', async () => {
    const { register, hooks, updateNow } = fakeRegister(() => new Promise<void>(() => undefined));
    const updater = new Updater(register, () => Promise.resolve(), 60_000);
    updater.start();
    const screen = await render(<UpdateBanner updater={updater} />);
    hooks.onNeedRefresh?.();
    await screen.getByRole('button', { name: 'Later' }).click();
    await expect
      .element(screen.getByText('A new version of Cue is ready.'))
      .not.toBeInTheDocument();
    hooks.onNeedRefresh?.();

    await screen.getByRole('button', { name: 'Update now' }).click();

    await expect.element(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: 'Later' })).toBeDisabled();
    expect(updateNow).toHaveBeenCalledTimes(1);
  });
});

/** A browser's install offer, as the event it sends. */
function offer(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn(() => Promise.resolve());
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  return { event, prompt };
}

describe('installing Cue as an app (UX-7)', () => {
  test('Given a browser that does not offer it, Then there is nothing to install', () => {
    const installer = new Installer(window, () => false);

    expect(installer.available()).toBe(false);
  });

  test('Given the browser offers it, Then it is available, its own mini-bar is held back, and install asks once', async () => {
    const installer = new Installer(window, () => false);
    const heard = vi.fn();
    installer.subscribe(heard);
    const { event, prompt } = offer();

    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(installer.available()).toBe(true);
    expect(heard).toHaveBeenCalled();
    await installer.install();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(installer.available()).toBe(false);
    await installer.install();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  test('Given the app is installed, Then the install action goes', () => {
    const installer = new Installer(window, () => false);
    window.dispatchEvent(offer().event);
    expect(installer.available()).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));

    expect(installer.available()).toBe(false);
  });

  test('Given Cue is already running as an installed app, Then it is not offered again', () => {
    const installer = new Installer(window, () => true);

    window.dispatchEvent(offer().event);

    expect(installer.available()).toBe(false);
  });
});

describe('Install Cue in the library (UX-7)', () => {
  const fakeApi = (initially: boolean) => {
    let available = initially;
    const listeners = new Set<() => void>();
    const install = vi.fn(() => {
      available = false;
      for (const listener of listeners) listener();
      return Promise.resolve();
    });
    const api: InstallApi = {
      available: () => available,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      install,
    };
    return {
      api,
      install,
      offer: () => {
        available = true;
        for (const listener of listeners) listener();
      },
    };
  };

  test('Given a browser that cannot install Cue, Then the library has no Install action', async () => {
    window.location.hash = '#/';
    const screen = await render(<EditorApp store={createTestStore()} />);

    await expect.element(screen.getByRole('heading', { name: 'No decks yet' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Install Cue' }).elements()).toHaveLength(0);
  });

  test('Given a browser that offers it, Then Install Cue is in the top bar, asks the browser, and goes once asked', async () => {
    const { api, install } = fakeApi(true);
    window.location.hash = '#/';
    const screen = await render(<EditorApp store={createTestStore()} install={api} />);

    await userEvent.click(screen.getByRole('button', { name: 'Install Cue' }).element());

    expect(install).toHaveBeenCalledTimes(1);
    await expect
      .poll(() => screen.getByRole('button', { name: 'Install Cue' }).elements())
      .toHaveLength(0);
  });

  test('Given an offer that comes after the library opened, Then the action appears', async () => {
    const { api, offer: makeOffer } = fakeApi(false);
    window.location.hash = '#/';
    const screen = await render(<EditorApp store={createTestStore()} install={api} />);
    expect(screen.getByRole('button', { name: 'Install Cue' }).elements()).toHaveLength(0);

    makeOffer();

    await expect.element(screen.getByRole('button', { name: 'Install Cue' })).toBeVisible();
  });
});
