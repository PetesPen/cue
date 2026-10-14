// Fails the build when the first load of the app is bigger than config/budgets.json allows.
// Run after `vite build`: node scripts/check-bundle-size.mjs [distDir]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * The files index.html asks for on first load: module scripts, modulepreload links and stylesheets.
 * Lazy chunks are not listed there, so they do not count.
 * @param {string} html
 * @returns {{ js: string[]; css: string[] }}
 */
export function firstLoadFiles(html) {
  const js = new Set();
  const css = new Set();
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    /** @type {Record<string, string>} */
    const attributes = {};
    for (const [, name = '', value = ''] of tag.matchAll(/([\w-]+)="([^"]*)"/g)) {
      attributes[name] = value;
    }
    if (tag.startsWith('<script') && attributes['type'] === 'module' && attributes['src']) {
      js.add(attributes['src']);
    } else if (attributes['rel'] === 'modulepreload' && attributes['href']) {
      js.add(attributes['href']);
    } else if (attributes['rel'] === 'stylesheet' && attributes['href']) {
      css.add(attributes['href']);
    }
  }
  return { js: [...js], css: [...css] };
}

/**
 * @param {string} distDir
 * @returns {{ jsGzipBytes: number; cssGzipBytes: number; files: { file: string; gzipBytes: number }[] }}
 */
export function measure(distDir) {
  const { js, css } = firstLoadFiles(readFileSync(join(distDir, 'index.html'), 'utf8'));
  const sizeOf = (/** @type {string} */ url) => {
    const gzipBytes = gzipSync(readFileSync(join(distDir, url.replace(/^\//, '')))).length;
    return { file: url, gzipBytes };
  };
  const jsFiles = js.map(sizeOf);
  const cssFiles = css.map(sizeOf);
  const total = (/** @type {{ gzipBytes: number }[]} */ files) =>
    files.reduce((sum, f) => sum + f.gzipBytes, 0);
  return {
    jsGzipBytes: total(jsFiles),
    cssGzipBytes: total(cssFiles),
    files: [...jsFiles, ...cssFiles],
  };
}

/**
 * @param {{ jsGzipBytes: number; cssGzipBytes: number }} measurement
 * @param {{ initialJsGzipKB: number; initialCssGzipKB: number }} budget
 * @returns {string[]} one message per budget that is broken
 */
export function check(measurement, budget) {
  const problems = [];
  if (measurement.jsGzipBytes > budget.initialJsGzipKB * 1024) {
    problems.push(
      `First-load JavaScript is ${kb(measurement.jsGzipBytes)} KB gzipped; the budget is ${budget.initialJsGzipKB} KB.`,
    );
  }
  if (measurement.cssGzipBytes > budget.initialCssGzipKB * 1024) {
    problems.push(
      `First-load CSS is ${kb(measurement.cssGzipBytes)} KB gzipped; the budget is ${budget.initialCssGzipKB} KB.`,
    );
  }
  return problems;
}

const kb = (/** @type {number} */ bytes) => (bytes / 1024).toFixed(1);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? 'dist';
  const budget = JSON.parse(readFileSync('config/budgets.json', 'utf8'));
  const measurement = measure(distDir);
  for (const { file, gzipBytes } of measurement.files) {
    console.log(`  ${file.padEnd(48)} ${kb(gzipBytes).padStart(7)} KB gzipped`);
  }
  console.log(
    `First load: JS ${kb(measurement.jsGzipBytes)} of ${budget.initialJsGzipKB} KB, CSS ${kb(measurement.cssGzipBytes)} of ${budget.initialCssGzipKB} KB`,
  );
  const problems = check(measurement, budget);
  for (const problem of problems) console.error(`Bundle budget broken: ${problem}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
