import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import type { Slide } from '@/model';
import { PLAIN, createSlideRenderer, type Look, type SlideRenderer } from '@/render';

/** What the editor can ask of a drawn slide: play a click, or stop (AN-6). */
export interface SlideViewHandle {
  readonly play: (slide: Slide, from: number, to: number) => Promise<void>;
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
  const renderer = useRef<SlideRenderer | undefined>(undefined);
  const first = useRef(slide);
  const firstLook = useRef(look);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const created = createSlideRenderer(element, first.current);
    renderer.current = created;
    created.update(first.current, undefined, firstLook.current);
    return () => {
      created.destroy();
      renderer.current = undefined;
    };
  }, []);

  useImperativeHandle(
    handle,
    () => ({
      play: (next, from, to) => renderer.current?.play(next, from, to) ?? Promise.resolve(),
      settle: () => {
        renderer.current?.settle();
      },
    }),
    [],
  );

  const click = look.mode === 'click' ? look.click : 0;
  useLayoutEffect(() => {
    renderer.current?.update(slide, undefined, look);
    // `look` is a new object on each render for a click; its mode and click are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, look.mode, click]);

  return <div ref={host} className="slide-view" />;
}
