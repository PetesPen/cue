import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { securityHeaders } from './config/headers.ts';

export default defineConfig({
  plugins: [react()],
  // The text editor loads on first use; bundling it up front keeps the dev server from reloading the
  // page when it is first found.
  optimizeDeps: {
    include: ['@tiptap/core', '@tiptap/starter-kit', '@tiptap/pm/state', '@tiptap/pm/model'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `vite preview` serves the production build with the deployed headers, so tests see the same policy.
  preview: { headers: securityHeaders },
});
