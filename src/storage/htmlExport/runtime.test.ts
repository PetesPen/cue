import { runtimeScript, runtimeStyle } from 'virtual:cue-export-runtime';
import { describe, expect, test } from 'vitest';
import budgets from '../../../config/budgets.json' with { type: 'json' };

// SV-4: the page's program is small, runs by itself and talks to nothing. It is built from the shared
// renderer (`model` and `render`), so what is in the built text is what the exported page will run.

describe('the program of the exported page (SV-4)', () => {
  test('Given the built program, Then it is there, with a style sheet', () => {
    expect(runtimeScript.length).toBeGreaterThan(1000);
    expect(runtimeStyle).toContain('.cue-slide');
    expect(runtimeStyle).toContain('.cp-bar');
  });

  test.each(['</script', '<!--', '\r'])(
    'Given the text of the program, Then it holds nothing that would end its block (%j)',
    (text) => {
      expect(runtimeScript.toLowerCase()).not.toContain(text);
    },
  );

  test.each([
    'indexedDB',
    'localStorage',
    'sessionStorage',
    'XMLHttpRequest',
    'fetch(',
    'WebSocket',
    'EventSource',
    'sendBeacon',
    'importScripts',
    'serviceWorker',
    'BroadcastChannel',
    'eval(',
    'new Function',
  ])('Given the program, Then it never uses %s', (name) => {
    expect(runtimeScript).not.toContain(name);
  });

  test.each(['react', 'tiptap', 'prosemirror', 'dexie', 'fflate', 'CommandError', 'enablePatches'])(
    'Given the program, Then none of %s is in it',
    (library) => {
      expect(runtimeScript.toLowerCase()).not.toContain(library);
    },
  );

  test('Given the budget, Then the program (minified, not gzipped) is inside it', () => {
    expect(runtimeScript.length / 1024).toBeLessThan(budgets.export.runtimeKB);
  });

  test('Given the program, Then its size is reported', () => {
    console.info(
      `[export] page program ${String(Math.round(runtimeScript.length / 1024))} KB, style sheet ${String(Math.round(runtimeStyle.length / 1024))} KB`,
    );
  });
});
