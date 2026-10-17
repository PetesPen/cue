import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from '../config/headers';

const toml = readFileSync('netlify.toml', 'utf8');

function tomlValue(name: string): string | undefined {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*=\\s*"([^"]*)"`, 'm').exec(toml)?.[1];
}

describe('Given netlify.toml (decision 3: Netlify hosts the live site and the previews)', () => {
  test('When the build settings are read, Then it builds with npm run build and publishes dist', () => {
    expect(tomlValue('command')).toBe('npm run build');
    expect(tomlValue('publish')).toBe('dist');
  });

  test('When the Node version is looked up, Then .nvmrc provides it', () => {
    expect(existsSync('.nvmrc')).toBe(true);
    expect(toml).not.toMatch(/NODE_VERSION/);
  });

  test.each(Object.entries(securityHeaders))(
    'When header %s is compared, Then netlify.toml has the same value as config/headers.ts',
    (name, value) => {
      expect(tomlValue(name)).toBe(value);
    },
  );

  test('When built files are served, Then they are cached for a year as immutable', () => {
    expect(tomlValue('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });
});

describe('Given the installable app (UX-7)', () => {
  /** The headers block that applies to `path`, as text. */
  function blockFor(path: string): string | undefined {
    return toml.split('[[headers]]').find((block) => block.includes(`for = "${path}"`));
  }

  test.each(['/sw.js', '/index.html', '/', '/manifest.webmanifest'])(
    'When %s is fetched, Then it is never served from a stored copy, so a new version is seen',
    (path) => {
      expect(blockFor(path)).toMatch(/Cache-Control\s*=\s*"no-cache"/);
    },
  );

  test('When the built assets are served, Then they stay immutable', () => {
    expect(blockFor('/assets/*')).toMatch(/immutable/);
  });
});

describe('Given the content security policy (SV-4: no external requests)', () => {
  const directives = new Map(
    contentSecurityPolicy.split('; ').map((part) => {
      const [name = '', ...sources] = part.split(' ');
      return [name, sources] as const;
    }),
  );

  test('When it is read, Then everything defaults to the app itself', () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
  });

  test('When it is read, Then no host is named and scripts cannot be inline or eval', () => {
    expect(contentSecurityPolicy).not.toMatch(/https?:|\*/);
    expect(directives.get('script-src')).toEqual(["'self'"]);
  });

  test('When it is read, Then plugins and framing are blocked', () => {
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
  });
});
