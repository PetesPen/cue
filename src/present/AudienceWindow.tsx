import { useEffect, useState } from 'react';
import { ShowStage } from './ShowStage';
import type { Show } from './show';
import { useShowKeys } from './useShowKeys';
import { useShowPlace } from './useShow';
import './present.css';

/** How long the hint stays before it fades (design: Audience, "fades after 3 seconds"). */
const HINT_MS = 3000;

const fullscreenOn = () => document.fullscreenElement !== null;

/** Fullscreen is asked for from a click or a key in this window; a browser that refuses is not an error. */
function toggleFullscreen(): void {
  const done = fullscreenOn()
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
  done.catch(() => undefined);
}

/**
 * What the audience sees (PM-1, PM-2; design: Audience): the slide scaled to fit with black bars, never
 * cropped, and nothing else: no controls and no cursor. The one hint, for the keys, fades after three
 * seconds. A click asks for full screen, and once there, steps forward like a clicker. Used for the
 * audience window and, with `single`, for a show in one window.
 */
export function AudienceWindow({ show }: { readonly show: Show }) {
  const place = useShowPlace(show);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const [fullscreen, setFullscreen] = useState(fullscreenOn);

  useEffect(() => {
    const fade = setTimeout(() => {
      setFading(true);
    }, HINT_MS);
    const remove = setTimeout(() => {
      setGone(true);
    }, HINT_MS + 400);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, []);

  useEffect(() => {
    const onChange = () => {
      setFullscreen(fullscreenOn());
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  useShowKeys(show, toggleFullscreen);

  return (
    // The whole window is the control: a key or a click, and nothing to focus.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="audience"
      onClick={() => {
        if (fullscreen) show.forward();
        else toggleFullscreen();
      }}
    >
      <main className="audience-frame" aria-label={`Slide ${String(place.slide + 1)}`}>
        <ShowStage deck={show.deck} place={place} />
        {!gone && (
          <p className="audience-hint" data-fading={fading}>
            <kbd>Esc</kbd> to end the show
            <span aria-hidden="true">{' · '}</span>
            <kbd>F</kbd> for full screen
          </p>
        )}
      </main>
      {place.blank !== 'none' && <div className="audience-blank" data-colour={place.blank} />}
    </div>
  );
}
