import { defineConfig, devices } from '@playwright/test';

const PORT = '4173';
const BASE_URL = `http://127.0.0.1:${PORT}`;

// End-to-end tests run against the production build, on the three engines CLAUDE.md requires.
// Visual regression (Chromium only, pinned container) has its own config: playwright.visual.config.ts.
export default defineConfig({
  testDir: 'e2e',
  // Visual tests run in the pinned container with their own config (playwright.visual.config.ts).
  testIgnore: '**/visual/**',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Edge runs in the nightly job only (PW_EDGE=1), where Playwright installs it.
    ...(process.env.PW_EDGE
      ? [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }]
      : []),
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
