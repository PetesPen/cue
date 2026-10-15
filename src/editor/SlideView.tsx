import { useLayoutEffect, useRef } from 'react';
import type { Slide } from '@/model';
import { createSlideRenderer, type SlideRenderer } from '@/render';

/**
 * A slide drawn by the shared renderer, as wide as its container (canvas, thumbnails, cards). When
 * the slide changes, the renderer updates only the elements that changed.
 */
export function SlideView({ slide }: { readonly slide: Slide }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<SlideRenderer | undefined>(undefined);
  const first = useRef(slide);

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const created = createSlideRenderer(element, first.current);
    renderer.current = created;
    return () => {
      created.destroy();
      renderer.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    renderer.current?.update(slide);
  }, [slide]);

  return <div ref={host} className="slide-view" />;
}
