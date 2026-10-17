import type { Blank, ShowPlace } from '@/model';

/**
 * What the two windows of a show say to each other (PM-3). Only the place goes across (the slide, the
 * click on it and whether the screen is blanked), as the stack says; each window draws it from the
 * stored deck. `hello` is a window that has just opened asking where the show is.
 */
export type ShowMessage =
  | { readonly type: 'place'; readonly place: ShowPlace }
  | { readonly type: 'hello' }
  | { readonly type: 'end' };

const BLANKS: readonly Blank[] = ['none', 'black', 'white'];

function isBlank(value: unknown): value is Blank {
  return BLANKS.some((blank) => blank === value);
}

function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** A message from the channel, or nothing for anything that is not one (the channel is not trusted). */
export function parseMessage(data: unknown): ShowMessage | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const type: unknown = Reflect.get(data, 'type');
  if (type === 'hello') return { type: 'hello' };
  if (type === 'end') return { type: 'end' };
  if (type !== 'place') return undefined;
  const place: unknown = Reflect.get(data, 'place');
  if (typeof place !== 'object' || place === null) return undefined;
  const slide: unknown = Reflect.get(place, 'slide');
  const click: unknown = Reflect.get(place, 'click');
  const blank: unknown = Reflect.get(place, 'blank');
  if (!isWhole(slide) || !isWhole(click) || !isBlank(blank)) return undefined;
  return { type: 'place', place: { slide, click, blank } };
}

/** One end of the line between a show's windows. */
export interface ShowChannel {
  readonly post: (message: ShowMessage) => void;
  /** Hear messages from the other windows (never one's own). Returns how to stop. */
  readonly listen: (handler: (message: ShowMessage) => void) => () => void;
  readonly close: () => void;
}

/** The name windows of one deck's show meet on. */
export function channelName(deckId: string): string {
  return `cue-show:${deckId}`;
}

/** A BroadcastChannel for the show of a deck. Where there is none, a channel that talks to nobody. */
export function createShowChannel(deckId: string): ShowChannel {
  if (typeof BroadcastChannel === 'undefined') {
    return { post: () => undefined, listen: () => () => undefined, close: () => undefined };
  }
  const channel = new BroadcastChannel(channelName(deckId));
  return {
    post: (message) => {
      channel.postMessage(message);
    },
    listen: (handler) => {
      const onMessage = (event: MessageEvent<unknown>) => {
        const message = parseMessage(event.data);
        if (message) handler(message);
      };
      channel.addEventListener('message', onMessage);
      return () => {
        channel.removeEventListener('message', onMessage);
      };
    },
    close: () => {
      channel.close();
    },
  };
}
