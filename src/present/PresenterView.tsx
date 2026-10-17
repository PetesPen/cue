import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { clickCount, playsFor, upcoming, type Slide, type Step } from '@/model';
import { ArrowLeftIcon, ArrowRightIcon, Logo, PauseIcon, PlayIcon, ResetIcon } from './icons';
import {
  NOTES_PX,
  TOP_VH,
  clampNotesPx,
  clampTopVh,
  readLayout,
  writeLayout,
  type PresenterLayout,
} from './layoutStore';
import { ShowStage } from './ShowStage';
import { SlidePreview } from './SlidePreview';
import type { Show } from './show';
import { useShowKeys } from './useShowKeys';
import { useShowPlace } from './useShow';
import './present.css';

const EFFECT_NAMES: Readonly<Record<Step['effect'], string>> = {
  appear: 'Appears',
  disappear: 'Disappears',
  move: 'Moves',
};

/** What a click does, in a few words for the badge by the next-slide preview: "Appears · Moves". */
export function clickSummary(steps: readonly Step[]): string {
  const names: string[] = [];
  for (const step of steps) {
    const name = EFFECT_NAMES[step.effect];
    if (!names.includes(name)) names.push(name);
  }
  return names.join(' · ');
}

/** Minutes and seconds, or hours too from the hour: 12:48, 1:02:05. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = String(total % 60).padStart(2, '0');
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes).padStart(2, '0')}:${seconds}`;
}

const CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** The elapsed timer (PM-7 asks for pause and reset): it starts with the first move of the show. */
function useStopwatch() {
  const [state, setState] = useState({ running: false, base: 0, since: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(tick);
    };
  }, []);

  const elapsed = state.base + (state.running ? Math.max(0, now - state.since) : 0);
  return {
    elapsed,
    running: state.running,
    now,
    start: () => {
      const at = Date.now();
      setNow(at);
      setState((was) => (was.running ? was : { running: true, base: was.base, since: at }));
    },
    pause: () => {
      const at = Date.now();
      setNow(at);
      setState((was) =>
        was.running ? { running: false, base: was.base + (at - was.since), since: 0 } : was,
      );
    },
    reset: () => {
      setNow(Date.now());
      setState({ running: false, base: 0, since: 0 });
    },
  };
}

/**
 * The presenter's private view (PM-2; design: Presenter): the slide on screen now, what the next press
 * brings, the notes, a navigator of every slide, the elapsed time and the time of day. It is the editor
 * tab during a show, and it draws what the audience sees with the same stage, so a transition plays
 * here too.
 */
export function PresenterView({
  show,
  blocked = false,
  onReconnect,
}: {
  readonly show: Show;
  /** The browser refused the last try at reopening the audience window. */
  readonly blocked?: boolean;
  /** Ask for the audience window again; called from the Reconnect click. */
  readonly onReconnect?: () => void;
}) {
  const { deck } = show;
  const place = useShowPlace(show);
  const audience = useSyncExternalStore(show.subscribe, show.getAudience);
  // The size of the slides against the notes, and of the notes' text: kept between shows (PM-4).
  const [layout, setLayout] = useState<PresenterLayout>(readLayout);
  const changeLayout = (change: Partial<PresenterLayout>) => {
    const next = { ...layout, ...change };
    setLayout(next);
    writeLayout(next);
  };
  const top = useRef<HTMLElement>(null);
  const slide = deck.slides[place.slide];
  const clock = useStopwatch();
  const { start: startTimer } = clock;
  useShowKeys(show);

  // The timer starts with the first move, made in either window.
  useEffect(() => show.subscribe(startTimer), [show, startTimer]);

  const clicks = slide ? clickCount(slide) : 0;
  const next = upcoming(deck, place);
  const nextSlide = next.kind === 'end' ? undefined : deck.slides[next.slide];
  const afterThat = deck.slides[place.slide + 1];
  const total = deck.slides.length;
  const blank = place.blank !== 'none';

  const nextLabel =
    next.kind === 'click'
      ? `Next · Click ${String(next.click)} of ${String(clicks)}`
      : next.kind === 'slide'
        ? `Next · Slide ${String(next.slide + 1)}`
        : 'Next';

  return (
    <div className="presenter">
      <header className="pv-bar">
        <div className="pv-bar-left">
          <Logo />
          <h1 className="pv-title">{deck.title}</h1>
          <span className="pv-pill">Presenting</span>
        </div>
        <div className="pv-timer" role="group" aria-label="Timer">
          <span className="pv-label">Elapsed</span>
          <span className="pv-time" aria-label={`Elapsed ${formatElapsed(clock.elapsed)}`}>
            {formatElapsed(clock.elapsed)}
          </span>
          <button
            type="button"
            className="pv-icon-button"
            aria-label={clock.running ? 'Pause timer' : 'Start timer'}
            onClick={clock.running ? clock.pause : clock.start}
          >
            {clock.running ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="pv-icon-button"
            aria-label="Reset timer"
            onClick={clock.reset}
          >
            <ResetIcon />
          </button>
          <span className="pv-clock" aria-label="Time of day">
            {CLOCK.format(clock.now)}
          </span>
        </div>
        <div className="pv-bar-right">
          <div className="pv-progress">
            <span className="pv-where">{`Slide ${String(place.slide + 1)} of ${String(total)}`}</span>
            <span className="pv-progress-bar" aria-hidden="true">
              <span
                style={{ width: `${String(((place.slide + 1) / Math.max(total, 1)) * 100)}%` }}
              />
            </span>
          </div>
          <button type="button" className="pv-button pv-button-danger" onClick={show.end}>
            End show
          </button>
        </div>
      </header>

      <div className="pv-banner-area">
        {audience === 'gone' && onReconnect && (
          <div className="pv-banner" role="status">
            <p>
              {blocked
                ? 'Your browser blocked the audience window. Allow pop-ups for this site, then try again.'
                : 'The audience window was closed. The show goes on here.'}
            </p>
            <button type="button" className="pv-button pv-button-small" onClick={onReconnect}>
              {blocked ? 'Try again' : 'Reconnect'}
            </button>
          </div>
        )}
      </div>

      <main className="pv-main">
        <section
          ref={top}
          className="pv-top"
          aria-label="On screen and next"
          style={{ height: `${String(layout.topVh)}vh` }}
        >
          <div className="pv-now">
            <div className="pv-heading">
              <h2 className="pv-label">On screen now</h2>
              <span className="pv-caption" aria-live="polite">
                {clicks > 0 ? `Click ${String(place.click)} of ${String(clicks)}` : 'No clicks'}
              </span>
            </div>
            <div className="pv-now-frame" data-blank={place.blank}>
              <ShowStage deck={deck} place={place} />
              {blank && (
                <p className="pv-blank-note">
                  {place.blank === 'black' ? 'Black screen' : 'White screen'}: press{' '}
                  {place.blank === 'black' ? 'B' : 'W'} to bring the slide back
                </p>
              )}
            </div>
          </div>

          <div className="pv-next">
            <div className="pv-heading">
              <h2 className="pv-label">{nextLabel}</h2>
              {next.kind === 'click' && slide && (
                <span className="pv-badge">{clickSummary(playsFor(slide, next.click))}</span>
              )}
            </div>
            <div className="pv-next-frame">
              {nextSlide && next.kind !== 'end' ? (
                <SlidePreview slide={nextSlide} click={next.kind === 'click' ? next.click : 0} />
              ) : (
                <p className="pv-end-card">End of presentation</p>
              )}
            </div>
            <div className="pv-moves">
              <button
                type="button"
                className="pv-button"
                disabled={place.slide === 0 && place.click === 0 && !blank}
                onClick={show.back}
              >
                <ArrowLeftIcon />
                Back
              </button>
              {next.kind === 'end' && !blank ? (
                <button type="button" className="pv-button pv-button-primary" onClick={show.end}>
                  End show
                </button>
              ) : (
                <button
                  type="button"
                  className="pv-button pv-button-primary"
                  onClick={show.forward}
                >
                  {blank ? 'Show slide' : next.kind === 'click' ? 'Next click' : 'Next slide'}
                  <ArrowRightIcon />
                </button>
              )}
            </div>
            <div className="pv-dots-row">
              <span className="pv-dots" aria-hidden="true">
                {Array.from({ length: clicks + 1 }, (_, i) => (
                  <span key={i} data-done={i <= place.click} />
                ))}
              </span>
              <span className="pv-caption">
                {afterThat ? `then slide ${String(place.slide + 2)}` : 'last slide'}
              </span>
              <button
                type="button"
                className="pv-button pv-button-small"
                aria-pressed={place.blank === 'black'}
                onClick={() => {
                  show.blank('black');
                }}
              >
                Blank screen
              </button>
            </div>
          </div>
        </section>

        <Divider
          topVh={layout.topVh}
          top={top}
          onChange={(topVh) => {
            changeLayout({ topVh });
          }}
        />
        <Notes
          slide={slide}
          number={place.slide + 1}
          px={layout.notesPx}
          onSize={(notesPx) => {
            changeLayout({ notesPx });
          }}
        />
        <Navigator show={show} current={place.slide} />
      </main>
    </div>
  );
}

/**
 * The divider between the slides and the notes (PM-4; design: Presenter): dragged with the mouse, or moved
 * with the arrow keys when it has focus (a window splitter). Up gives the notes more room.
 */
function Divider({
  topVh,
  top,
  onChange,
}: {
  readonly topVh: number;
  readonly top: React.RefObject<HTMLElement | null>;
  readonly onChange: (topVh: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const by = event.shiftKey ? TOP_VH.big : TOP_VH.step;
    let next: number | undefined;
    if (event.key === 'ArrowUp') next = topVh - by;
    else if (event.key === 'ArrowDown') next = topVh + by;
    else if (event.key === 'Home') next = TOP_VH.min;
    else if (event.key === 'End') next = TOP_VH.max;
    if (next === undefined) return;
    event.preventDefault();
    onChange(clampTopVh(next));
  }

  return (
    // A separator that can be focused and moved is a window splitter (WAI-ARIA): an interactive widget.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="pv-divider"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize notes"
      aria-valuemin={TOP_VH.min}
      aria-valuemax={TOP_VH.max}
      aria-valuenow={topVh}
      aria-valuetext={`The slides take ${String(topVh)}% of the window`}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      data-dragging={dragging}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        const at = top.current?.getBoundingClientRect().top ?? 0;
        onChange(clampTopVh(((event.clientY - at) / window.innerHeight) * 100));
      }}
      onPointerUp={() => {
        setDragging(false);
      }}
      onPointerCancel={() => {
        setDragging(false);
      }}
    >
      <span className="pv-divider-pill">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
        Drag to resize notes
      </span>
    </div>
  );
}

function Notes({
  slide,
  number,
  px,
  onSize,
}: {
  readonly slide: Slide | undefined;
  readonly number: number;
  readonly px: number;
  readonly onSize: (px: number) => void;
}) {
  const notes = slide?.notes ?? '';
  return (
    <section className="pv-notes" aria-label="Speaker notes">
      <div className="pv-heading">
        <h2 className="pv-label">{`Notes · Slide ${String(number)}`}</h2>
        <div className="pv-size" role="group" aria-label="Notes text size">
          <button
            type="button"
            className="pv-button pv-button-small"
            aria-label="Smaller text"
            disabled={px <= NOTES_PX.min}
            onClick={() => {
              onSize(clampNotesPx(px - NOTES_PX.step));
            }}
          >
            A−
          </button>
          <span className="pv-caption" aria-live="polite">{`${String(px)} px`}</span>
          <button
            type="button"
            className="pv-button pv-button-small"
            aria-label="Larger text"
            disabled={px >= NOTES_PX.max}
            onClick={() => {
              onSize(clampNotesPx(px + NOTES_PX.step));
            }}
          >
            A+
          </button>
        </div>
      </div>
      {/* Notes that overflow must be scrollable from the keyboard: the region takes focus (WCAG 2.1.1). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="pv-notes-scroll" role="region" tabIndex={0} aria-label="Notes text">
        {notes.trim() === '' ? (
          <p className="pv-notes-empty" style={{ fontSize: `${String(px)}px` }}>
            No notes for this slide.
          </p>
        ) : (
          <p className="pv-notes-text" style={{ fontSize: `${String(px)}px` }}>
            {notes}
          </p>
        )}
      </div>
    </section>
  );
}

/** Every slide in a strip, the current one marked, and a box to jump to a number (PM-6). */
function Navigator({ show, current }: { readonly show: Show; readonly current: number }) {
  const [typed, setTyped] = useState('');
  const list = useRef<HTMLOListElement>(null);

  // Keep the current slide in view as the show moves.
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  return (
    <section className="pv-strip" aria-label="All slides">
      <div className="pv-heading">
        <h2 className="pv-label">All slides</h2>
        <form
          className="pv-jump"
          onSubmit={(event) => {
            event.preventDefault();
            const number = Number.parseInt(typed, 10);
            if (Number.isFinite(number)) show.jump(number - 1);
            setTyped('');
          }}
        >
          <label className="pv-caption" htmlFor="pv-jump-input">
            Jump to
          </label>
          <input
            id="pv-jump-input"
            className="pv-jump-input"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value.replace(/\D/g, '').slice(0, 4));
            }}
          />
          <span className="pv-caption" aria-hidden="true">
            Enter
          </span>
        </form>
      </div>
      <ol ref={list} className="pv-strip-list">
        {show.deck.slides.map((slide, index) => (
          <li key={slide.id}>
            <button
              type="button"
              className="pv-thumb"
              aria-label={`Slide ${String(index + 1)}`}
              aria-current={index === current}
              onClick={() => {
                show.jump(index);
              }}
            >
              <SlidePreview slide={slide} lazy root=".pv-strip-list" />
              <span className="pv-thumb-number">{index + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
