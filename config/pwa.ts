import type { VitePWAOptions } from 'vite-plugin-pwa';

// The installable, offline app (UX-7), as spike SP-6 built and measured it (docs/spikes/SP-6.md).
// A new version waits until the person chooses to update: it never replaces the app while a deck is being
// edited, and it never touches the stored decks. The service worker is registered by the app itself, in
// production builds only (src/main.tsx), so the development server can never serve stale files.

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    id: '/',
    name: 'Cue',
    short_name: 'Cue',
    description: 'Build and present slide decks in your browser. Nothing is uploaded.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // The app background and the dark forest of the style guide (design/tokens.css).
    background_color: '#F4F8F1',
    theme_color: '#14281B',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Everything the app needs, the fonts and their licences included, so the editor, the show and the
    // deck file all work with no network.
    globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest,txt}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  },
  // Development never registers a service worker.
  devOptions: { enabled: false },
};
