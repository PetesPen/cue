import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { securityHeaders } from './config/headers.ts';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `vite preview` serves the production build with the deployed headers, so tests see the same policy.
  preview: { headers: securityHeaders },
});
