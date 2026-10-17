import { useRef, useState, type RefObject } from 'react';
import type { Slide } from '@/model';
import type { SlideViewHandle } from '../SlideView';

export interface TransitionPreview {
  readonly playing: boolean;
  /** Play the slide before into `slide`, in place. */
  readonly start: (previous: Slide, slide: Slide) => void;
  /** End it now: the slide is on the canvas, as it is when it has finished. */
  readonly stop: () => void;
}

/**
 * Preview transition (TN-4): its state lives here, outside the deck, like Preview's, so it can never
 * make history or a save. The canvas plays it; stopping it (a click, Esc, another slide or tab) lands
 * it at once.
 */
export function useTransitionPreview(view: RefObject<SlideViewHandle | null>): TransitionPreview {
  const [playing, setPlaying] = useState(false);
  const run = useRef(0);

  const start = (previous: Slide, slide: Slide) => {
    const handle = view.current;
    if (!handle) return;
    run.current += 1;
    const mine = run.current;
    setPlaying(true);
    void handle.transition(previous, slide, slide.transition).then(() => {
      if (run.current === mine) setPlaying(false);
    });
  };

  const stop = () => {
    view.current?.settle();
  };

  return { playing, start, stop };
}
