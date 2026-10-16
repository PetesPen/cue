import {
  isImage,
  isShape,
  isTextBox,
  plainText,
  type AppearStyle,
  type DisappearStyle,
  type Easing,
  type SlideElement,
  type Step,
} from '@/model';
import { SHAPE_LABELS } from '../shapeLabels';

/** The longest an element's name gets in the step list. */
const NAME_LENGTH = 24;

/**
 * What an element is called in the step list. Elements have no names yet (the layers panel, ZO-2,
 * gives them), so a text box is its first words, a shape its kind and a picture its description.
 */
export function elementName(element: SlideElement): string {
  if (isShape(element)) return SHAPE_LABELS[element.shape];
  if (isImage(element)) return element.alt.trim() === '' ? 'Image' : shorten(element.alt.trim());
  if (isTextBox(element)) {
    const words = plainText(element.doc).replace(/\s+/g, ' ').trim();
    return words === '' ? 'Text' : shorten(words);
  }
  return 'Element';
}

function shorten(words: string): string {
  return words.length <= NAME_LENGTH ? words : `${words.slice(0, NAME_LENGTH - 1).trimEnd()}…`;
}

/** The colour of the little square beside an element in the step list. */
export function swatchOf(element: SlideElement): string {
  if (isImage(element)) return 'var(--color-mint)';
  if (element.fill !== 'none') return element.fill;
  return element.border.width > 0 ? element.border.color : 'var(--color-forest)';
}

export const EFFECT_LABELS: Readonly<Record<Step['effect'], string>> = {
  appear: 'Appear',
  disappear: 'Disappear',
};

export const APPEAR_STYLE_LABELS: Readonly<Record<AppearStyle, string>> = {
  instant: 'Instant',
  fade: 'Fade',
  rise: 'Fade and rise',
};

export const DISAPPEAR_STYLE_LABELS: Readonly<Record<DisappearStyle, string>> = {
  instant: 'Instant',
  fade: 'Fade out',
};

export const EASING_LABELS: Readonly<Record<Easing, string>> = {
  linear: 'Linear',
  'ease-in': 'Ease in',
  'ease-out': 'Ease out',
  'ease-in-out': 'In-out',
};

/** "4 steps · 3 clicks", with the singular where it is one. */
export function describeCounts(steps: number, clicks: number): string {
  const s = `${String(steps)} ${steps === 1 ? 'step' : 'steps'}`;
  const c = `${String(clicks)} ${clicks === 1 ? 'click' : 'clicks'}`;
  return `${s} · ${c}`;
}
