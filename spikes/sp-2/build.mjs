// Throwaway: builds the SP-2 page (TipTap and the real fonts bundled) into spikes/sp-2/dist.
import { build } from 'vite';

await build({
  root: 'spikes/sp-2',
  base: './',
  logLevel: 'warn',
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
});
console.log('SP-2 page built in spikes/sp-2/dist');
