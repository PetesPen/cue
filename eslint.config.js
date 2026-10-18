import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { layering } from './config/layering.js';

export default defineConfig(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      'spikes',
      'design',
      'docs',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // "No any, no unchecked casts at module boundaries" (CLAUDE.md).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Tests run in Node and in browsers.
    files: ['tests/**/*.ts', 'e2e/**/*.ts', 'perf/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  ...layering,
  {
    // The exported web page's program (SV-4) runs in a page of its own, so it may use `model`, `render`
    // and its own folder, and nothing else: no React, no storage, no library. A test of the built program
    // checks the same from the other side.
    files: ['src/storage/htmlExport/runtime/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`^(?!(@/model|@/render|\./|\.\./layout$))`,
              message:
                "The exported page's program may import only 'model', 'render', its own files and ../layout.",
            },
          ],
        },
      ],
    },
  },
);
