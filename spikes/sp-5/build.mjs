// Throwaway: builds the SP-5 page into spikes/sp-5/dist.
import { build } from 'vite';

await build({
  root: 'spikes/sp-5',
  base: './',
  logLevel: 'warn',
  build: { outDir: 'dist', emptyOutDir: true },
});
console.log('SP-5 page built in spikes/sp-5/dist');
