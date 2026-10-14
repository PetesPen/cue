// SP-6 spike: throwaway. Builds the real app twice with a service worker (versions "a" and "b") into
// spikes/sp-6/dist-a and dist-b, with icons made from the logo.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { build } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa-options.mjs';

const publicDir = 'spikes/sp-6/public';
const logo = (size, background) => `<!doctype html><body style="margin:0;background:${background}">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center">
<svg viewBox="0 0 22 22" width="${background === 'transparent' ? size : Math.round(size * 0.56)}" height="${background === 'transparent' ? size : Math.round(size * 0.56)}">
<rect width="22" height="22" rx="6" fill="#14281B"/><circle cx="14.5" cy="14.5" r="3.5" fill="#F5C542"/></svg></div></body>`;

async function makeIcons() {
  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(publicDir, { recursive: true });
  cpSync('public', publicDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, background] of [['icon-192.png', 192, 'transparent'], ['icon-512.png', 512, 'transparent'], ['icon-maskable-512.png', 512, '#14281B']]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(logo(size, background));
    await page.screenshot({ path: `${publicDir}/${name}`, omitBackground: background === 'transparent', clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
}

// A visible marker so a test can tell which build it is looking at.
const versionMarker = (version) => ({
  name: 'spike-version-marker',
  transformIndexHtml: (html) => html.replace('</head>', `<meta name="spike-version" content="${version}"></head>`),
});

await makeIcons();
for (const version of ['a', 'b']) {
  await build({
    configFile: 'vite.config.ts',
    logLevel: 'warn',
    publicDir,
    plugins: [versionMarker(version), VitePWA(pwaOptions)],
    build: { outDir: `spikes/sp-6/dist-${version}`, emptyOutDir: true },
  });
}
console.log('SP-6 builds ready: spikes/sp-6/dist-a and dist-b');
