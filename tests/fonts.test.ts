import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadTokens } from './support/tokens';

interface Face {
  family: string;
  file: string;
  hasUnicodeRange: boolean;
}

const FONT_DIR = 'src/fonts';
const MAX_FILE_BYTES = 100_000;

const tokens = loadTokens();
const css = readFileSync(join(FONT_DIR, 'fonts.css'), 'utf8');
const readme = readFileSync(join(FONT_DIR, 'README.md'), 'utf8');

const faces: Face[] = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body = '']) => ({
  family: /font-family:\s*'([^']+)'/.exec(body)?.[1] ?? '',
  file: /url\('\.\/([^']+)'\)/.exec(body)?.[1] ?? '',
  hasUnicodeRange: body.includes('unicode-range:'),
}));

const woff2Files = readdirSync(FONT_DIR, { recursive: true, encoding: 'utf8' })
  .filter((name) => name.endsWith('.woff2'))
  .map((name) => name.replaceAll('\\', '/'));

describe('Given the bundled fonts (EL-2, docs/decisions.md: open licences only)', () => {
  test.each(tokens.font.slideFamilies)(
    'When family %s is looked up, Then fonts.css declares it',
    (family) => {
      expect(faces.some((face) => face.family === family)).toBe(true);
    },
  );

  test('When the UI family is looked up, Then it is one of the slide families', () => {
    expect(tokens.font.slideFamilies).toContain(tokens.font.ui);
  });

  test('When fonts.css is read, Then it declares no family that the design does not list', () => {
    const declared = new Set(faces.map((face) => face.family));
    expect([...declared].sort()).toEqual([...tokens.font.slideFamilies].sort());
  });

  test('When fonts.css is read, Then nothing is loaded from another host (SV-4: no external requests)', () => {
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toContain('@import');
  });

  test.each(faces.map((face) => [face.family, face.file] as const))(
    'When %s file %s is read, Then it exists, is real WOFF2 and is small enough',
    (_family, file) => {
      const path = join(FONT_DIR, file);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path).subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(statSync(path).size).toBeLessThan(MAX_FILE_BYTES);
    },
  );

  test.each(faces.map((face) => [face.family, face.file] as const))(
    'When %s file %s is read, Then it is limited by a unicode-range so only the Latin subset is fetched',
    (family, file) => {
      expect(
        faces.find((face) => face.family === family && face.file === file)?.hasUnicodeRange,
      ).toBe(true);
    },
  );

  test('When the font folder is listed, Then every WOFF2 file is used by fonts.css', () => {
    expect([...woff2Files].sort()).toEqual(faces.map((face) => face.file).sort());
  });

  test.each([...new Set(woff2Files.map((file) => file.split('/')[0] ?? ''))])(
    'When folder %s is read, Then it carries the SIL Open Font License 1.1 text',
    (folder) => {
      const licence = readFileSync(join(FONT_DIR, folder, 'OFL.txt'), 'utf8');
      expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
      expect(licence).toMatch(/Copyright/);
    },
  );

  test.each(woff2Files)('When %s is hashed, Then README.md lists the same SHA-256', (file) => {
    const name = file.split('/').pop() ?? '';
    const hash = createHash('sha256')
      .update(readFileSync(join(FONT_DIR, file)))
      .digest('hex');
    expect(readme).toContain(`\`${name}\` ${hash}`);
  });
});
