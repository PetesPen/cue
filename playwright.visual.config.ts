import { defineConfig, devices } from '@playwright/test';

// Visual regression: Chromium only, inside the pinned container (config/visual.json). Baselines made
// anywhere else would differ in font rendering and break every other run, so this config refuses to
// start unless the container sets CUE_VISUAL_CONTAINER=1 (CI does; so does `npm run e2e:visual:docker`).
if (process.env.CUE_VISUAL_CONTAINER !== '1') {
  throw new Error(
    'Visual tests must run in the pinned container (see config/visual.json). ' +
      'Use CI, or `npm run e2e:visual:docker` where Docker is installed. ' +
      'Do not create or update baselines on a normal computer.',
  );
}

const PORT = '4174';
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e/visual',
  // One browser in one container, so baselines need no platform suffix.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 } },
  use: { baseURL: BASE_URL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  projects: [{ name: 'visual', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
