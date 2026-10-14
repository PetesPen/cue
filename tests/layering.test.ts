import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';
import { layering } from '../config/layering.js';

// The same rule objects that eslint.config.js uses, so this checks the real rules.
// The first block makes ESLint accept any file under src/, including those above the modules.
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [{ files: ['src/**/*.{ts,tsx}'] }, ...layering],
});

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `parse error: ${m.message}`);
}

const forbiddenImports: [from: string, specifier: string][] = [
  ['model', '../editor'],
  ['model', '../../present/x'],
  ['model', '@/render'],
  ['model', '@/storage/thing'],
  ['render', '../editor/index'],
  ['render', '@/storage'],
  ['render', '@/present'],
  ['storage', '../present'],
  ['storage', '@/editor/panels/x'],
  ['editor', '../present/index'],
  ['editor', '@/present'],
  ['present', '@/editor'],
  ['present', '../editor/x'],
];

const allowedImports: [from: string, specifier: string][] = [
  ['render', '@/model'],
  ['render', '../model/deck'],
  ['storage', '@/model'],
  ['storage', '@/render'],
  ['editor', '@/model'],
  ['editor', '@/render'],
  ['editor', '@/storage'],
  ['present', '@/model'],
  ['present', '@/render'],
  ['present', '@/storage'],
  ['model', './helpers'],
  ['editor', './panels/Inspector'],
  ['editor', 'react'],
  ['render', 'vitest'],
];

describe('Given the module layering rule (CLAUDE.md, architecture rules)', () => {
  test.each(forbiddenImports)("When '%s' imports '%s', Then it is reported", async (from, spec) => {
    expect(await ruleIds(`src/${from}/probe.ts`, `import '${spec}';`)).toEqual([
      'no-restricted-imports',
    ]);
  });

  test.each(allowedImports)("When '%s' imports '%s', Then it is allowed", async (from, spec) => {
    expect(await ruleIds(`src/${from}/probe.ts`, `import '${spec}';`)).toEqual([]);
  });

  test("When 'model' re-exports from 'editor', Then it is reported", async () => {
    expect(await ruleIds('src/model/probe.ts', "export * from '../editor';")).toEqual([
      'no-restricted-imports',
    ]);
  });

  test("When 'model' loads 'present' with a dynamic import, Then it is reported", async () => {
    expect(await ruleIds('src/model/probe.ts', "void import('../present');")).toEqual([
      'no-restricted-syntax',
    ]);
  });

  test("When 'model' loads a sibling file with a dynamic import, Then it is allowed", async () => {
    expect(await ruleIds('src/model/probe.ts', "void import('./migrations');")).toEqual([]);
  });

  test("When 'model' imports React, Then it is reported", async () => {
    expect(await ruleIds('src/model/probe.ts', "import 'react';")).toEqual([
      'no-restricted-imports',
    ]);
  });

  test("When 'model' reads a DOM global, Then it is reported", async () => {
    expect(await ruleIds('src/model/probe.ts', 'export const w = window;')).toEqual([
      'no-restricted-globals',
    ]);
  });

  test("When 'editor' reads a DOM global, Then it is allowed", async () => {
    expect(await ruleIds('src/editor/probe.ts', 'export const w = window;')).toEqual([]);
  });

  test.each(['src/main.tsx', 'src/App.tsx'])(
    'When %s, which sits above the modules, imports every module, Then it is allowed',
    async (file) => {
      const code = ['model', 'render', 'storage', 'editor', 'present']
        .map((m) => `import '@/${m}';`)
        .join('\n');
      expect(await ruleIds(file, code)).toEqual([]);
    },
  );
});
