import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from '@/model';
import './slide.css';

/**
 * Draw `slide` into `host`, filling the host's width at 16:9. The slide is laid out at its fixed size
 * and scaled with a transform, following the host as it resizes. Returns a function that removes it.
 */
export function mountSlide(host: HTMLElement, slide: Slide): () => void {
  const viewport = document.createElement('div');
  viewport.className = 'cue-slide-viewport';
  const surface = document.createElement('div');
  surface.className = 'cue-slide';
  surface.style.width = `${String(SLIDE_WIDTH)}px`;
  surface.style.height = `${String(SLIDE_HEIGHT)}px`;
  surface.style.background = slide.background;
  surface.dataset.slideId = slide.id;
  viewport.append(surface);
  host.append(viewport);

  const fit = () => {
    surface.style.transform = `scale(${String(viewport.clientWidth / SLIDE_WIDTH)})`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(viewport);
  fit();

  return () => {
    observer.disconnect();
    viewport.remove();
  };
}
