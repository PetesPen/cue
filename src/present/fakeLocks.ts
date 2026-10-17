import type { Locks } from './locks';

/**
 * Pretend Web Locks for tests: a set of windows that share one registry, in which a window can be
 * killed (it dies and lets go of everything it held, as a closed or crashed window does).
 */
export interface FakeWindowLocks extends Locks {
  /** The window dies: every lock it held is released. */
  readonly kill: () => void;
}

type Waiter =
  | { readonly kind: 'watch'; readonly resolve: () => void }
  | {
      readonly kind: 'hold';
      readonly take: () => void;
    };

export class FakeRegistry {
  readonly #held = new Map<string, symbol>();
  readonly #queue = new Map<string, Waiter[]>();

  /** Names held right now. */
  held(): string[] {
    return [...this.#held.keys()];
  }

  /** A new window with its own view of the shared locks. */
  window(): FakeWindowLocks {
    const mine = new Set<() => void>();
    return {
      hold: (name) => {
        const release = this.#acquire(name);
        mine.add(release);
        return () => {
          mine.delete(release);
          release();
        };
      },
      free: (name) => Promise.resolve(!this.#held.has(name)),
      whenFree: (name, signal) =>
        new Promise<boolean>((resolve) => {
          if (signal.aborted) {
            resolve(false);
            return;
          }
          if (!this.#held.has(name)) {
            resolve(true);
            return;
          }
          const waiter: Waiter = {
            kind: 'watch',
            resolve: () => {
              resolve(true);
            },
          };
          this.#queue.set(name, [...(this.#queue.get(name) ?? []), waiter]);
          signal.addEventListener(
            'abort',
            () => {
              this.#queue.set(
                name,
                (this.#queue.get(name) ?? []).filter((w) => w !== waiter),
              );
              resolve(false);
            },
            { once: true },
          );
        }),
      kill: () => {
        for (const release of [...mine]) release();
        mine.clear();
      },
    };
  }

  #acquire(name: string): () => void {
    const token = Symbol(name);
    let released = false;
    const take = () => {
      this.#held.set(name, token);
    };
    const waiter: Waiter = { kind: 'hold', take };
    if (this.#held.has(name)) this.#queue.set(name, [...(this.#queue.get(name) ?? []), waiter]);
    else take();
    return () => {
      if (released) return;
      released = true;
      if (this.#held.get(name) === token) {
        this.#held.delete(name);
        this.#next(name);
      } else {
        this.#queue.set(
          name,
          (this.#queue.get(name) ?? []).filter((w) => w !== waiter),
        );
      }
    };
  }

  /** The lock is free: watchers are told, and the first window waiting to hold it takes it. */
  #next(name: string): void {
    const waiting = this.#queue.get(name) ?? [];
    const rest: Waiter[] = [];
    let taken = false;
    for (const waiter of waiting) {
      if (waiter.kind === 'watch') waiter.resolve();
      else if (!taken) {
        waiter.take();
        taken = true;
      } else rest.push(waiter);
    }
    this.#queue.set(name, rest);
  }
}
