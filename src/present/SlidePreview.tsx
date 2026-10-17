import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Slide } from '@/model';
import { createSlideRenderer, type SlideRenderer } from '@/render';

/**
 * A still of a slide in the state after `click` clicks, as wide as its container: the next-slide preview
 * and the navigator's thumbnails. With `lazy`, nothing is drawn until it is near the visible part of
 * `root` (a deck of 50 slides has 50 of them); the blank in the meantime has the slide's own colour.
 */
export function SlidePreview({
  slide,
  click = 0,
  lazy = false,
  root,
}: {
  readonly slide: Slide;
  readonly click?: number;
  readonly lazy?: boolean;
  /** The scrolling list the thumbnail is in, for `lazy`. */
  readonly root?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!lazy);

  useEffect(() => {
    const element = holder.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root: root ? element.closest(root) : null, rootMargin: '0px 400px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [near, root]);

  return (
    <div ref={holder} className="pv-preview" data-drawn={near}>
      {near ? (
        <Drawn slide={slide} click={click} />
      ) : (
        <div className="pv-preview-blank" style={{ background: slide.background }} />
      )}
    </div>
  );
}

function Drawn({ slide, click }: { readonly slide: Slide; readonly click: number }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<SlideRenderer | undefined>(undefined);
  const first = useRef({ slide, click });

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const created = createSlideRenderer(element, first.current.slide);
    created.update(first.current.slide, undefined, { mode: 'click', click: first.current.click });
    renderer.current = created;
    return () => {
      created.destroy();
      renderer.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    renderer.current?.update(slide, undefined, { mode: 'click', click });
  }, [slide, click]);

  return <div ref={host} className="pv-preview-slide" />;
}
