import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Three projects, one per test level in docs/development-plan.md:
//   unit         src/**/*.test.ts and tests/**/*.test.ts, in Node
//   integration  *.integration.test.ts, in Node with fake-indexeddb
//   component    src/**/*.component.test.tsx, in a real Chromium (Vitest browser mode)
// End-to-end tests live in e2e/ and run through Playwright (playwright.config.ts).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['{src,tests}/**/*.test.ts'],
            exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'integration',
            environment: 'node',
            include: ['{src,tests}/**/*.integration.test.ts'],
            setupFiles: ['fake-indexeddb/auto'],
          },
        },
        {
          extends: true,
          test: {
            name: 'component',
            include: ['src/**/*.component.test.tsx'],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: 'chromium' }],
            },
          },
        },
      ],
      coverage: {
        provider: 'v8',
        // At least 90% on model and render; there is no overall target (CLAUDE.md).
        include: ['src/model/**', 'src/render/**'],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  }),
);
