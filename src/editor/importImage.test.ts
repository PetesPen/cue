import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@/model';
import {
  FIT_SHARE,
  MAX_LONG_EDGE,
  fitInSlide,
  placeCentred,
  scaledSize,
  sniffImageType,
} from './importImage';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);

describe('what a file really is (EL-4)', () => {
  test.each([
    ['a PNG', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), 'image/png'],
    ['a JPEG', bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10), 'image/jpeg'],
    ['a GIF', text('GIF89a\u0001\u0000'), 'image/gif'],
    ['a GIF87', text('GIF87a'), 'image/gif'],
    [
      'a WebP',
      bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56),
      'image/webp',
    ],
    [
      'an SVG',
      text('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'),
      'image/svg+xml',
    ],
    ['an SVG after spaces and a BOM', text('﻿  \n<svg viewBox="0 0 1 1"/>'), 'image/svg+xml'],
    [
      'an SVG with an XML header',
      text('<?xml version="1.0"?>\n<!-- c -->\n<svg xmlns="http://www.w3.org/2000/svg"/>'),
      'image/svg+xml',
    ],
  ])('Given %s, When the bytes are looked at, Then it is %s', (_name, content, type) => {
    expect(sniffImageType(content)).toBe(type);
  });

  test.each([
    ['plain text', text('hello world')],
    ['an HTML page', text('<!doctype html><html></html>')],
    ['a PDF', text('%PDF-1.7')],
    [
      'a WAV (RIFF but not WebP)',
      bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45),
    ],
    ['an XML file that is not an SVG', text('<?xml version="1.0"?><note/>')],
    ['an SVG-like word in a text file', text('see <svgs> for details')],
    ['nothing at all', bytes()],
  ])('Given %s, When the bytes are looked at, Then it is not a picture', (_name, content) => {
    expect(sniffImageType(content)).toBeUndefined();
  });
});

describe('scaling a huge picture down (EL-4)', () => {
  test('Given 6000 by 4000, When it is scaled, Then it is 2560 by 1707, in the same proportions', () => {
    expect(scaledSize(6000, 4000)).toEqual({ width: 2560, height: 1707, scaled: true });
  });

  test('Given a picture inside the limit, When it is scaled, Then it is left as it is', () => {
    expect(scaledSize(2560, 1000)).toEqual({ width: 2560, height: 1000, scaled: false });
    expect(scaledSize(100, 80)).toEqual({ width: 100, height: 80, scaled: false });
  });

  test('Given any size, When it is scaled, Then the longer side is within the limit and the proportions hold (property)', () => {
    fc.assert(
      fc.property(
        // A side under 20 px next to 20000 is a line, whose proportions whole pixels cannot hold.
        fc.integer({ min: 20, max: 20000 }),
        fc.integer({ min: 20, max: 20000 }),
        (w, h) => {
          const result = scaledSize(w, h);

          expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(MAX_LONG_EDGE);
          expect(result.width).toBeGreaterThanOrEqual(1);
          expect(result.height).toBeGreaterThanOrEqual(1);
          if (!result.scaled) expect([result.width, result.height]).toEqual([w, h]);
          else
            // Whole pixels cannot hold the proportions exactly: the shape is off by under one
            // pixel on the shorter side, in proportion.
            expect(Math.abs(result.width / result.height - w / h) / (w / h)).toBeLessThanOrEqual(
              1 / Math.min(result.width, result.height),
            );
        },
      ),
    );
  });
});

describe('putting a picture on the slide (EL-4)', () => {
  test('Given a small picture, When it is fitted, Then it keeps its own size', () => {
    expect(fitInSlide(400, 300)).toEqual({ width: 400, height: 300 });
  });

  test('Given a picture bigger than the slide, When it is fitted, Then it is shrunk into the share of the slide, in proportion', () => {
    const size = fitInSlide(4000, 1000);

    expect(size.width).toBe(Math.round(SLIDE_WIDTH * FIT_SHARE));
    expect(size.height).toBe(Math.round((1000 / 4000) * SLIDE_WIDTH * FIT_SHARE));
  });

  test('Given a tall picture, When it is fitted, Then the height decides', () => {
    expect(fitInSlide(1000, 4000).height).toBe(Math.round(SLIDE_HEIGHT * FIT_SHARE));
  });

  test('Given no place, When a picture is centred, Then it is in the middle of the slide', () => {
    expect(placeCentred({ width: 400, height: 200 }, undefined)).toEqual({ x: 760, y: 440 });
  });

  test('Given a drop point, When a picture is centred on it, Then its middle is there', () => {
    expect(placeCentred({ width: 400, height: 200 }, { x: 1000, y: 500 })).toEqual({
      x: 800,
      y: 400,
    });
  });

  test('Given a drop point near a corner, When a picture is centred on it, Then it is kept wholly on the slide', () => {
    expect(placeCentred({ width: 400, height: 200 }, { x: 10, y: 5 })).toEqual({ x: 0, y: 0 });
    expect(placeCentred({ width: 400, height: 200 }, { x: 1915, y: 1075 })).toEqual({
      x: SLIDE_WIDTH - 400,
      y: SLIDE_HEIGHT - 200,
    });
  });

  test('Given a second picture, When an offset is given, Then it sits further along', () => {
    const first = placeCentred({ width: 400, height: 200 }, undefined, 0);
    const second = placeCentred({ width: 400, height: 200 }, undefined, 32);

    expect([second.x - first.x, second.y - first.y]).toEqual([32, 32]);
  });
});
