import { useLayoutEffect, useRef } from 'react';
import type { Slide } from '@/model';
import { mountSlide } from '@/render';

/** A slide drawn by the shared renderer, as wide as its container (canvas, thumbnails, cards). */
export function SlideView({ slide }: { readonly slide: Slide }) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = host.current;
    return element ? mountSlide(element, slide) : undefined;
  }, [slide]);

  return <div ref={host} className="slide-view" />;
}
