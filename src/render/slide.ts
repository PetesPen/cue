import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  isImage,
  isShape,
  type Id,
  type ImageElement,
  type RichText,
  type ShapeElement,
  type Slide,
  type SlideElement,
  type TextElement,
} from '@/model';
import { imageSource } from './images';
import { PLAIN, drawnOpacity, drawnTransform, lookSets, playClick, type Look } from './motion';
import { drawShape } from './shapes';
import { createTextBody, ensureFonts, renderText } from './text';
import './slide.css';

/** A slide drawn into a host element. Call `update` with a changed slide; `destroy` removes it. */
export interface SlideRenderer {
  /**
   * `hidden` elements keep their place but are not shown (the one being edited, drawn by the editor).
   * `look` is how animations show: plainly, faded for the editor, or the state at a click (AN-1).
   */
  readonly update: (slide: Slide, hidden?: ReadonlySet<Id>, look?: Look) => void;
  /**
   * Show click `to` after click `from`, animated when it is the next one (AN-1, AN-2). The slide is
   * drawn in the state after `to` at once; the animations only show the way there. Resolves when done.
   */
  readonly play: (slide: Slide, from: number, to: number) => Promise<void>;
  /** Stop any animation now: every element is left where the last look put it. */
  readonly settle: () => void;
  readonly destroy: () => void;
}

interface Drawn {
  readonly element: SlideElement;
  readonly node: HTMLElement;
}

const NOBODY: ReadonlySet<Id> = new Set();

/** Place and style an element's box. (Opacity is set with the look, on the whole box: fill, border and text fade together.) */
function styleBox(node: HTMLElement, element: SlideElement): void {
  node.style.left = `${String(element.x)}px`;
  node.style.top = `${String(element.y)}px`;
  node.style.width = `${String(element.width)}px`;
  node.style.height = `${String(element.height)}px`;
  node.dataset.kind = element.kind;
  if (isShape(element)) node.dataset.shape = element.shape;
}

function createNode(element: SlideElement): HTMLElement {
  const node = document.createElement('div');
  node.className = 'cue-element';
  node.dataset.elementId = element.id;
  if (isShape(element)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'cue-shape');
    svg.setAttribute('aria-hidden', 'true');
    node.append(svg);
  }
  return node;
}

let paintCounter = 0;

/**
 * Show `doc` in `holder` (a `.cue-text`). Text stays hidden until the fonts it uses have loaded, so a
 * slide never flashes a fallback font; `node` remembers which paint it is waiting for.
 */
function showText(node: HTMLElement, body: HTMLElement, doc: RichText): void {
  renderText(body, doc);
  paintCounter += 1;
  const token = String(paintCounter);
  node.dataset.paint = token;
  node.dataset.fonts = 'loading';
  void ensureFonts(doc).then(() => {
    if (node.dataset.paint === token) delete node.dataset.fonts;
  });
}

function paintShape(node: HTMLElement, element: ShapeElement): void {
  const svg = node.querySelector('svg');
  if (svg) drawShape(svg, element);
  let holder = node.querySelector<HTMLElement>(':scope > .cue-shape-text');
  if (!element.text) {
    holder?.remove();
    return;
  }
  if (!holder) {
    holder = document.createElement('div');
    holder.className = 'cue-shape-text';
    holder.append(createTextBody());
    node.append(holder);
  }
  const body = holder.firstElementChild;
  if (body instanceof HTMLElement) showText(node, body, element.text);
}

function paintTextBox(node: HTMLElement, element: TextElement): void {
  node.classList.add('cue-text-box');
  node.style.background = element.fill === 'none' ? '' : element.fill;
  node.style.padding = `${String(element.padding)}px`;
  node.style.border =
    element.border.width > 0
      ? `${String(element.border.width)}px ${element.border.dash} ${element.border.color}`
      : '';
  let body = node.querySelector<HTMLElement>(':scope > .cue-text');
  if (!body) {
    body = createTextBody();
    node.append(body);
  }
  showText(node, body, element.doc);
}

/** A picture: an image drawn to fill the box, which sits at the proportions chosen for it. */
function paintImage(node: HTMLElement, element: ImageElement): void {
  node.classList.add('cue-image-box');
  node.style.background = element.fill === 'none' ? '' : element.fill;
  node.style.border =
    element.border.width > 0
      ? `${String(element.border.width)}px ${element.border.dash} ${element.border.color}`
      : '';
  let img = node.querySelector<HTMLImageElement>(':scope > img.cue-image');
  if (!img) {
    img = document.createElement('img');
    img.className = 'cue-image';
    img.draggable = false;
    node.append(img);
  }
  img.alt = element.alt;
  const source = imageSource();
  const hash = element.hash;
  if (img.dataset.hash === hash && img.getAttribute('src')) return;
  img.dataset.hash = hash;
  const url = source?.url(hash);
  if (url !== undefined) {
    img.src = url;
    return;
  }
  img.removeAttribute('src');
  const shown = img;
  // The picture is on its way: draw it as soon as it is, if this box still wants that picture.
  source?.load(hash, () => {
    const ready = source.url(hash);
    if (ready !== undefined && shown.dataset.hash === hash) shown.src = ready;
  });
}

function paint(node: HTMLElement, element: SlideElement): void {
  styleBox(node, element);
  if (isShape(element)) paintShape(node, element);
  else if (isImage(element)) paintImage(node, element);
  else paintTextBox(node, element);
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

  let shownHidden: ReadonlySet<Id> = NOBODY;
  let running: Animation[] = [];

  const update = (next: Slide, hidden: ReadonlySet<Id> = NOBODY, look: Look = PLAIN) => {
    shownHidden = hidden;
    surface.dataset.slideId = next.id;
    surface.style.background = next.background;
    const sets = lookSets(next, look);

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
      entry.node.style.visibility = hidden.has(element.id) ? 'hidden' : '';
      const opacity = drawnOpacity(element.opacity, element.id, sets);
      const shownOpacity = opacity === 1 ? '' : String(opacity);
      if (entry.node.style.opacity !== shownOpacity) entry.node.style.opacity = shownOpacity;
      // The turn, and where an animation has moved the element to.
      const shownTransform = drawnTransform(element, sets.positions.get(element.id));
      if (entry.node.style.transform !== shownTransform)
        entry.node.style.transform = shownTransform;
      // Back to front is document order: put each node right after the one before it.
      const wanted: ChildNode | null = previous ? previous.nextSibling : surface.firstChild;
      if (wanted !== entry.node) surface.insertBefore(entry.node, wanted);
      previous = entry.node;
    }
  };
  update(slide);

  const settle = () => {
    for (const animation of running) animation.cancel();
    running = [];
  };

  const play = async (next: Slide, from: number, to: number) => {
    settle();
    update(next, shownHidden, { mode: 'click', click: to });
    if (to !== from + 1) return;
    const mine = playClick(next, to, (id) => drawn.get(id)?.node);
    running = mine;
    await Promise.all(mine.map((animation) => animation.finished.catch(() => undefined)));
    if (running === mine) running = [];
  };

  return {
    update,
    play,
    settle,
    destroy() {
      settle();
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
