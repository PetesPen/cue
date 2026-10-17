/**
 * The installable, offline app (UX-7): the update that waits for the person's say, and the install action
 * where the browser offers one. Both are small stores the interface reads; the browser's own pieces
 * (the service worker register, the caches) are given in, so tests can stand in for them.
 */

export type UpdateState = 'idle' | 'ready' | 'applying';

/** What `registerSW` of vite-plugin-pwa gives back: ask the waiting version to take over, then reload. */
export type UpdateNow = (reload?: boolean) => Promise<void>;

export type Register = (hooks: {
  readonly immediate?: boolean;
  readonly onNeedRefresh?: () => void;
}) => UpdateNow;

/** How long a waiting version is given to take over before the worker and the caches are cleared (SP-6). */
export const TAKE_OVER_MS = 3000;

/**
 * A new version of the app is downloaded in the background and waits (`ready`); nothing changes until
 * `apply` is called from the banner. It never reloads by itself, so a deck being edited is never
 * interrupted, and the stored decks (in IndexedDB, not in the worker's caches) are never touched. If the
 * new version has not taken over a few seconds after "Update now", which WebKit sometimes does (SP-6), the
 * worker and the caches are removed and the page reloads: the next load is the new version.
 */
export class Updater {
  #state: UpdateState = 'idle';
  readonly #listeners = new Set<() => void>();
  #update: UpdateNow | undefined;
  readonly #register: Register;
  readonly #rescue: () => Promise<void>;
  readonly #takeOverMs: number;

  constructor(register: Register, rescue: () => Promise<void>, takeOverMs: number = TAKE_OVER_MS) {
    this.#register = register;
    this.#rescue = rescue;
    this.#takeOverMs = takeOverMs;
  }

  readonly getState = (): UpdateState => this.#state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Register the service worker and watch for a version that is waiting. */
  start(): void {
    this.#update = this.#register({
      immediate: true,
      onNeedRefresh: () => {
        this.#set('ready');
      },
    });
  }

  /** "Update now": the waiting version takes over and the page reloads. */
  readonly apply = async (): Promise<void> => {
    if (this.#state !== 'ready') return;
    this.#set('applying');
    // A page that reloads takes the timer with it; one that does not is rescued when it fires.
    setTimeout(() => {
      void this.#rescue();
    }, this.#takeOverMs);
    try {
      await this.#update?.(true);
    } catch {
      // The rescue above will do what the update could not.
    }
  };

  /** "Later": the banner goes until the page is next opened; nothing is installed. */
  readonly later = (): void => {
    if (this.#state === 'ready') this.#set('idle');
  };

  #set(next: UpdateState): void {
    if (this.#state === next) return;
    this.#state = next;
    for (const listener of this.#listeners) listener();
  }
}

/** Remove the service workers and every cache of the app, then reload: the next load is the new version. */
export async function browserRescue(): Promise<void> {
  try {
    const workers = await navigator.serviceWorker.getRegistrations();
    await Promise.all(workers.map((worker) => worker.unregister()));
    for (const key of await caches.keys()) await caches.delete(key);
  } finally {
    window.location.reload();
  }
}

/** The install prompt a browser offers (Chrome and Edge): kept until the person asks for it. */
interface InstallEvent extends Event {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

function isInstallEvent(event: Event): event is InstallEvent {
  return 'prompt' in event && typeof event.prompt === 'function';
}

/**
 * Whether Cue can be installed here, and the action to install it. Only a browser that offers it, and only
 * outside the installed app, has it: elsewhere there is nothing to show and Cue works in a tab.
 */
export class Installer {
  #offered: InstallEvent | undefined;
  readonly #listeners = new Set<() => void>();
  readonly #standalone: () => boolean;

  /** `standalone` says whether Cue is already running as an installed app. */
  constructor(target: Pick<Window, 'addEventListener'>, standalone: () => boolean) {
    this.#standalone = standalone;
    target.addEventListener('beforeinstallprompt', (event) => {
      if (!isInstallEvent(event)) return;
      // The browser's own mini-bar is held back; Cue offers the action where it belongs.
      event.preventDefault();
      this.#offered = event;
      this.#changed();
    });
    target.addEventListener('appinstalled', () => {
      this.#offered = undefined;
      this.#changed();
    });
  }

  readonly available = (): boolean => this.#offered !== undefined && !this.#installed();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Ask the browser to install Cue. It can be asked only once per offer. */
  readonly install = async (): Promise<void> => {
    const offered = this.#offered;
    if (!offered) return;
    this.#offered = undefined;
    this.#changed();
    await offered.prompt();
    await offered.userChoice;
  };

  #installed(): boolean {
    return this.#standalone();
  }

  #changed(): void {
    for (const listener of this.#listeners) listener();
  }
}
