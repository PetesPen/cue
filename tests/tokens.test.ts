import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { loadTokens } from './support/tokens';

const tokens = loadTokens();
const css = readFileSync('design/tokens.css', 'utf8');

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

// accentTintText -> accent-tint-text
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function cssVariable(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

describe('Given the contrast calculator', () => {
  test('When black is on white, Then the ratio is 21', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  test('When a colour is on itself, Then the ratio is 1', () => {
    expect(contrast('#17803F', '#17803F')).toBeCloseTo(1, 5);
  });
});

describe('Given the text colour pairs in design/tokens.json (UX-6, WCAG AA)', () => {
  test('When the list is read, Then it is not empty and every name is a defined colour', () => {
    expect(tokens.textPairs.length).toBeGreaterThan(0);
    for (const name of tokens.textPairs.flat()) expect(tokens.color).toHaveProperty(name);
  });

  test.each(tokens.textPairs)(
    'When %s is drawn on %s, Then the contrast is at least 4.5:1',
    (foreground, background) => {
      const ratio = contrast(tokens.color[foreground] ?? '', tokens.color[background] ?? '');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    },
  );

  // design/README.md: muted on sage passes only narrowly, so neither colour may be lightened.
  test('When muted text is on the sage well, Then it still passes, but narrowly', () => {
    const ratio = contrast(tokens.color.muted ?? '', tokens.color.sage ?? '');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(4.7);
  });

  // design/README.md: muted on the hairline colour is below AA, so it must never be a listed pair.
  test('When the pairs are checked, Then muted-on-hairline is not among them', () => {
    expect(contrast(tokens.color.muted ?? '', tokens.color.hairline ?? '')).toBeLessThan(4.5);
    expect(tokens.textPairs).not.toContainEqual(['muted', 'hairline']);
  });
});

describe('Given design/tokens.css and design/tokens.json, which both claim to be the source', () => {
  test.each(Object.entries(tokens.color))(
    'When colour %s is compared, Then the CSS variable matches',
    (name, hex) => {
      expect(cssVariable(`color-${kebab(name)}`)?.toUpperCase()).toBe(hex.toUpperCase());
    },
  );

  test.each(Object.entries(tokens.radius))(
    'When radius %s is compared, Then the CSS variable matches',
    (name, px) => {
      expect(cssVariable(`radius-${name}`)).toBe(`${px.toString()}px`);
    },
  );

  test.each(tokens.space.map((px, i) => [i + 1, px] as const))(
    'When space step %i is compared, Then the CSS variable is %ipx',
    (step, px) => {
      expect(cssVariable(`space-${step.toString()}`)).toBe(`${px.toString()}px`);
    },
  );

  test.each(['topbar', 'slideRail', 'inspector', 'notesStrip'])(
    'When layout size %s is compared, Then the CSS variable matches',
    (name) => {
      expect(cssVariable(`layout-${kebab(name)}`)).toBe(`${String(tokens.layout[name])}px`);
    },
  );

  test('When the slide size is compared, Then it is 1920 by 1080 in both', () => {
    expect(tokens.layout.slide).toEqual([1920, 1080]);
    expect(cssVariable('slide-width')).toBe('1920px');
    expect(cssVariable('slide-height')).toBe('1080px');
  });
});
