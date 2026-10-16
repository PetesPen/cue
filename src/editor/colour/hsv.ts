/**
 * Colours as hue, saturation and brightness, which is how a person moves across a colour area, and
 * back to the `#RRGGBB` the deck stores. Pure functions, so they are tested without a screen.
 */

export interface Hsv {
  /** Degrees, 0 up to (not including) 360. */
  readonly h: number;
  /** 0 (grey) to 1 (full colour). */
  readonly s: number;
  /** 0 (black) to 1 (brightest). */
  readonly v: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** `#RRGGBB` (any case) to its three channels as fractions, 0 to 1. */
function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - chroma;
  const sector = Math.floor(hue / 60);
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][sector] ?? [chroma, x, 0];
  const byte = (c: number) =>
    Math.round((c + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r ?? 0)}${byte(g ?? 0)}${byte(b ?? 0)}`.toUpperCase();
}

/** The full-strength colour of a hue: the corner of the colour area the pointer drags towards. */
export const pureHue = (h: number): string => hsvToHex({ h, s: 1, v: 1 });

/**
 * Colours with no hue of their own (greys) have no meaningful hue in HSV. When a colour is read back
 * from hex, keep the hue the person had chosen so the slider does not jump to red.
 */
export function keepHue(next: Hsv, before: Hsv): Hsv {
  return next.s === 0 || next.v === 0 ? { ...next, h: before.h } : next;
}
