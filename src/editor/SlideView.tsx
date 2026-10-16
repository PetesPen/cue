import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import { clickCount, type Slide, type Transition } from '@/model';
import { PLAIN, createSlideStage, type Look, type SlideStage } from '@/render';

/** What the editor can ask of a drawn slide: play a click, play a transition, or stop (AN-6, TN-4). */
export interface SlideViewHandle {
  readonly play: (slide: Slide, from: number, to: number) => Promise<void>;
  /**
   * Play how `next` arrives after `previous` (TN-4): the previous slide as the show would leave it, then
   * the transition into the next one as the show would open it. Resolves when it has finished or been
   * settled, and the slide goes back to how the editor draws it.
   */
  readonly transition: (previous: Slide, next: Slide, transition: Transition) => Promise<void>;
  readonly settle: () => void;
}

interface SlideViewProps {
  readonly slide: Slide;
  /** How animations show: plainly (thumbnails and cards), faded (the editor), or at a click (Preview). */
  readonly look?: Look;
  readonly handle?: Ref<SlideViewHandle>;
}

/**
 * A slide drawn by the shared renderer, as wide as its container (canvas, thumbnails, cards). When
 * the slide changes, the renderer updates only the elements that changed.
 */
export function SlideView({ slide, look = PLAIN, handle }: SlideViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<SlideStage | undefined>(undefined);
  const first = useRef(slide);
  const firstLook = useRef(look);
  /** What the editor wants drawn, for when a transition Preview ends. */
  const latest = useRef({ slide, look });
  useLayoutEffect(() => {
    latest.current = { slide, look };
  });

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const created = createSlideStage(element, first.current, firstLook.current);
    stage.current = created;
    return () => {
      created.destroy();
      stage.current = undefined;
    };
  }, []);

  useImperativeHandle(
    handle,
    () => ({
      play: (next, from, to) => stage.current?.play(next, from, to) ?? Promise.resolve(),
      transition: async (previous, next, change) => {
        const shown = stage.current;
        if (!shown) return;
        shown.show(previous, { mode: 'click', click: clickCount(previous) });
        await shown.transition(next, { mode: 'click', click: 0 }, change, false);
        if (stage.current === shown) shown.show(latest.current.slide, latest.current.look);
      },
      settle: () => {
        stage.current?.settle();
      },
    }),
    [],
  );

  const click = look.mode === 'click' ? look.click : 0;
  useLayoutEffect(() => {
    stage.current?.show(slide, look);
    // `look` is a new object on each render for a click; its mode and click are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, look.mode, click]);

  return <div ref={host} className="slide-view" />;
}
