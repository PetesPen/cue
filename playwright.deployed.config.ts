import { defineConfig, devices } from '@playwright/test';

// The same end-to-end tests, run against a deployed address instead of a local build: the live site
// or a Netlify deploy preview. Proves the host serves the app and the headers in netlify.toml.
// Usage: E2E_BASE_URL=https://cue-presentations.netlify.app npm run e2e:deployed
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error(
    'Set E2E_BASE_URL to the address to test, for example https://cue-presentations.netlify.app',
  );
}

export default defineConfig({
  testDir: 'e2e',
  // Visual tests need the pinned container; see playwright.visual.config.ts.
  testIgnore: '**/visual/**',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
