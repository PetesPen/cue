import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'vite';

// The program of the exported web page (SV-4) is built apart from the app, as one script and one style sheet
// that the exporter writes into each file as text. This plugin does that build, from the app's own build,
// the dev server and the tests alike, and hands the result to the exporter as `virtual:cue-export-runtime`.
// The program imports only `model` and `render` (an ESLint rule and a test say so), so it is small.

const ID = 'virtual:cue-export-runtime';
const RESOLVED = `\0${ID}`;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTRY = fileURLToPath(new URL('../src/storage/htmlExport/runtime/main.ts', import.meta.url));

interface Built {
  readonly script: string;
  readonly style: string;
}

async function buildRuntime(): Promise<Built> {
  const result = await build({
    root: ROOT,
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    // A library build leaves this for the page to fill in, and a page has no `process`.
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: true,
      target: 'es2022',
      cssCodeSplit: false,
      lib: { entry: ENTRY, formats: ['iife'], name: 'CueShow', fileName: 'runtime' },
      // Only what the page uses goes in: the deck's commands and history (and the library they use) set
      // themselves up when they are loaded, which would keep them in even though nothing calls them.
      // Style sheets are the one thing that is loaded for its own sake.
      rollupOptions: { treeshake: { moduleSideEffects: (id: string) => id.endsWith('.css') } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((one) =>
    'output' in one ? one.output : [],
  );
  let script = '';
  let style = '';
  for (const output of outputs) {
    if (output.type === 'chunk') script += output.code;
    else if (output.fileName.endsWith('.css') && typeof output.source === 'string') {
      style += output.source;
    }
  }
  if (script === '') throw new Error('The web page program was not built.');
  return { script, style };
}

export function exportRuntime(): Plugin {
  let built: Promise<Built> | undefined;
  return {
    name: 'cue-export-runtime',
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    async load(id) {
      if (id !== RESOLVED) return undefined;
      built ??= buildRuntime();
      const { script, style } = await built;
      return `export const runtimeScript = ${JSON.stringify(script)};\nexport const runtimeStyle = ${JSON.stringify(style)};\n`;
    },
    // The program is built again when a file it is made of changes (the dev server and the watch mode).
    handleHotUpdate({ file, server }) {
      if (!/[\\/]src[\\/](model|render|storage[\\/]htmlExport)[\\/]/.test(file)) return;
      built = undefined;
      const module = server.moduleGraph.getModuleById(RESOLVED);
      if (module) server.moduleGraph.invalidateModule(module);
    },
  };
}
