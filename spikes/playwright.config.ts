import { defineConfig, devices } from '@playwright/test';

// Spike tests (throwaway). Run with: npx playwright test -c spikes/playwright.config.ts --project=<name>
// Projects ending in "-blocker" switch the browser's real popup blocker back on, which Playwright
// disables by default. "chrome" and "edge" drive the browsers installed on this PC.
const PORT = '4200';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const popupBlockerOn = { ignoreDefaultArgs: ['--disable-popup-blocking'] };

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: BASE_URL },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    {
      name: 'chromium-blocker',
      use: { ...devices['Desktop Chrome'], launchOptions: popupBlockerOn },
    },
    {
      name: 'chrome-blocker',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', launchOptions: popupBlockerOn },
    },
    {
      name: 'edge-blocker',
      use: { ...devices['Desktop Edge'], channel: 'msedge', launchOptions: popupBlockerOn },
    },
    {
      name: 'firefox-blocker',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'dom.disable_open_during_load': true } },
      },
    },
  ],
  webServer: {
    command: `node spikes/serve.mjs spikes/sp-1 ${PORT}`,
    cwd: '..',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
