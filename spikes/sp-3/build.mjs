// Throwaway: builds the SP-3 page into spikes/sp-3/dist.
import { build } from 'vite';

await build({
  root: 'spikes/sp-3',
  base: './',
  logLevel: 'warn',
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
});
console.log('SP-3 page built in spikes/sp-3/dist');
