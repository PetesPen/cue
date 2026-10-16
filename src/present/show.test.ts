import { describe, expect, test, vi } from 'vitest';
import { createDeck, createSlide, createStep, type Deck, type Env, type ShowPlace } from '@/model';
import { parseMessage, type ShowChannel, type ShowMessage } from './channel';
import { Show, type ShowRole } from './show';

const env: Env = { newId: () => 'id', now: () => 0 };

/** Three slides: the second has two clicks. */
const deck: Deck = {
  ...createDeck(env),
  slides: [
    createSlide('a'),
    {
      ...createSlide('b'),
      animations: [createStep('s1', 'e1', 'appear'), createStep('s2', 'e2', 'appear')],
    },
    createSlide('c'),
  ],
};

/** Two ends of a line, like two windows on a BroadcastChannel: a message reaches the other end only. */
function line() {
  const sent: ShowMessage[] = [];
  const handlers: [Set<(m: ShowMessage) => void>, Set<(m: ShowMessage) => void>] = [
    new Set(),
    new Set(),
  ];
  const end = (me: 0 | 1): ShowChannel => ({
    post: (message) => {
      sent.push(message);
      for (const handler of handlers[me === 0 ? 1 : 0]) handler(message);
    },
    listen: (handler) => {
      handlers[me].add(handler);
      return () => {
        handlers[me].delete(handler);
      };
    },
    close: () => {
      handlers[me].clear();
    },
  });
  return { presenter: end(0), audience: end(1), sent };
}

/** A window joining the show: made, then connected. */
function join(role: ShowRole, start: ShowPlace, channel?: ShowChannel) {
  const show = new Show(deck, start, role, channel && (() => channel));
  const hangUp = show.connect();
  return Object.assign(show, { hangUp });
}

const at = (slide: number, click = 0, blank: ShowPlace['blank'] = 'none'): ShowPlace => ({
  slide,
  click,
  blank,
});

describe('a show in one window (PM-6)', () => {
  test('Given a show, When the moves are made, Then the place follows and listeners hear each change', () => {
    const show = join('single', at(0));
    const heard = vi.fn();
    show.subscribe(heard);

    show.forward();
    show.forward();
    show.forward();
    show.back();
    show.jump(0);
    show.toEnd();
    show.toStart();
    show.blank('black');

    expect(show.getPlace()).toEqual(at(0, 0, 'black'));
    expect(heard).toHaveBeenCalledTimes(8);
  });

  test('Given a move that changes nothing, When it is made, Then nobody is told and the place is the same object', () => {
    const show = join('single', at(2));
    const before = show.getPlace();
    const heard = vi.fn();
    show.subscribe(heard);

    show.forward();

    expect(show.getPlace()).toBe(before);
    expect(heard).not.toHaveBeenCalled();
  });

  test('Given a start past the deck, When the show begins, Then it is on the nearest slide that exists', () => {
    expect(join('single', at(9, 9)).getPlace()).toEqual(at(2));
  });

  test('Given a show, When it ends, Then the end is heard once, and a stopped listener hears nothing', () => {
    const show = join('single', at(0));
    const ended = vi.fn();
    const stopped = vi.fn();
    show.onEnd(ended);
    show.onEnd(stopped)();

    show.end();
    show.end();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(stopped).not.toHaveBeenCalled();
    expect(show.ended).toBe(true);
  });
});

describe('two windows of a show (PM-3)', () => {
  test('Given a presenter and an audience window, When the presenter moves, Then the audience is at the same place, and nothing is sent back', () => {
    const { presenter, audience, sent } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);
    sent.length = 0;

    here.forward();
    here.forward();

    expect(there.getPlace()).toEqual(at(1, 1));
    expect(sent).toEqual([
      { type: 'place', place: at(1) },
      { type: 'place', place: at(1, 1) },
    ]);
  });

  test('Given the same two windows, When the audience window moves, Then the presenter follows', () => {
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);

    there.jump(2);

    expect(here.getPlace()).toEqual(at(2));
  });

  test('Given a show under way, When an audience window opens, Then it asks, and the presenter tells it where the show is', () => {
    const { presenter, audience } = line();
    const here = join('presenter', at(1, 1), presenter);

    const there = join('audience', at(0), audience);

    expect(there.getPlace()).toEqual(at(1, 1));
    expect(here.getPlace()).toEqual(at(1, 1));
  });

  test('Given a blank screen, When the other window hears it, Then it is blank there too', () => {
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);

    here.blank('white');
    expect(there.getPlace().blank).toBe('white');
    here.blank('white');
    expect(there.getPlace().blank).toBe('none');
  });

  test('Given a place from the other window beyond this deck, When it is heard, Then it is brought to one that exists', () => {
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    audience.post({ type: 'place', place: at(40, 40) });

    expect(here.getPlace()).toEqual(at(2));
  });

  test.each(['presenter', 'audience'] as const)(
    'Given two windows, When the show is ended from the %s, Then it ends in both',
    (from) => {
      const { presenter, audience } = line();
      const here = join('presenter', at(0), presenter);
      const there = join('audience', at(0), audience);
      const endedHere = vi.fn();
      const endedThere = vi.fn();
      here.onEnd(endedHere);
      there.onEnd(endedThere);

      (from === 'presenter' ? here : there).end();

      expect(endedHere).toHaveBeenCalledTimes(1);
      expect(endedThere).toHaveBeenCalledTimes(1);
    },
  );

  test('Given a window that has hung up, When the other window moves, Then it hears nothing', () => {
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);

    there.hangUp();
    here.forward();

    expect(there.getPlace()).toEqual(at(0));
  });
});

describe('a presenter view that goes away (PM-1)', () => {
  test('Given a presenter view that unmounts without the show ending, When a moment passes, Then the audience window is told the show is over', () => {
    vi.useFakeTimers();
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);
    const ended = vi.fn();
    there.onEnd(ended);

    here.hangUp();
    expect(ended).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(ended).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test('Given a page tried out twice, When the presenter view hangs up and connects again at once, Then the show goes on', () => {
    vi.useFakeTimers();
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);
    const ended = vi.fn();
    there.onEnd(ended);

    here.hangUp();
    const again = here.connect();
    vi.runAllTimers();

    expect(ended).not.toHaveBeenCalled();
    again();
    vi.useRealTimers();
  });

  test('Given a show ended from the presenter view, When the view then unmounts, Then no second end is sent', () => {
    vi.useFakeTimers();
    const { presenter, audience, sent } = line();
    const here = join('presenter', at(0), presenter);
    join('audience', at(0), audience);
    here.end();
    const before = sent.filter((message) => message.type === 'end').length;

    here.hangUp();
    vi.runAllTimers();

    expect(sent.filter((message) => message.type === 'end')).toHaveLength(before);
    vi.useRealTimers();
  });

  test('Given an audience window that is closed, When it hangs up, Then the presenter view carries on', () => {
    vi.useFakeTimers();
    const { presenter, audience } = line();
    const here = join('presenter', at(0), presenter);
    const there = join('audience', at(0), audience);
    const ended = vi.fn();
    here.onEnd(ended);

    there.hangUp();
    vi.runAllTimers();
    here.forward();

    expect(ended).not.toHaveBeenCalled();
    expect(here.getPlace().slide).toBe(1);
    vi.useRealTimers();
  });
});

describe('parseMessage: the channel is not trusted', () => {
  test.each<[string, unknown, ShowMessage | undefined]>([
    ['hello', { type: 'hello' }, { type: 'hello' }],
    ['end', { type: 'end' }, { type: 'end' }],
    [
      'a place',
      { type: 'place', place: { slide: 2, click: 1, blank: 'black' } },
      { type: 'place', place: at(2, 1, 'black') },
    ],
    [
      'a place with a fractional slide',
      { type: 'place', place: { slide: 1.5, click: 0, blank: 'none' } },
      undefined,
    ],
    [
      'a place with a negative click',
      { type: 'place', place: { slide: 1, click: -1, blank: 'none' } },
      undefined,
    ],
    [
      'a place with an unknown blank',
      { type: 'place', place: { slide: 1, click: 0, blank: 'red' } },
      undefined,
    ],
    ['a place with no place', { type: 'place' }, undefined],
    ['an unknown type', { type: 'launch' }, undefined],
    ['null', null, undefined],
    ['a string', 'end', undefined],
  ])('Given %s, When it is parsed, Then it is %j', (_name, data, message) => {
    expect(parseMessage(data)).toEqual(message);
  });
});
