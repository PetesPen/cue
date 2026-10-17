import { useLayoutEffect, useRef } from 'react';
import { movement, type Deck, type ShowPlace } from '@/model';
import { createSlideStage, type Look, type SlideStage } from '@/render';

/** A slide as the show draws it: the state after `click` clicks. */
const lookAt = (place: ShowPlace): Look => ({ mode: 'click', click: place.click });

/**
 * The slide of a show on a stage, kept at `place` (TN-5, AN-7): a step forward plays that click, a move
 * to the next slide plays its transition (back, reversed), and anything else is shown at once. What
 * counts is where the stage was and where it is going, so a quick run of key presses lands exactly
 * wherever they end, whatever was in flight.
 */
export function ShowStage({ deck, place }: { readonly deck: Deck; readonly place: ShowPlace }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<SlideStage | undefined>(undefined);
  const drawn = useRef<ShowPlace>(place);
  const first = useRef(place);

  useLayoutEffect(() => {
    const element = host.current;
    const start = deck.slides[first.current.slide];
    if (!element || !start) return;
    const created = createSlideStage(element, start, lookAt(first.current));
    stage.current = created;
    drawn.current = first.current;
    return () => {
      created.destroy();
      stage.current = undefined;
    };
  }, [deck]);

  useLayoutEffect(() => {
    const shown = stage.current;
    const slide = deck.slides[place.slide];
    if (!shown || !slide) return;
    const move = movement(deck, drawn.current, place);
    drawn.current = place;
    if (move.kind === 'still') return;
    if (move.kind === 'click') void shown.play(slide, move.click - 1, move.click);
    else if (move.kind === 'transition') {
      void shown.transition(slide, lookAt(place), move.transition, move.reversed);
    } else shown.show(slide, lookAt(place));
  }, [deck, place]);

  return <div ref={host} className="show-stage" />;
}
