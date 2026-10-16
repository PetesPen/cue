import { useEffect, useRef, useState, type RefObject } from 'react';
import { clickCount, type Slide } from '@/model';
import type { SlideViewHandle } from '../SlideView';

/** Where a Preview is: `undefined` when none runs, else how many clicks have played. */
export interface Preview {
  readonly click: number | undefined;
  readonly total: number;
  readonly start: () => void;
  readonly stop: () => void;
  /** Play the next click (or start again after the last). */
  readonly forward: () => void;
  readonly back: () => void;
}

/**
 * Preview (AN-6): play a slide's clicks in the editor, one at a time. Its state lives here, outside
 * the deck, so it can never make history, a save or a draft; ending it (or changing slide, or an
 * edit changing the slide) stops every animation and the slide goes back to its editing look.
 */
export function usePreview(slide: Slide, view: RefObject<SlideViewHandle | null>): Preview {
  const [click, setClick] = useState<number | undefined>();
  const latest = useRef({ slide, click });
  useEffect(() => {
    latest.current = { slide, click };
  });

  const stop = () => {
    view.current?.settle();
    setClick(undefined);
  };

  // A different slide, or the same slide changed by an edit or an undo, ends the Preview.
  const shown = useRef(slide);
  useEffect(() => {
    if (shown.current === slide) return;
    shown.current = slide;
    if (latest.current.click === undefined) return;
    view.current?.settle();
    setClick(undefined);
  }, [slide, view]);

  const forward = () => {
    const { slide: now, click: at } = latest.current;
    if (at === undefined) return;
    if (at >= clickCount(now)) {
      // After the last click, "play again" starts from the beginning.
      view.current?.settle();
      setClick(0);
      latest.current = { slide: now, click: 0 };
      return;
    }
    void view.current?.play(now, at, at + 1);
    setClick(at + 1);
    latest.current = { slide: now, click: at + 1 };
  };

  const back = () => {
    const { slide: now, click: at } = latest.current;
    if (at === undefined || at === 0) return;
    // Stepping back is exact and immediate: the slide as it was after the click before.
    view.current?.settle();
    setClick(at - 1);
    latest.current = { slide: now, click: at - 1 };
  };

  const start = () => {
    setClick(0);
    latest.current = { slide: latest.current.slide, click: 0 };
  };

  return { click, total: clickCount(slide), start, stop, forward, back };
}
