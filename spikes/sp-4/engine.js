// SP-4 spike code: throwaway. The motion engine in two parts.
//  1. A pure function: resolve(slide, step) gives every element's state at that click.
//  2. A player: animates the difference between two states with the Web Animations API.
// Going back a step is just resolve(slide, n - 1) and playing the difference the other way.

const prng = (seed) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A slide with `count` elements and three click steps: everything flies in, moves, then fades out. */
export function makeSlide(count, seed, heavy = false) {
  const random = prng(seed);
  const kinds = ['rect', 'circle', 'text', 'image'];
  const elements = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    kind: kinds[i % kinds.length],
    x: Math.round(random() * (heavy ? 1100 : 1500)),
    y: Math.round(random() * (heavy ? 600 : 800)),
    w: heavy ? 500 + Math.round(random() * 600) : 160 + Math.round(random() * 220),
    h: heavy ? 350 + Math.round(random() * 350) : 100 + Math.round(random() * 140),
    opacity: 0.55 + Math.round(random() * 45) / 100,
    hue: Math.round(random() * 360),
  }));
  const steps = [
    elements.map((e) => ({ id: e.id, type: 'appear' })),
    elements.map((e) => ({ id: e.id, type: 'move', dx: 160, dy: 40 })),
    elements.map((e) => ({ id: e.id, type: 'disappear' })),
  ];
  return { elements, steps };
}

/** The state of every element at click `step` (0 = before the first click). Pure. */
export function resolve(slide, step) {
  const state = {};
  for (const e of slide.elements) {
    const entrance = slide.steps.some((s) => s.some((fx) => fx.id === e.id && fx.type === 'appear'));
    state[e.id] = { opacity: entrance ? 0 : e.opacity, dx: entrance ? -80 : 0, dy: 0 };
  }
  for (let n = 0; n < Math.min(step, slide.steps.length); n += 1) {
    for (const fx of slide.steps[n]) {
      const base = slide.elements.find((e) => e.id === fx.id);
      const s = state[fx.id];
      if (fx.type === 'appear') {
        s.opacity = base.opacity;
        s.dx = 0;
      } else if (fx.type === 'disappear') s.opacity = 0;
      else if (fx.type === 'move') {
        s.dx += fx.dx;
        s.dy += fx.dy;
      }
    }
  }
  return state;
}

/** The elements whose state differs between two clicks. Pure. */
export function diff(slide, from, to) {
  const a = resolve(slide, from);
  const b = resolve(slide, to);
  return Object.keys(a).filter((id) => a[id].opacity !== b[id].opacity || a[id].dx !== b[id].dx || a[id].dy !== b[id].dy);
}

// ---- the DOM side ---------------------------------------------------------------------------

/** mode 'transform' moves elements with transform (compositor only); 'layout' moves them with left and top. */
export function buildSlide(slide, container, mode, images) {
  const root = document.createElement('div');
  root.className = 'slide';
  const dom = new Map();
  slide.elements.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = `el ${e.kind}`;
    el.style.width = `${e.w}px`;
    el.style.height = `${e.h}px`;
    el.style.left = `${e.x}px`;
    el.style.top = `${e.y}px`;
    el.dataset.id = e.id;
    if (e.kind === 'rect') el.style.background = `hsl(${e.hue} 55% 55%)`;
    if (e.kind === 'circle') {
      el.style.background = `hsl(${e.hue} 55% 40%)`;
      el.style.borderRadius = '50%';
    }
    if (e.kind === 'text') {
      el.textContent = 'Listen first, ship in small steps, measure what matters.';
      el.style.font = '600 26px system-ui, sans-serif';
      el.style.color = `hsl(${e.hue} 60% 25%)`;
    }
    if (e.kind === 'image') {
      const img = new Image();
      img.src = images[i % images.length];
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      el.appendChild(img);
    }
    root.appendChild(el);
    dom.set(e.id, el);
  });
  container.appendChild(root);
  return { root, dom, slide, mode };
}

const frame = (slide, id, s, mode) => {
  const base = slide.elements.find((e) => e.id === id);
  return mode === 'transform'
    ? { opacity: s.opacity, transform: `translate(${s.dx}px, ${s.dy}px)` }
    : { opacity: s.opacity, left: `${base.x + s.dx}px`, top: `${base.y + s.dy}px` };
};

/** Put every element straight into the state for `step`, with no animation. */
export function applyStep(view, step) {
  const state = resolve(view.slide, step);
  for (const [id, el] of view.dom) Object.assign(el.style, frame(view.slide, id, state[id], view.mode));
}

/** Animate from click `from` to click `to` (either direction). Resolves when every animation has finished. */
export async function playStep(view, from, to, ms) {
  const started = performance.now();
  const a = resolve(view.slide, from);
  const b = resolve(view.slide, to);
  const animations = [];
  for (const id of diff(view.slide, from, to)) {
    const el = view.dom.get(id);
    animations.push(el.animate([frame(view.slide, id, a[id], view.mode), frame(view.slide, id, b[id], view.mode)], { duration: ms, easing: 'ease-in-out', fill: 'forwards' }));
  }
  const setupMs = performance.now() - started;
  await Promise.all(animations.map((x) => x.finished));
  applyStep(view, to); // commit the end state in the DOM, then drop the animations
  animations.forEach((x) => x.cancel());
  return { setupMs, animated: animations.length };
}

/** A slide-to-slide transition: both slides are whole layers that move or fade together. */
export async function playTransition(outgoing, incoming, kind, ms) {
  const started = performance.now();
  const options = { duration: ms, easing: 'ease-in-out', fill: 'forwards' };
  const animations = [];
  incoming.root.style.visibility = 'visible';
  if (kind === 'fade') {
    animations.push(outgoing.root.animate([{ opacity: 1 }, { opacity: 0 }], options));
    animations.push(incoming.root.animate([{ opacity: 0 }, { opacity: 1 }], options));
  } else if (kind === 'push') {
    animations.push(outgoing.root.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-1920px)' }], options));
    animations.push(incoming.root.animate([{ transform: 'translateX(1920px)' }, { transform: 'translateX(0)' }], options));
  } else {
    animations.push(outgoing.root.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.25)' }], options));
    animations.push(incoming.root.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)' }], options));
  }
  const setupMs = performance.now() - started;
  await Promise.all(animations.map((x) => x.finished));
  outgoing.root.style.visibility = 'hidden';
  animations.forEach((x) => x.cancel());
  return { setupMs, animated: animations.length };
}
