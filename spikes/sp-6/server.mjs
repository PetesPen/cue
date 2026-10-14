// SP-6 spike: throwaway. Serves build "a" or "b" with the app's real security headers, and lets a test
// switch which build is live (so one page can see "a" first and "b" after an update).
// Usage: node spikes/sp-6/server.mjs <port>   (needs Node 24, which runs the TypeScript headers file)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { securityHeaders } from '../../config/headers.ts';

const port = Number(process.argv[2] ?? '4200');
let live = 'a';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};
// Files that must never be cached by the browser's HTTP cache, or an update would not be seen.
const alwaysRevalidate = new Set(['/sw.js', '/registerSW.js', '/manifest.webmanifest', '/index.html', '/']);

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://x');
  if (url.pathname === '/__switch') {
    live = url.searchParams.get('to') === 'b' ? 'b' : 'a';
    response.writeHead(200, { 'Cache-Control': 'no-store' }).end(live);
    return;
  }
  const root = resolve(`spikes/sp-6/dist-${live}`);
  const path = decodeURIComponent(url.pathname);
  const file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { ...securityHeaders }).end('Not found');
    return;
  }
  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': alwaysRevalidate.has(path) ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`SP-6 server on http://127.0.0.1:${port}/ (live build: ${live})`));
