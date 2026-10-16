import { defineConfig, devices } from '@playwright/test';

const PORT = '4174';
const BASE_URL = `http://127.0.0.1:${PORT}`;

// The performance suite (UX-3, sprint 5): `npm run perf`. It runs against the production build, one
// test at a time (so tests do not take frames from each other), on the engines where a number means
// something: Chromium and Firefox are held to the budgets, WebKit is measured and reported (the
// runner draws in software, which SP-4 found WebKit does slowly). The numbers and the budgets are in
// `config/budgets.json`. Nothing here runs on pull requests: the nightly job runs it.
export default defineConfig({
  testDir: 'perf',
  testMatch: '**/*.perf.ts',
  fullyParallel: false,
  workers: 1,
  // A frame budget on a shared runner can be spoiled by a neighbour: it fails only if two runs in a row do.
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: BASE_URL, viewport: { width: 1440, height: 900 }, trace: 'off' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
