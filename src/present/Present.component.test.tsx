import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import {
  createDeck,
  createShape,
  createSlide,
  createStep,
  startShow,
  type Deck,
  type Env,
  type ShowPlace,
} from '@/model';
import { AudienceWindow } from './AudienceWindow';
import { clickSummary, formatElapsed, PresenterView } from './PresenterView';
import { Show } from './show';

const env: Env = { newId: () => 'id', now: () => 0 };
const box = { x: 200, y: 100, width: 400, height: 300 };

/** Three slides; the second has notes, two clicks and something that moves. */
const deck: Deck = {
  ...createDeck(env, 'Talk'),
  slides: [
    { ...createSlide('a'), notes: '' },
    {
      ...createSlide('b'),
      notes: 'Open with the customer problem.',
      elements: [createShape('e1', 'rectangle', box), createShape('e2', 'ellipse', box)],
      animations: [
        createStep('s1', 'e1', 'appear'),
        { ...createStep('s2', 'e2', 'move'), effect: 'move', x: 900, y: 400 },
      ],
    },
    { ...createSlide('c'), notes: 'Thank them.' },
  ],
};

const shows: Show[] = [];
const join = (start: ShowPlace = startShow(deck)) => {
  const show = new Show(deck, start, 'presenter');
  shows.push(show);
  return show;
};

afterEach(() => {
  localStorage.clear();
  shows.length = 0;
  vi.restoreAllMocks();
});

const stagesIn = () =>
  [...document.querySelectorAll<HTMLElement>('.show-stage .cue-layer .cue-slide')].map(
    (slide) => slide.dataset.slideId,
  );
const opacityOf = (id: string) => {
  const node = document.querySelector(`.show-stage [data-element-id="${id}"]`);
  if (!node) throw new Error(`no ${id}`);
  return Number(getComputedStyle(node).opacity);
};

describe('the presenter view (PM-2)', () => {
  test('Given a show at slide 2, When the view opens, Then it has the slide, what is next, the notes, every slide, the timer and the clock', async () => {
    const show = join(startShow(deck, 1));

    const screen = await render(<PresenterView show={show} />);

    await expect.element(screen.getByRole('heading', { name: 'Talk', level: 1 })).toBeVisible();
    await expect.element(screen.getByText('Slide 2 of 3')).toBeVisible();
    await expect
      .element(screen.getByText('No clicks').or(screen.getByText('Click 0 of 2')))
      .toBeVisible();
    await expect.element(screen.getByText('Open with the customer problem.')).toBeVisible();
    await expect
      .element(screen.getByRole('heading', { name: 'Next · Click 1 of 2' }))
      .toBeVisible();
    // Every slide, with the current one marked.
    const strip = screen.getByRole('region', { name: 'All slides' });
    await expect
      .element(strip.getByRole('button', { name: 'Slide 2', exact: true }))
      .toHaveAttribute('aria-current', 'true');
    expect(strip.getByRole('button').elements()).toHaveLength(3);
    await expect.element(screen.getByLabelText('Time of day')).toBeVisible();
    await expect.element(screen.getByLabelText(/^Elapsed/)).toHaveTextContent('00:00');
    expect(stagesIn()).toEqual(['b']);
  });

  test('Given the next click, Then the badge says what it does, and the preview shows that state', async () => {
    const show = join(startShow(deck, 1));
    const screen = await render(<PresenterView show={show} />);

    await expect.element(screen.getByText('Appears')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Next click' }).element());
    await expect
      .element(screen.getByRole('heading', { name: 'Next · Click 2 of 2' }))
      .toBeVisible();
    await expect.element(screen.getByText('Moves')).toBeVisible();
    await expect.element(screen.getByText('Click 1 of 2')).toBeVisible();
    // The picture fades in, then it is at its own opacity.
    await expect.poll(() => opacityOf('e1')).toBe(1);
  });

  test('Given the last click of the last slide, Then the next preview says End of presentation and the button ends the show', async () => {
    const show = join(startShow(deck, 2));
    const ended = vi.fn();
    show.onEnd(ended);
    const screen = await render(<PresenterView show={show} />);

    await expect.element(screen.getByText('End of presentation')).toBeVisible();
    await expect.element(screen.getByText('last slide')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'End show' }).last().element());

    expect(ended).toHaveBeenCalledTimes(1);
  });

  test('Given the first place of the show, Then Back is off; after a move it steps back', async () => {
    const show = join();
    const screen = await render(<PresenterView show={show} />);
    await expect.element(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next slide' }).element());
    await expect.element(screen.getByText('Slide 2 of 3')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }).element());

    await expect.element(screen.getByText('Slide 1 of 3')).toBeVisible();
    expect(show.getPlace()).toEqual({ slide: 0, click: 0, blank: 'none' });
  });

  test('Given the Blank screen button, When it is pressed twice, Then the screen blanks and comes back, and the view says so', async () => {
    const show = join();
    const screen = await render(<PresenterView show={show} />);
    const blank = screen.getByRole('button', { name: 'Blank screen' });

    await userEvent.click(blank.element());
    await expect.element(screen.getByText(/Black screen: press B/)).toBeVisible();
    await expect.element(blank).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(blank.element());

    expect(show.getPlace().blank).toBe('none');
  });

  test('Given the keys, Then Right, Left, W and End move the show, and a typed number then Enter jumps', async () => {
    const show = join();
    await render(<PresenterView show={show} />);

    await userEvent.keyboard('{ArrowRight}');
    expect(show.getPlace()).toEqual({ slide: 1, click: 0, blank: 'none' });
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(show.getPlace()).toEqual({ slide: 1, click: 2, blank: 'none' });
    await userEvent.keyboard('{ArrowLeft}');
    expect(show.getPlace().click).toBe(1);
    await userEvent.keyboard('w');
    expect(show.getPlace().blank).toBe('white');
    await userEvent.keyboard('w');
    await userEvent.keyboard('{End}');
    expect(show.getPlace().slide).toBe(2);
    await userEvent.keyboard('2{Enter}');
    expect(show.getPlace().slide).toBe(1);
    await userEvent.keyboard('{Home}');
    expect(show.getPlace().slide).toBe(0);
  });

  test('Given the Jump to box, When a number is typed and Enter pressed, Then it jumps there and the box is cleared', async () => {
    const show = join();
    const screen = await render(<PresenterView show={show} />);
    const box = screen.getByLabelText('Jump to');

    await userEvent.fill(box.element(), '3');
    await userEvent.keyboard('{Enter}');

    expect(show.getPlace().slide).toBe(2);
    await expect.element(box).toHaveValue('');
  });

  test('Given the timer, When it is paused, started and reset, Then the buttons say what they do', async () => {
    const show = join();
    const screen = await render(<PresenterView show={show} />);

    await expect.element(screen.getByRole('button', { name: 'Start timer' })).toBeVisible();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(screen.getByRole('button', { name: 'Pause timer' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Pause timer' }).element());
    await expect.element(screen.getByRole('button', { name: 'Start timer' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Reset timer' }).element());

    await expect.element(screen.getByLabelText(/^Elapsed/)).toHaveTextContent('00:00');
  });
});

describe('the notes panel (PM-4)', () => {
  /** The view as the app has it: as tall as the window, which is what gives the notes their room. */
  const inWindow = (view: React.ReactElement) =>
    render(<div style={{ height: '100vh' }}>{view}</div>);
  const separator = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.getByRole('separator', { name: 'Resize notes' });
  const topHeight = () => must('.pv-top').getBoundingClientRect().height;

  test('Given the divider, When it is moved with the arrow keys, Then the slides give the notes more or less room, and the show does not move', async () => {
    const show = join(startShow(deck, 1));
    const screen = await inWindow(<PresenterView show={show} />);
    const handle = separator(screen);
    await expect.element(handle).toHaveAttribute('aria-valuenow', '46');
    const before = topHeight();

    await userEvent.click(handle.element());
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '44');
    expect(topHeight()).toBeLessThan(before);
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '36');
    await userEvent.keyboard('{Home}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '24');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '24');
    await userEvent.keyboard('{End}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '66');
    await userEvent.keyboard('{ArrowDown}');

    // The arrows were the divider's, not the show's.
    expect(show.getPlace()).toEqual({ slide: 1, click: 0, blank: 'none' });
  });

  test('Given a smaller share for the slides, Then the slide on screen reflows to fit what is left', async () => {
    const show = join();
    const screen = await inWindow(<PresenterView show={show} />);
    const wide = must('.pv-now-frame').getBoundingClientRect().width;

    await userEvent.click(separator(screen).element());
    await userEvent.keyboard('{Home}');

    const narrow = must('.pv-now-frame').getBoundingClientRect();
    expect(narrow.width).toBeLessThan(wide);
    expect(narrow.width / narrow.height).toBeCloseTo(16 / 9, 1);
  });

  test('Given A+ and A−, Then the notes text grows and shrinks in steps of 2 px, within limits, and the panel does not change size', async () => {
    const show = join(startShow(deck, 1));
    const screen = await inWindow(<PresenterView show={show} />);
    const notes = () => getComputedStyle(must('.pv-notes-text')).fontSize;
    const before = topHeight();
    expect(notes()).toBe('22px');

    await userEvent.click(screen.getByRole('button', { name: 'Larger text' }).element());
    await expect.element(screen.getByText('24 px')).toBeVisible();
    expect(notes()).toBe('24px');
    await userEvent.click(screen.getByRole('button', { name: 'Smaller text' }).element());
    await userEvent.click(screen.getByRole('button', { name: 'Smaller text' }).element());
    expect(notes()).toBe('20px');
    expect(topHeight()).toBe(before);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Smaller text' }).element());
    }
    await expect.element(screen.getByText('14 px')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Smaller text' })).toBeDisabled();
  });

  test('Given long notes, Then they scroll inside the panel and the rest of the view stays put', async () => {
    const longDeck: Deck = {
      ...deck,
      slides: [
        { ...createSlide('long'), notes: Array(60).fill('A long line of notes.').join('\n') },
      ],
    };
    const show = new Show(longDeck, startShow(longDeck), 'presenter');
    shows.push(show);
    const screen = await inWindow(<PresenterView show={show} />);
    const scroller = must('.pv-notes-scroll');
    const strip = must('.pv-strip').getBoundingClientRect();

    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    expect(getComputedStyle(scroller).overflowY).toBe('auto');
    scroller.scrollTop = 400;
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1);
    expect(must('.pv-strip').getBoundingClientRect().top).toBe(strip.top);
    await expect.element(screen.getByRole('region', { name: 'Notes text' })).toBeVisible();
  });

  test('Given the divider and the text size changed, When a new show starts, Then they are as they were left', async () => {
    const show = join();
    const first = await inWindow(<PresenterView show={show} />);
    await userEvent.click(separator(first).element());
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await userEvent.click(first.getByRole('button', { name: 'Larger text' }).element());
    await userEvent.click(first.getByRole('button', { name: 'Larger text' }).element());
    await first.unmount();

    const second = await inWindow(<PresenterView show={join()} />);

    await expect.element(separator(second)).toHaveAttribute('aria-valuenow', '42');
    await expect.element(second.getByText('26 px')).toBeVisible();
  });

  test('Given nothing kept or something spoiled, Then the notes panel starts at the board sizes', async () => {
    localStorage.setItem('cue.presenter', 'garbage');

    const screen = await render(<PresenterView show={join()} />);

    await expect.element(separator(screen)).toHaveAttribute('aria-valuenow', '46');
    await expect.element(screen.getByText('22 px')).toBeVisible();
  });
});

describe('the presenter view when the audience window is gone (PM-3)', () => {
  test('Given an audience window that is gone, Then the view says so and offers Reconnect; given it is not, Then it says nothing', async () => {
    const show = join();
    const reconnect = vi.fn();
    const screen = await render(<PresenterView show={show} onReconnect={reconnect} />);
    expect(screen.getByRole('status').elements()).toHaveLength(0);

    show.markAudienceGone();

    await expect
      .element(screen.getByText('The audience window was closed. The show goes on here.'))
      .toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect' }).element());
    expect(reconnect).toHaveBeenCalledTimes(1);
    // The show goes on meanwhile.
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(screen.getByText('Slide 2 of 3')).toBeVisible();
  });

  test('Given a new audience window being asked for, Then the notice goes; given the browser blocked it, Then it says how to allow it', async () => {
    const show = join();
    const screen = await render(<PresenterView show={show} blocked onReconnect={vi.fn()} />);
    show.markAudienceGone();

    await expect
      .element(screen.getByText(/Your browser blocked the audience window/))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible();

    show.expectAudience();

    await expect.poll(() => screen.getByRole('status').elements()).toHaveLength(0);
  });
});

describe('the audience window (PM-1, PM-2)', () => {
  test('Given a show, When the window opens, Then it has the slide and only a hint, and no controls', async () => {
    const show = join(startShow(deck, 1));

    const screen = await render(<AudienceWindow show={show} />);

    expect(stagesIn()).toEqual(['b']);
    await expect.element(screen.getByText(/to end the show/)).toBeVisible();
    expect(document.querySelectorAll('button, input, a, [tabindex]')).toHaveLength(0);
    expect(getComputedStyle(must('.audience')).cursor).toBe('none');
  });

  test('Given the slide, When the window is any size, Then the frame is the largest 16:9 box that fits', async () => {
    const show = join();
    await render(<AudienceWindow show={show} />);

    const frame = must('.audience-frame').getBoundingClientRect();

    // The test window is 1440 wide and 900 tall: the width is what limits it.
    expect(frame.width).toBeCloseTo(1440, 0);
    expect(frame.height).toBeCloseTo((1440 * 9) / 16, 0);
  });

  test('Given the keys, Then they move the show, B and W blank the window in black and in white, and the hint goes after a while', async () => {
    const show = join();
    await render(<AudienceWindow show={show} />);

    await userEvent.keyboard('{ArrowRight}');
    expect(stagesIn()).toEqual(['b']);
    await userEvent.keyboard('b');
    expect(must('.audience-blank').dataset.colour).toBe('black');
    await userEvent.keyboard('w');
    expect(must('.audience-blank').dataset.colour).toBe('white');
    await userEvent.keyboard('w');
    expect(document.querySelector('.audience-blank')).toBeNull();
    await expect.poll(() => document.querySelector('.audience-hint'), { timeout: 5000 }).toBeNull();
  });

  test('Given Escape, Then the show ends', async () => {
    const show = join();
    const ended = vi.fn();
    show.onEnd(ended);
    await render(<AudienceWindow show={show} />);

    await userEvent.keyboard('{Escape}');

    expect(ended).toHaveBeenCalledTimes(1);
  });
});

describe('what the presenter view says', () => {
  test.each([
    [[], ''],
    [[createStep('1', 'a', 'appear')], 'Appears'],
    [[createStep('1', 'a', 'appear'), createStep('2', 'b', 'appear', 'with-previous')], 'Appears'],
    [
      [createStep('1', 'a', 'appear'), createStep('2', 'b', 'disappear', 'with-previous')],
      'Appears · Disappears',
    ],
  ])(
    'Given the steps of a click %#, When they are summed up, Then the badge reads "%s"',
    (steps, label) => {
      expect(clickSummary(steps)).toBe(label);
    },
  );

  test.each([
    [0, '00:00'],
    [999, '00:00'],
    [61_000, '01:01'],
    [12 * 60_000 + 48_000, '12:48'],
    [3_725_000, '1:02:05'],
    [-5, '00:00'],
  ])('Given %d ms, When the elapsed time is formatted, Then it reads %s', (ms, text) => {
    expect(formatElapsed(ms)).toBe(text);
  });
});

function must(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`nothing matches ${selector}`);
  return node;
}
