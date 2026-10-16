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

/**
 * A show as one window holds it (PM-1, PM-2, PM-3): where it is, the moves, and the line to the other
 * window. The deck is read once, when the show starts, and held for its whole length: nothing edits it
 * while the tab is the presenter view. Moves made here are sent across; moves heard from the other
 * window are taken as they are and never sent back.
 *
 * The presenter answers a window that has just opened ("hello") with where the show is, so a window
 * that opens late, or after "Present from current slide", starts in the right place.
 */

export type ShowRole = 'presenter' | 'audience' | 'single';

export class Show {
  readonly deck: Deck;
  readonly #role: ShowRole;
  readonly #open: (() => ShowChannel) | undefined;
  readonly #listeners = new Set<() => void>();
  readonly #endListeners = new Set<() => void>();
  #channel: ShowChannel | undefined;
  #place: ShowPlace;
  #ended = false;
  /** Lines open now: more than one only while a development build tries a page out twice. */
  #connections = 0;

  /**
   * `openChannel` makes the line to the other window when the show connects (a show in one window has
   * none). Making a show does nothing else, so it can be made while a page is being drawn.
   */
  constructor(deck: Deck, start: ShowPlace, role: ShowRole, openChannel?: () => ShowChannel) {
    this.deck = deck;
    this.#role = role;
    this.#open = openChannel;
    this.#place = clampPlace(deck, start);
  }

  /** Open the line to the other window and listen. Returns how to hang up (for an effect's cleanup). */
  connect(): () => void {
    const channel = this.#open?.();
    this.#channel = channel;
    const stop = channel?.listen((message) => {
      if (message.type === 'place') this.#set(clampPlace(this.deck, message.place), false);
      else if (message.type === 'end') this.#finish();
      else if (this.#role === 'presenter') channel.post({ type: 'place', place: this.#place });
    });
    // A window that opens after the show began asks where it is; a presenter that opens (or opens again,
    // after a reload) tells the other window where the show is.
    if (this.#role === 'audience') channel?.post({ type: 'hello' });
    else if (this.#role === 'presenter') channel?.post({ type: 'place', place: this.#place });
    this.#connections += 1;
    return () => {
      stop?.();
      channel?.close();
      if (this.#channel === channel) this.#channel = undefined;
      this.#connections -= 1;
      // A presenter view that goes away without the show ending (the browser's Back button) must not
      // leave the audience window up. Wait a moment: a page tried out twice connects again at once.
      if (this.#role === 'presenter') {
        setTimeout(() => {
          this.#abandon();
        }, 0);
      }
    };
  }

  #abandon(): void {
    if (this.#connections > 0 || this.#ended) return;
    const line = this.#open?.();
    line?.post({ type: 'end' });
    line?.close();
    this.#ended = true;
  }

  /** The current place; a new object whenever it changes (for `useSyncExternalStore`). */
  readonly getPlace = (): ShowPlace => this.#place;

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
    if (broadcast) this.#channel?.post({ type: 'place', place: next });
    for (const listener of this.#listeners) listener();
  }

  #finish(): void {
    if (this.#ended) return;
    this.#ended = true;
    for (const listener of this.#endListeners) listener();
  }
}
