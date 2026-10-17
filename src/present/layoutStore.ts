/**
 * How the presenter view is laid out, kept between shows (PM-4): how much of the window the slides take
 * (the rest is the notes) and how big the notes text is. It is a habit of the person at the screen, not of a
 * deck, so it is remembered on this browser, in `localStorage`, for every deck.
 */

export interface PresenterLayout {
  /** The height of the slide previews, as a share of the window's height, in percent. */
  readonly topVh: number;
  /** The notes text size, in pixels. */
  readonly notesPx: number;
}

export const TOP_VH = { min: 24, max: 66, step: 2, big: 8 } as const;
export const NOTES_PX = { min: 14, max: 40, step: 2 } as const;

/** The board: the slides take about half the window, the notes are 22 px. */
export const DEFAULT_LAYOUT: PresenterLayout = { topVh: 46, notesPx: 22 };

const KEY = 'cue.presenter';

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function clampTopVh(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT.topVh;
  return Math.min(TOP_VH.max, Math.max(TOP_VH.min, Math.round(value)));
}

/** A size in whole steps of 2 px, between the smallest and the largest. */
export function clampNotesPx(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT.notesPx;
  const stepped = Math.round(value / NOTES_PX.step) * NOTES_PX.step;
  return Math.min(NOTES_PX.max, Math.max(NOTES_PX.min, stepped));
}

function storage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    return window.localStorage;
  } catch {
    // Blocked (a private window, a policy): the layout is the default each time.
    return undefined;
  }
}

/** What was kept, with anything stray or missing put right; the default where nothing was kept. */
export function readLayout(): PresenterLayout {
  try {
    const text = storage()?.getItem(KEY);
    if (text === null || text === undefined) return DEFAULT_LAYOUT;
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return DEFAULT_LAYOUT;
    const topVh: unknown = Reflect.get(raw, 'topVh');
    const notesPx: unknown = Reflect.get(raw, 'notesPx');
    return {
      topVh: finite(topVh) ? clampTopVh(topVh) : DEFAULT_LAYOUT.topVh,
      notesPx: finite(notesPx) ? clampNotesPx(notesPx) : DEFAULT_LAYOUT.notesPx,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function writeLayout(layout: PresenterLayout): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Nothing to do: the layout just is not kept.
  }
}
