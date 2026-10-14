// SP-6 spike: throwaway. The app's config plus the PWA plugin, for the dev-server check:
// does the development server register a service worker? (It must not.)
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa-options.mjs';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react(), VitePWA(pwaOptions)],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
});
