// SP-6 spike: throwaway. The PWA settings under test, shared by the build and the dev-server check.
export const manifest = {
  name: 'Cue',
  short_name: 'Cue',
  description: 'Build and present slide decks in your browser. Nothing is uploaded.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#F4F8F1',
  theme_color: '#14281B',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

export const pwaOptions = {
  // "prompt": a new version waits until the user chooses to update; it never replaces the app mid-edit.
  registerType: 'prompt',
  injectRegister: 'script',
  manifest,
  workbox: {
    // Everything the app needs, including all bundled fonts, so the editor works with no network.
    globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  },
  // Development never registers a service worker, so it can never serve stale files.
  devOptions: { enabled: false },
};
