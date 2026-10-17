import {
  back,
  clampPlace,
  forward,
  jumpTo,
  toEnd,
  toggleBlank,
  toStart,
  type Deck,
  type ShowPlace,
} from '@/model';
import type { ShowChannel } from './channel';
import { browserLocks, lockName, type Locks } from './locks';
import { GRACE_MS, watchGone } from './presence';

/**
 * A show as one window holds it (PM-1, PM-2, PM-3): where it is, the moves, and the line to the other
 * window. The deck is read once, when the show starts, and held for its whole length: nothing edits it
 * while the tab is the presenter view. Moves made here are sent across; moves heard from the other
 * window are taken as they are and never sent back.
 *
 * The presenter answers a window that has just opened ("hello") with where the show is, so a window
 * that opens late, after a reconnect, or after "Present from current slide", starts in the right place.
 *
 * Each window also holds a lock named after itself for as long as it lives, and watches the other's (SP-1):
 * a presenter view learns that the audience window is gone and offers to reconnect; an audience window
 * learns that the presenter view is gone for good and closes. A reload is not "gone": the window has a
 * few seconds to take its lock again.
 */

export type ShowRole = 'presenter' | 'audience' | 'single';

/** What the presenter view knows of the audience window: not heard from yet, open, or gone. */
export type AudienceState = 'unknown' | 'here' | 'gone';

export interface ShowOptions {
  /** Makes the line to the other window when the show connects (a show in one window has none). */
  readonly openChannel?: () => ShowChannel;
  /** The browser's locks by default; tests give pretend ones. */
  readonly locks?: Locks | undefined;
  /** How long a window that let go of its lock may take to come back (a reload). */
  readonly graceMs?: number;
  /** Told every place the show comes to, to keep it across a reload. */
  readonly onPlace?: (place: ShowPlace) => void;
}

export class Show {
  readonly deck: Deck;
  readonly #role: ShowRole;
  readonly #options: ShowOptions;
  readonly #listeners = new Set<() => void>();
  readonly #endListeners = new Set<() => void>();
  #channel: ShowChannel | undefined;
  #place: ShowPlace;
  #audience: AudienceState = 'unknown';
  #stopWatchingAudience: (() => void) | undefined;
  #ended = false;
  /** Lines open now: more than one only while a development build tries a page out twice. */
  #connections = 0;

  /** Making a show does nothing else, so it can be made while a page is being drawn. */
  constructor(deck: Deck, start: ShowPlace, role: ShowRole, options: ShowOptions = {}) {
    this.deck = deck;
    this.#role = role;
    this.#options = options;
    this.#place = clampPlace(deck, start);
  }

  /** Open the line to the other window and listen. Returns how to hang up (for an effect's cleanup). */
  connect(): () => void {
    const channel = this.#options.openChannel?.();
    this.#channel = channel;
    const locks = 'locks' in this.#options ? this.#options.locks : browserLocks();
    const graceMs = this.#options.graceMs ?? GRACE_MS;
    const role = this.#role;
    const deckId = this.deck.id;
    const releases: (() => void)[] = [];
    let stopWatchingPresenter: (() => void) | undefined;

    if (locks && channel && (role === 'presenter' || role === 'audience')) {
      releases.push(locks.hold(lockName(deckId, role)));
    }
    const watchAudience = () => {
      this.#stopWatchingAudience?.();
      if (!locks) return;
      this.#stopWatchingAudience = watchGone(
        locks,
        lockName(deckId, 'audience'),
        () => {
          this.markAudienceGone();
        },
        graceMs,
      );
    };

    const stop = channel?.listen((message) => {
      if (message.type === 'place') {
        this.#set(clampPlace(this.deck, message.place), false);
        // The audience window has heard from the presenter view: from now on it watches it.
        if (role === 'audience' && locks && !stopWatchingPresenter) {
          stopWatchingPresenter = watchGone(
            locks,
            lockName(deckId, 'presenter'),
            () => {
              this.#finish();
            },
            graceMs,
          );
        }
      } else if (message.type === 'end') {
        this.#finish();
      } else if (role === 'presenter') {
        // A window that has opened asks where the show is. It is there now, and is watched from now on.
        this.#setAudience('here');
        watchAudience();
        channel.post({ type: 'place', place: this.#place });
      }
    });
    // A window that opens after the show began asks where it is; a presenter that opens (or opens again,
    // after a reload) tells the other window where the show is.
    if (role === 'audience') channel?.post({ type: 'hello' });
    else if (role === 'presenter') channel?.post({ type: 'place', place: this.#place });
    this.#connections += 1;

    return () => {
      stop?.();
      stopWatchingPresenter?.();
      this.#stopWatchingAudience?.();
      this.#stopWatchingAudience = undefined;
      for (const release of releases) release();
      channel?.close();
      if (this.#channel === channel) this.#channel = undefined;
      this.#connections -= 1;
      // A presenter view that goes away without the show ending (the browser's Back button) must not
      // leave the audience window up. Wait a moment: a page tried out twice connects again at once.
      if (role === 'presenter') {
        setTimeout(() => {
          this.#abandon();
        }, 0);
      }
    };
  }

  #abandon(): void {
    if (this.#connections > 0 || this.#ended) return;
    const line = this.#options.openChannel?.();
    line?.post({ type: 'end' });
    line?.close();
    this.#ended = true;
  }

  /** The current place; a new object whenever it changes (for `useSyncExternalStore`). */
  readonly getPlace = (): ShowPlace => this.#place;

  /** What the presenter view knows of the audience window. */
  readonly getAudience = (): AudienceState => this.#audience;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Called once when the show ends, from either window. */
  readonly onEnd = (listener: () => void): (() => void) => {
    this.#endListeners.add(listener);
    return () => {
      this.#endListeners.delete(listener);
    };
  };

  get ended(): boolean {
    return this.#ended;
  }

  /** The audience window is known to be gone (its lock is free, or the window says it is closed). */
  markAudienceGone = (): void => {
    this.#setAudience('gone');
  };

  /** A new audience window has been asked for (Reconnect): it is not known until it says hello. */
  expectAudience = (): void => {
    this.#stopWatchingAudience?.();
    this.#stopWatchingAudience = undefined;
    this.#setAudience('unknown');
  };

  forward = (): void => {
    this.#set(forward(this.deck, this.#place), true);
  };

  back = (): void => {
    this.#set(back(this.deck, this.#place), true);
  };

  jump = (slide: number): void => {
    this.#set(jumpTo(this.deck, slide), true);
  };

  toStart = (): void => {
    this.#set(toStart(this.deck), true);
  };

  toEnd = (): void => {
    this.#set(toEnd(this.deck), true);
  };

  blank = (colour: 'black' | 'white'): void => {
    this.#set(toggleBlank(this.#place, colour), true);
  };

  /** End the show, here and in the other window. */
  end = (): void => {
    if (this.#ended) return;
    this.#channel?.post({ type: 'end' });
    this.#finish();
  };

  #set(next: ShowPlace, broadcast: boolean): void {
    const was = this.#place;
    if (next.slide === was.slide && next.click === was.click && next.blank === was.blank) return;
    this.#place = next;
    this.#options.onPlace?.(next);
    if (broadcast) this.#channel?.post({ type: 'place', place: next });
    for (const listener of this.#listeners) listener();
  }

  #setAudience(next: AudienceState): void {
    if (this.#audience === next) return;
    this.#audience = next;
    for (const listener of this.#listeners) listener();
  }

  #finish(): void {
    if (this.#ended) return;
    this.#ended = true;
    for (const listener of this.#endListeners) listener();
  }
}
