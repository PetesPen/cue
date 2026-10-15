import { SLIDE_HEIGHT, SLIDE_WIDTH, type Id, type Slide, type SlideElement } from '@/model';
import { drawShape } from './shapes';
import './slide.css';

/** A slide drawn into a host element. Call `update` with a changed slide; `destroy` removes it. */
export interface SlideRenderer {
  readonly update: (slide: Slide) => void;
  readonly destroy: () => void;
}

interface Drawn {
  readonly element: SlideElement;
  readonly node: HTMLElement;
}

/** Place and style an element's box. Opacity is on the whole box: fill, border and later text fade together. */
function styleBox(node: HTMLElement, element: SlideElement): void {
  node.style.left = `${String(element.x)}px`;
  node.style.top = `${String(element.y)}px`;
  node.style.width = `${String(element.width)}px`;
  node.style.height = `${String(element.height)}px`;
  node.style.transform = element.rotation === 0 ? '' : `rotate(${String(element.rotation)}deg)`;
  node.style.opacity = element.opacity === 1 ? '' : String(element.opacity);
  node.dataset.shape = element.shape;
}

function createNode(element: SlideElement): HTMLElement {
  const node = document.createElement('div');
  node.className = 'cue-element';
  node.dataset.elementId = element.id;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cue-shape');
  svg.setAttribute('aria-hidden', 'true');
  node.append(svg);
  return node;
}

function paint(node: HTMLElement, element: SlideElement): void {
  styleBox(node, element);
  const svg = node.querySelector('svg');
  if (svg) drawShape(svg, element);
}

/**
 * Draw `slide` into `host`, filling the host's width at 16:9. The slide is laid out at its fixed size
 * and scaled with a transform, following the host as it resizes. `update` changes only the elements
 * whose data changed (a changed element is a new object; an unchanged one is the same object), so
 * dragging one element out of fifty touches one node.
 */
export function createSlideRenderer(host: HTMLElement, slide: Slide): SlideRenderer {
  const viewport = document.createElement('div');
  viewport.className = 'cue-slide-viewport';
  const surface = document.createElement('div');
  surface.className = 'cue-slide';
  surface.style.width = `${String(SLIDE_WIDTH)}px`;
  surface.style.height = `${String(SLIDE_HEIGHT)}px`;
  viewport.append(surface);
  host.append(viewport);

  const fit = () => {
    surface.style.transform = `scale(${String(viewport.clientWidth / SLIDE_WIDTH)})`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(viewport);
  fit();

  const drawn = new Map<Id, Drawn>();

  const update = (next: Slide) => {
    surface.dataset.slideId = next.id;
    surface.style.background = next.background;

    const keep = new Set(next.elements.map((element) => element.id));
    for (const [id, entry] of drawn) {
      if (!keep.has(id)) {
        entry.node.remove();
        drawn.delete(id);
      }
    }

    let previous: Node | null = null;
    for (const element of next.elements) {
      let entry = drawn.get(element.id);
      if (!entry) {
        const node = createNode(element);
        paint(node, element);
        entry = { element, node };
        drawn.set(element.id, entry);
      } else if (entry.element !== element) {
        paint(entry.node, element);
        entry = { element, node: entry.node };
        drawn.set(element.id, entry);
      }
      // Back to front is document order: put each node right after the one before it.
      const wanted: ChildNode | null = previous ? previous.nextSibling : surface.firstChild;
      if (wanted !== entry.node) surface.insertBefore(entry.node, wanted);
      previous = entry.node;
    }
  };
  update(slide);

  return {
    update,
    destroy() {
      observer.disconnect();
      viewport.remove();
      drawn.clear();
    },
  };
}

/** Draw a slide once; returns a function that removes it. For thumbnails that are redrawn from scratch. */
export function mountSlide(host: HTMLElement, slide: Slide): () => void {
  return createSlideRenderer(host, slide).destroy;
}
