import type { Slide, Transition, TransitionSide } from '@/model';
import { PLAIN, type Look } from './motion';
import { createSlideRenderer, type SlideRenderer } from './slide';

/**
 * The stage (TN-4, TN-5): where a show or a Preview draws its slides. One slide sits on it at rest;
 * moving to another can play a transition between them. The two slides are two layers of the shared
 * renderer, and a transition moves only whole layers with `transform` and `opacity` (SP-4), never
 * what is inside them.
 *
 * As in the motion engine, the end state is drawn first: the incoming slide is at rest, complete, in
 * the DOM before the animations start, and they only show the way there. Cancelling one (a quick
 * second key press) can therefore never leave anything out of place.
 */
export interface SlideStage {
  /** Show `slide` at once, in `look` (AN-1). Any transition in progress ends first. */
  readonly show: (slide: Slide, look?: Look) => void;
  /** Show click `to` after click `from` of the slide on the stage, animated when it is the next one. */
  readonly play: (slide: Slide, from: number, to: number) => Promise<void>;
  /**
   * Bring `slide` in with `transition`, or, `reversed`, take the slide on the stage away with it as the
   * show goes back (TN-5). Resolves when it has finished or been settled.
   */
  readonly transition: (
    slide: Slide,
    look: Look,
    transition: Transition,
    reversed: boolean,
  ) => Promise<void>;
  /** Stop everything now, a transition included: the slide that is arriving is on the stage, at rest. */
  readonly settle: () => void;
  readonly destroy: () => void;
}

interface Layer {
  readonly node: HTMLElement;
  readonly renderer: SlideRenderer;
}

/** Where the new slide starts, as a share of the stage's own size. */
const OFFSET: Record<TransitionSide, string> = {
  right: 'translate(100%, 0)',
  left: 'translate(-100%, 0)',
  top: 'translate(0, -100%)',
  bottom: 'translate(0, 100%)',
};

const OPPOSITE: Record<TransitionSide, TransitionSide> = {
  right: 'left',
  left: 'right',
  top: 'bottom',
  bottom: 'top',
};

/** Zoom grows the new slide from this share of its size. */
export const ZOOM_FROM = 0.3;

/**
 * What a transition does to the layers: `top` is the layer that moves over the other (the one coming
 * in, or, reversed, the one going out) from where it starts to rest; `bottom`, for Push, moves the
 * other layer from rest to where it is pushed. Played backwards, the same keyframes undo the move.
 */
export function layerMotion(transition: Transition): {
  readonly top: Keyframe[];
  readonly bottom?: Keyframe[];
} {
  const rest = 'none';
  switch (transition.kind) {
    case 'fade':
      return { top: [{ opacity: 0 }, { opacity: 1 }] };
    case 'slide':
      return { top: [{ transform: OFFSET[transition.from] }, { transform: rest }] };
    case 'push':
      return {
        top: [{ transform: OFFSET[transition.from] }, { transform: rest }],
        bottom: [{ transform: rest }, { transform: OFFSET[OPPOSITE[transition.from]] }],
      };
    case 'zoom':
      return {
        top: [
          { transform: `scale(${String(ZOOM_FROM)})`, opacity: 0 },
          { transform: rest, opacity: 1 },
        ],
      };
    case 'none':
      return { top: [] };
  }
}

export function createSlideStage(host: HTMLElement, slide: Slide, look: Look = PLAIN): SlideStage {
  const frame = document.createElement('div');
  frame.className = 'cue-stage';
  host.append(frame);

  const makeLayer = (next: Slide, how: Look, before?: Layer): Layer => {
    const node = document.createElement('div');
    node.className = 'cue-layer';
    frame.insertBefore(node, before?.node ?? null);
    const renderer = createSlideRenderer(node, next);
    renderer.update(next, undefined, how);
    return { node, renderer };
  };
  const removeLayer = (layer: Layer) => {
    layer.renderer.destroy();
    layer.node.remove();
  };

  let current = makeLayer(slide, look);
  /** A transition in progress: the layer going away, and the animations that move the layers. */
  let pending: { readonly leaving: Layer; readonly animations: Animation[] } | undefined;

  const settle = () => {
    if (pending) {
      for (const animation of pending.animations) animation.cancel();
      removeLayer(pending.leaving);
      pending = undefined;
    }
    current.renderer.settle();
  };

  const show = (next: Slide, how: Look = PLAIN) => {
    settle();
    current.renderer.update(next, undefined, how);
  };

  const play = (next: Slide, from: number, to: number) => {
    settle();
    return current.renderer.play(next, from, to);
  };

  const transition = async (next: Slide, how: Look, change: Transition, reversed: boolean) => {
    settle();
    const leaving = current;
    // Forward, the new slide is drawn over the old one; back, the old one goes away over the new one.
    const incoming = makeLayer(next, how, reversed ? leaving : undefined);
    current = incoming;
    const motion = layerMotion(change);
    const options: KeyframeAnimationOptions = {
      duration: change.duration * 1000,
      easing: 'ease-in-out',
      fill: 'both',
      direction: reversed ? 'reverse' : 'normal',
    };
    const animations: Animation[] = [];
    const [top, bottom] = reversed ? [leaving, incoming] : [incoming, leaving];
    if (motion.top.length > 0) animations.push(top.node.animate(motion.top, options));
    if (motion.bottom) animations.push(bottom.node.animate(motion.bottom, options));
    const mine = { leaving, animations };
    pending = mine;
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
    if (pending === mine) {
      for (const animation of animations) animation.cancel();
      removeLayer(leaving);
      pending = undefined;
    }
  };

  return {
    show,
    play,
    transition,
    settle,
    destroy() {
      settle();
      removeLayer(current);
      frame.remove();
    },
  };
}
