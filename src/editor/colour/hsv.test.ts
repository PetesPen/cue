import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { hexToHsv, hsvToHex, keepHue, pureHue } from './hsv';

describe('colours as hue, saturation and brightness (EL-10)', () => {
  test.each([
    ['#FF0000', { h: 0, s: 1, v: 1 }],
    ['#00FF00', { h: 120, s: 1, v: 1 }],
    ['#0000FF', { h: 240, s: 1, v: 1 }],
    ['#000000', { h: 0, s: 0, v: 0 }],
    ['#FFFFFF', { h: 0, s: 0, v: 1 }],
    ['#808080', { h: 0, s: 0, v: 128 / 255 }],
  ])('Given %s, When it is read as hue, saturation and brightness, Then it is %j', (hex, hsv) => {
    const read = hexToHsv(hex);

    expect(read.h).toBeCloseTo(hsv.h, 6);
    expect(read.s).toBeCloseTo(hsv.s, 6);
    expect(read.v).toBeCloseTo(hsv.v, 6);
  });

  test('Given the design green, When it is read and written back, Then it is the same colour', () => {
    expect(hsvToHex(hexToHsv('#17803F'))).toBe('#17803F');
    expect(hexToHsv('#17803F').h).toBeGreaterThan(130);
    expect(hexToHsv('#17803F').h).toBeLessThan(150);
  });

  test('Given any colour, When it goes to hue, saturation and brightness and back, Then it is exactly the same colour', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffff }), (n) => {
        const hex = `#${n.toString(16).padStart(6, '0')}`.toUpperCase();

        expect(hsvToHex(hexToHsv(hex))).toBe(hex);
      }),
    );
  });

  test('Given values outside the range, When they are written, Then they are held inside it', () => {
    expect(hsvToHex({ h: 400, s: 2, v: -1 })).toBe('#000000');
    expect(hsvToHex({ h: -60, s: 1, v: 1 })).toBe('#FF00FF');
  });

  test('Given a hue, When the full-strength colour is asked for, Then it is that hue at full saturation and brightness', () => {
    expect(pureHue(0)).toBe('#FF0000');
    expect(pureHue(60)).toBe('#FFFF00');
  });

  test('Given a grey is read back, When the old hue is kept, Then the slider stays where it was', () => {
    const before = { h: 200, s: 0.5, v: 0.5 };

    expect(keepHue(hexToHsv('#777777'), before).h).toBe(200);
    expect(keepHue(hexToHsv('#17803F'), before).h).not.toBe(200);
  });
});
