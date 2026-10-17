import { routeHash } from '@/model';

/** The window the show opened for the audience, while it is open (this tab is the presenter view). */
let audience: Window | null = null;

/** The name the audience window is opened under, so one show never opens two. */
const WINDOW_NAME = 'cue-audience';

/** What the pop-up is asked to be: a window, not a tab, of a size a projector can take. */
const WINDOW_FEATURES = 'popup=yes,width=1280,height=720';

/**
 * Open the audience window for a show (PM-1). It has to be called straight from the click that starts the
 * show, or the browser blocks the pop-up. Returns whether the window opened; when it did not, the editor
 * says how to allow it and offers to present in one window.
 *
 * Where the browser knows of a second display (Window Management, Chromium) and allows it, the window is
 * then moved onto it, so the presenter view stays on the laptop.
 */
export function openAudienceWindow(deckId: string, slide: number): boolean {
  const address = new URL(window.location.href);
  address.hash = routeHash({ page: 'show', deckId, view: 'audience', slide });
  const opened = window.open(address.href, WINDOW_NAME, WINDOW_FEATURES);
  audience = opened;
  if (!opened) return false;
  void moveToOtherDisplay(opened);
  return true;
}

/** Close the audience window, if this tab opened one and it is still open (the show has ended). */
export function closeAudienceWindow(): void {
  if (audience && !audience.closed) audience.close();
  audience = null;
}

/** The audience window this tab opened has been closed (by the person at the show, not by us). */
export function audienceWindowClosed(): boolean {
  return audience?.closed === true;
}

/** Whether the audience window this tab opened is still open. */
export function audienceWindowOpen(): boolean {
  return audience !== null && !audience.closed;
}

interface Display {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function numberOf(from: object, key: string): number | undefined {
  const value: unknown = Reflect.get(from, key);
  return typeof value === 'number' ? value : undefined;
}

function displayOf(screen: unknown): Display | undefined {
  if (typeof screen !== 'object' || screen === null) return undefined;
  const left = numberOf(screen, 'availLeft');
  const top = numberOf(screen, 'availTop');
  const width = numberOf(screen, 'availWidth');
  const height = numberOf(screen, 'availHeight');
  if (left === undefined || top === undefined || width === undefined || height === undefined) {
    return undefined;
  }
  return { left, top, width, height };
}

/** The first display that is not the one this window is on, from the Window Management API's details. */
function otherDisplay(details: unknown): Display | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const current: unknown = Reflect.get(details, 'currentScreen');
  const screens: unknown = Reflect.get(details, 'screens');
  if (!Array.isArray(screens)) return undefined;
  const other: unknown = screens.find((screen: unknown) => screen !== current);
  return displayOf(other);
}

async function moveToOtherDisplay(opened: Window): Promise<void> {
  try {
    // `isExtended` says there is more than one display without asking for anything.
    if (Reflect.get(window.screen, 'isExtended') !== true) return;
    const ask: unknown = Reflect.get(window, 'getScreenDetails');
    if (typeof ask !== 'function') return;
    const details: unknown = await ask.call(window);
    const display = otherDisplay(details);
    if (!display || opened.closed) return;
    opened.moveTo(display.left, display.top);
    opened.resizeTo(display.width, display.height);
  } catch {
    // No permission, or no such API: the window stays where the browser put it, and the presenter drags it.
  }
}
