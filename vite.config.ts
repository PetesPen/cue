import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { securityHeaders } from './config/headers.ts';
import { pwaOptions } from './config/pwa.ts';

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  // The text editor loads on first use; bundling it up front keeps the dev server from reloading the
  // page when it is first found.
  optimizeDeps: {
    include: [
      '@tiptap/core',
      '@tiptap/starter-kit',
      '@tiptap/pm/state',
      '@tiptap/pm/model',
      '@tiptap/pm/view',
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `vite preview` serves the production build with the deployed headers, so tests see the same policy.
  preview: { headers: securityHeaders },
});
