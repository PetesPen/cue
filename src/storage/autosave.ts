import type { Deck } from '@/model';
import { isQuotaError } from './quota';

/** Changes save within 2 seconds of the last edit (SV-1): 0.5 s of quiet, or 1.5 s at the most. */
export const AUTOSAVE_DELAY_MS = 500;
export const AUTOSAVE_MAX_WAIT_MS = 1500;

/** What the "Saved" indicator shows (design: States, "Save status"). */
export type SaveState =
  | { readonly status: 'saved' }
  | { readonly status: 'saving' }
  /** `full`: the browser said the store is full. `error`: any other reason. */
  | { readonly status: 'failed'; readonly reason: 'full' | 'error' };

export interface AutosaverOptions {
  readonly save: (deck: Deck) => Promise<void>;
  readonly onChange: (state: SaveState) => void;
  readonly delayMs?: number;
  readonly maxWaitMs?: number;
}

/**
 * Saves the latest deck a little after the last edit. The newest deck always wins; edits that arrive
 * while a save runs are saved right after it. A failed save keeps the deck in memory and tries again
 * on the next edit or on `retry()`, so nothing is lost while the tab stays open.
 */
export class Autosaver {
  #pending: Deck | undefined;
  #inFlight: Promise<void> | undefined;
  #debounce: ReturnType<typeof setTimeout> | undefined;
  #maxWait: ReturnType<typeof setTimeout> | undefined;
  #state: SaveState = { status: 'saved' };
  #disposed = false;
  readonly #options: Required<AutosaverOptions>;

  constructor(options: AutosaverOptions) {
    this.#options = { delayMs: AUTOSAVE_DELAY_MS, maxWaitMs: AUTOSAVE_MAX_WAIT_MS, ...options };
  }

  get state(): SaveState {
    return this.#state;
  }

  /** Call after every edit with the new deck. */
  edit(deck: Deck): void {
    if (this.#disposed) return;
    this.#pending = deck;
    this.#setState({ status: 'saving' });
    clearTimeout(this.#debounce);
    this.#debounce = setTimeout(() => void this.flush(), this.#options.delayMs);
    this.#maxWait ??= setTimeout(() => void this.flush(), this.#options.maxWaitMs);
  }

  /** Save now, and resolve when everything pending is on disk (or has failed). */
  async flush(): Promise<void> {
    this.#clearTimers();
    while (this.#pending !== undefined || this.#inFlight !== undefined) {
      if (this.#inFlight !== undefined) {
        await this.#inFlight;
      } else if (this.#pending !== undefined) {
        const deck = this.#pending;
        this.#pending = undefined;
        this.#inFlight = this.#write(deck);
        await this.#inFlight;
        // A failed save keeps its deck pending for `retry()`; stop here instead of looping.
        if (this.#state.status === 'failed') return;
      }
    }
  }

  /** Try again after a failure, for example once the user has freed some space. */
  retry(): Promise<void> {
    return this.flush();
  }

  dispose(): void {
    this.#disposed = true;
    this.#clearTimers();
  }

  async #write(deck: Deck): Promise<void> {
    try {
      await this.#options.save(deck);
      if (this.#pending === undefined) this.#setState({ status: 'saved' });
    } catch (error) {
      // Put the deck back unless a newer edit has replaced it, so a retry saves the latest one.
      this.#pending ??= deck;
      this.#setState({ status: 'failed', reason: isQuotaError(error) ? 'full' : 'error' });
    } finally {
      this.#inFlight = undefined;
    }
  }

  #clearTimers(): void {
    clearTimeout(this.#debounce);
    clearTimeout(this.#maxWait);
    this.#debounce = undefined;
    this.#maxWait = undefined;
  }

  #setState(state: SaveState): void {
    if (sameState(this.#state, state)) return;
    this.#state = state;
    this.#options.onChange(state);
  }
}

function sameState(a: SaveState, b: SaveState): boolean {
  if (a.status !== b.status) return false;
  return a.status !== 'failed' || (b.status === 'failed' && a.reason === b.reason);
}
