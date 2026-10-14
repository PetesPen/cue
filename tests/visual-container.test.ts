import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { isRecord, isString } from './support/guards';

function loadConfig(): { image: string; tag: string; digest: string } {
  const raw: unknown = JSON.parse(readFileSync('config/visual.json', 'utf8'));
  if (!isRecord(raw) || !isString(raw.image) || !isString(raw.tag) || !isString(raw.digest)) {
    throw new Error('config/visual.json does not have image, tag and digest');
  }
  return { image: raw.image, tag: raw.tag, digest: raw.digest };
}

const config = loadConfig();
const reference = `${config.image}:${config.tag}@${config.digest}`;

function visualJobImage(): unknown {
  const ci: unknown = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
  const jobs = isRecord(ci) ? ci.jobs : undefined;
  const visual = isRecord(jobs) ? jobs.visual : undefined;
  const container = isRecord(visual) ? visual.container : undefined;
  return isRecord(container) ? container.image : undefined;
}

describe('Given the pinned visual regression container (CLAUDE.md, testing rules)', () => {
  test('When the image is read, Then it is pinned by a full sha256 digest', () => {
    expect(config.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('When the tag is read, Then it matches the installed Playwright version', () => {
    const installed: unknown = JSON.parse(
      readFileSync('node_modules/@playwright/test/package.json', 'utf8'),
    );
    const version = isRecord(installed) && isString(installed.version) ? installed.version : '';
    expect(config.tag).toBe(`v${version}-noble`);
  });

  test('When the CI visual job is read, Then it uses exactly this image', () => {
    expect(visualJobImage()).toBe(reference);
  });

  test('When the Docker script is read, Then it takes the image from the same file', () => {
    const script = readFileSync('scripts/visual-docker.mjs', 'utf8');
    expect(script).toContain('config/visual.json');
    expect(script).not.toContain('mcr.microsoft.com');
  });

  test('When the visual config is read, Then it refuses to run outside the container', () => {
    const source = readFileSync('playwright.visual.config.ts', 'utf8');
    expect(source).toContain("process.env.CUE_VISUAL_CONTAINER !== '1'");
    expect(source).toMatch(/throw new Error/);
  });

  test('When the normal end-to-end config is read, Then it leaves the visual folder alone', () => {
    expect(readFileSync('playwright.config.ts', 'utf8')).toContain("testIgnore: '**/visual/**'");
  });
});
