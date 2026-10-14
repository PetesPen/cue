// Module layering (CLAUDE.md, "Architecture rules"): dependencies point one way only.
// Each module lists the modules it may import. Any other import between modules is an error.
// `src/main.tsx` and `src/App.tsx` sit above the modules and may import all of them.
// Shared by eslint.config.js and tests/layering.test.ts, so the test checks the real rules.

export const ALLOWED = {
  model: [],
  render: ['model'],
  storage: ['model', 'render'],
  editor: ['model', 'render', 'storage'],
  present: ['model', 'render', 'storage'],
};

// `model` is pure TypeScript: no DOM, no React.
const DOM_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'requestAnimationFrame',
  'HTMLElement',
  'Element',
];

/** @type {import('eslint').Linter.Config[]} */
export const layering = Object.entries(ALLOWED).map(([name, allowed]) => {
  const forbidden = Object.keys(ALLOWED).filter((m) => m !== name && !allowed.includes(m));
  const why = (m) =>
    `'${name}' must not depend on '${m}'. It may use: ${allowed.join(', ') || 'nothing'}. See CLAUDE.md, architecture rules.`;
  const isModel = name === 'model';

  return {
    files: [`src/${name}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // Relative (../editor/...) and aliased (@/editor/...) imports of a forbidden module.
          patterns: forbidden.map((m) => ({
            regex: `^(@/|(\\.\\./)+(.*/)?)${m}(/|$)`,
            message: why(m),
          })),
          ...(isModel && {
            paths: ['react', 'react-dom', 'react-dom/client'].map((p) => ({
              name: p,
              message: "'model' is pure TypeScript with no DOM or React.",
            })),
          }),
        },
      ],
      // Dynamic import() is not covered by no-restricted-imports. This check is coarse on purpose:
      // it matches any specifier containing the module name.
      'no-restricted-syntax': [
        'error',
        ...forbidden.map((m) => ({
          selector: `ImportExpression[source.value=/${m}/]`,
          message: why(m),
        })),
      ],
      ...(isModel && {
        'no-restricted-globals': [
          'error',
          ...DOM_GLOBALS.map((g) => ({
            name: g,
            message: "'model' is pure TypeScript with no DOM.",
          })),
        ],
      }),
    },
  };
});
