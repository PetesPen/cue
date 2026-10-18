import {
  NUMBER_WAIT_MS,
  PAGE_KEYS,
  SHOW_KEYS,
  back,
  clampPlace,
  forward,
  imageHashes,
  jumpTo,
  movement,
  pageActionFor,
  showActionFor,
  startShow,
  toEnd,
  toStart,
  toggleBlank,
  typeDigit,
  upcomingLabel,
  type PageAction,
  type ShowAction,
  type ShowPlace,
} from '@/model';
import { createSlideStage, setImageSource, type Look } from '@/render';
import { imageSourceFor, type PageData } from './data';
import './page.css';

/**
 * The exported web page (SV-4): one deck shown the way the editor's show shows it, with the keys of the
 * show, the slides drawn by the shared renderer, and a few things only a page needs: a bar of buttons
 * that appears when the pointer moves, notes beside the slide, tap and swipe for a touch screen, and a
 * list of the keys. It reads its deck from its own page and talks to nothing else.
 */

/** How long the bar of buttons stays after the last movement. */
const BAR_MS = 3000;
/** A swipe is at least this far across, and more across than up or down. */
const SWIPE_PX = 50;
/** A tap moves less than this. */
const TAP_PX = 12;

const lookAt = (place: ShowPlace): Look => ({ mode: 'click', click: place.click });

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(label: string, text: string, onClick: () => void): HTMLButtonElement {
  const node = create('button', 'cp-button', text);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.addEventListener('click', onClick);
  return node;
}

/** The key caps and the words for one key of the list. */
function keyRow(caps: readonly string[], label: string): HTMLElement[] {
  const term = create('dt', 'cp-keys-caps');
  caps.forEach((cap, index) => {
    if (index > 0) term.append(' ');
    term.append(create('kbd', 'cp-kbd', cap));
  });
  return [term, create('dd', 'cp-keys-label', label)];
}

/** What the page says of the show's keys: the page has no show to end, and its full screen is its own. */
const SHOWN_IN_LIST = SHOW_KEYS.filter((entry) => entry.action !== 'end');

function buildHelp(licences: string): HTMLDialogElement {
  const dialog = create('dialog', 'cp-help');
  dialog.setAttribute('aria-labelledby', 'cp-help-title');
  const heading = create('h2', 'cp-help-title', 'Keyboard and touch');
  heading.id = 'cp-help-title';
  const list = create('dl', 'cp-keys');
  for (const entry of SHOWN_IN_LIST) {
    list.append(
      ...keyRow(
        entry.caps,
        entry.action === 'fullscreen'
          ? 'Full screen'
          : entry.label.replace(' (audience window)', ''),
      ),
    );
  }
  for (const entry of PAGE_KEYS) list.append(...keyRow(entry.caps, entry.label));
  const touch = create(
    'p',
    'cp-help-note',
    'On a touch screen, tap the right of the slide or swipe left to move on; tap the left or swipe right to go back.',
  );
  const close = button('Close', 'Close', () => {
    dialog.close();
  });
  dialog.append(heading, list, touch);
  if (licences.trim() !== '') {
    const details = create('details', 'cp-licences');
    details.append(create('summary', 'cp-licences-summary', 'Font licences'));
    details.append(create('pre', 'cp-licences-text', licences));
    dialog.append(details);
  }
  dialog.append(close);
  return dialog;
}

/**
 * Draw the page into `root` and start it at slide `startAt` (from 1). Returns a function that takes it
 * down again (the tests use it; the page itself never does).
 */
export function mountPage(root: HTMLElement, data: PageData, startAt = 1): () => void {
  const { deck } = data;
  const total = deck.slides.length;
  const images = imageSourceFor(data.images);
  setImageSource(images);

  let place = clampPlace(deck, startShow(deck, startAt - 1));
  let drawn = place;
  let typed = '';
  let forgetTyped: ReturnType<typeof setTimeout> | undefined;
  let hideBar: ReturnType<typeof setTimeout> | undefined;

  // The slide ------------------------------------------------------------------------------------
  const area = create('main', 'cp-area');
  area.setAttribute('aria-label', deck.title);
  const frame = create('div', 'cp-frame');
  area.append(frame);
  const first = deck.slides[place.slide];
  const stage = first ? createSlideStage(frame, first, lookAt(place)) : undefined;
  const blank = create('div', 'cp-blank');
  blank.hidden = true;
  area.append(blank);

  // The notes ------------------------------------------------------------------------------------
  const notes = create('aside', 'cp-notes');
  notes.setAttribute('aria-label', 'Speaker notes');
  notes.hidden = true;
  const notesHeading = create('h2', 'cp-notes-heading');
  const notesNext = create('p', 'cp-notes-next');
  const notesText = create('div', 'cp-notes-scroll');
  notesText.tabIndex = 0;
  notesText.setAttribute('role', 'region');
  notesText.setAttribute('aria-label', 'Notes text');
  notes.append(notesHeading, notesNext, notesText);

  // The bar and the list of keys ---------------------------------------------------------------
  const count = create('span', 'cp-count');
  count.setAttribute('aria-hidden', 'true');
  const announce = create('div', 'cp-announce');
  announce.setAttribute('aria-live', 'polite');
  const help = buildHelp(data.licences);
  const notesButton = button('Notes', 'Notes', () => {
    toggleNotes();
  });
  notesButton.setAttribute('aria-pressed', 'false');
  notesButton.hidden = !data.notes;
  const fullscreenButton = button('Full screen', 'Full screen', () => {
    toggleFullscreen();
  });
  fullscreenButton.hidden = !document.fullscreenEnabled;
  const bar = create('nav', 'cp-bar');
  bar.setAttribute('aria-label', 'Slide controls');
  bar.append(
    button('Previous', '‹', () => {
      go(back(deck, place));
    }),
    count,
    button('Next', '›', () => {
      go(forward(deck, place));
    }),
    notesButton,
    fullscreenButton,
    button('Keys', '?', () => {
      help.showModal();
    }),
  );

  root.className = 'cp';
  root.dataset.notes = 'closed';
  root.dataset.bar = 'shown';
  root.append(area, notes, bar, announce, help);

  // Moving ---------------------------------------------------------------------------------------
  function draw(): void {
    const slide = deck.slides[place.slide];
    if (!slide || !stage) return;
    const how = movement(deck, drawn, place);
    drawn = place;
    if (how.kind === 'click') void stage.play(slide, how.click - 1, how.click);
    else if (how.kind === 'transition') {
      void stage.transition(slide, lookAt(place), how.transition, how.reversed);
    } else if (how.kind === 'cut') stage.show(slide, lookAt(place));
    blank.hidden = place.blank === 'none';
    blank.dataset.colour = place.blank;
    describePlace();
    preloadNext();
  }

  function describePlace(): void {
    const number = place.slide + 1;
    root.dataset.slide = String(number);
    root.dataset.click = String(place.click);
    root.dataset.blank = place.blank;
    count.textContent = `${String(number)} / ${String(total)}`;
    announce.textContent = `Slide ${String(number)} of ${String(total)}`;
    notesHeading.textContent = `Notes · Slide ${String(number)} of ${String(total)}`;
    notesNext.textContent = upcomingLabel(deck, place);
    const words = deck.slides[place.slide]?.notes ?? '';
    notesText.textContent = words.trim() === '' ? 'No notes for this slide.' : words;
    notesText.dataset.empty = String(words.trim() === '');
    try {
      history.replaceState(null, '', `#${String(number)}`);
    } catch {
      // A browser that does not let a page change its own address: the page still works.
    }
  }

  /** The pictures of the next slide are made now, so that it does not wait for them when it comes. */
  function preloadNext(): void {
    const next = deck.slides[place.slide + 1];
    if (!next) return;
    setTimeout(() => {
      for (const hash of imageHashes({ ...deck, slides: [next] }))
        images.load(hash, () => undefined);
    }, 0);
  }

  function go(next: ShowPlace): void {
    const target = clampPlace(deck, next);
    if (
      target.slide === place.slide &&
      target.click === place.click &&
      target.blank === place.blank
    ) {
      return;
    }
    place = target;
    draw();
  }

  function toggleNotes(): void {
    if (!data.notes) return;
    const open = notes.hidden;
    notes.hidden = !open;
    root.dataset.notes = open ? 'open' : 'closed';
    notesButton.setAttribute('aria-pressed', String(open));
  }

  function toggleFullscreen(): void {
    if (!document.fullscreenEnabled) return;
    const done = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
    done.catch(() => undefined);
  }

  // The bar shows when something moves, and goes after a few seconds (a focused button keeps it) ----
  function showBar(): void {
    root.dataset.bar = 'shown';
    clearTimeout(hideBar);
    hideBar = setTimeout(() => {
      root.dataset.bar = 'hidden';
    }, BAR_MS);
  }

  // Keys -----------------------------------------------------------------------------------------
  const clearTyped = () => {
    typed = '';
    clearTimeout(forgetTyped);
  };

  const showActions: Record<ShowAction, (event: KeyboardEvent) => void> = {
    next(event) {
      if (event.key === 'Enter' && typed !== '') {
        go(jumpTo(deck, Number.parseInt(typed, 10) - 1));
        clearTyped();
      } else go(forward(deck, place));
    },
    previous: () => {
      go(back(deck, place));
    },
    first: () => {
      go(toStart(deck));
    },
    last: () => {
      go(toEnd(deck));
    },
    digit(event) {
      typed = typeDigit(typed, event.key);
      clearTimeout(forgetTyped);
      forgetTyped = setTimeout(clearTyped, NUMBER_WAIT_MS);
    },
    blackout: () => {
      go(toggleBlank(place, 'black'));
    },
    whiteout: () => {
      go(toggleBlank(place, 'white'));
    },
    fullscreen: toggleFullscreen,
    // The page has no show to end: Esc closes the notes, and leaves full screen by itself.
    end: () => {
      if (!notes.hidden) toggleNotes();
    },
  };

  const pageActions: Record<PageAction, () => void> = {
    notes: toggleNotes,
    help: () => {
      help.showModal();
    },
  };

  function onKeyDown(event: KeyboardEvent): void {
    showBar();
    if (help.open) return;
    // The notes scroll with the arrow keys when they have focus; a button takes Space and Enter itself.
    const target = event.target;
    if (target instanceof Element && target.closest('.cp-notes-scroll')) return;
    if (target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
    const pageAction = pageActionFor(event);
    if (pageAction) {
      pageActions[pageAction]();
      event.preventDefault();
      return;
    }
    const action = showActionFor(event);
    if (!action) return;
    showActions[action](event);
    event.preventDefault();
  }

  // Pointer: a tap on the right moves on, on the left goes back, and a swipe does the same ---------
  let down: { readonly x: number; readonly y: number } | undefined;
  const onPointerDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!down) return;
    const across = event.clientX - down.x;
    const along = event.clientY - down.y;
    down = undefined;
    if (Math.abs(across) >= SWIPE_PX && Math.abs(across) > Math.abs(along) * 1.5) {
      go(across < 0 ? forward(deck, place) : back(deck, place));
    } else if (Math.abs(across) <= TAP_PX && Math.abs(along) <= TAP_PX) {
      const box = area.getBoundingClientRect();
      go(event.clientX - box.left < box.width / 3 ? back(deck, place) : forward(deck, place));
    }
  };
  const onPointerCancel = () => {
    down = undefined;
  };

  window.addEventListener('keydown', onKeyDown);
  root.addEventListener('pointermove', showBar);
  root.addEventListener('focusin', showBar);
  area.addEventListener('pointerdown', onPointerDown);
  area.addEventListener('pointerup', onPointerUp);
  area.addEventListener('pointercancel', onPointerCancel);

  describePlace();
  showBar();
  preloadNext();

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    clearTimeout(hideBar);
    clearTyped();
    stage?.destroy();
    images.release();
    setImageSource(undefined);
    root.replaceChildren();
  };
}
