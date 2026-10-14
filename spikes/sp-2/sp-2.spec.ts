// SP-2 spike tests (throwaway). Measures whether rich text wraps and lays out identically in the
// TipTap editor and in static renderings, at different slide scales and screen pixel densities.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Line = { text: string; left: number; right: number; top: number; bottom: number };
type Measure = { key: string; lines: Line[]; width: number; height: number };
type Run = {
  variants: Record<string, Measure[]>;
  ms: number;
  fontsRequested: number;
  fontFacesLoaded: number;
  proseMirrorCss: string;
  dpr: number;
  docs: number;
};

const RESULTS_DIR = join(import.meta.dirname, 'results');
const DOCS = 16;

function record(info: TestInfo, key: string, value: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(join(RESULTS_DIR, `${info.project.name}.jsonl`), `${JSON.stringify({ key, value })}\n`);
}

async function runAll(page: Page, options: { scale: number; variants?: string[] }): Promise<Run> {
  return page.evaluate(
    async (o) => (window as unknown as { __sp2: { runAll: (o: unknown) => Promise<Run> } }).__sp2.runAll(o),
    { scale: options.scale, docCount: DOCS, variants: options.variants },
  );
}

/** How different two measurements of the same documents are. */
function compare(baseline: Measure[], other: Measure[]) {
  let docsWithDifferentWraps = 0;
  let docsOverOnePixel = 0;
  let maxPositionDelta = 0;
  let maxHeightDelta = 0;
  let linesCompared = 0;
  const examples: unknown[] = [];
  baseline.forEach((a, index) => {
    const b = other[index];
    if (!b) throw new Error('measurement lists differ in length');
    const sameText = a.lines.length === b.lines.length && a.lines.every((l, i) => l.text === b.lines[i]?.text);
    if (!sameText) {
      docsWithDifferentWraps += 1;
      if (examples.length < 2) {
        examples.push({ key: a.key, baselineLines: a.lines.length, otherLines: b.lines.length, baselineFirst: a.lines.slice(0, 3).map((l) => l.text), otherFirst: b.lines.slice(0, 3).map((l) => l.text) });
      }
      return;
    }
    linesCompared += a.lines.length;
    let over = false;
    a.lines.forEach((line, i) => {
      const o = b.lines[i]!;
      const delta = Math.max(Math.abs(line.left - o.left), Math.abs(line.right - o.right), Math.abs(line.top - o.top), Math.abs(line.bottom - o.bottom));
      maxPositionDelta = Math.max(maxPositionDelta, delta);
      if (delta > 1) over = true;
    });
    if (over) docsOverOnePixel += 1;
    maxHeightDelta = Math.max(maxHeightDelta, Math.abs(a.height - b.height));
  });
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    docs: baseline.length,
    linesCompared,
    docsWithDifferentWraps,
    docsOverOnePixel,
    maxPositionDeltaPx: round(maxPositionDelta),
    maxHeightDeltaPx: round(maxHeightDelta),
    examples,
  };
}

const hash = (m: Measure[]) => {
  const text = m.map((x) => `${x.key}|${x.lines.map((l) => l.text).join('/')}`).join('\n');
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
};

test.describe('SP-2 rich text fidelity', () => {
  test('static renderings against the editor: same wraps, same positions', async ({ page }, info) => {
    await page.goto('/index.html');
    const run = await runAll(page, { scale: 1 });
    const editor = run.variants['editor']!;
    const lines = editor.reduce((n, m) => n + m.lines.length, 0);
    record(info, 'setup', { documents: run.docs, widths: 4, editorMeasurements: editor.length, editorLines: lines, runMs: run.ms, fontFaceRequestsMade: run.fontsRequested, fontFacesLoaded: run.fontFacesLoaded, dpr: run.dpr });
    record(info, 'ProseMirror CSS that TipTap injects (first 600 chars)', run.proseMirrorCss.slice(0, 600));
    record(info, 'editor wrap fingerprint (compare across browsers)', hash(editor));

    const results: Record<string, ReturnType<typeof compare>> = {};
    for (const name of ['editorReadOnly', 'staticMatched', 'generateHtml', 'staticNaive']) {
      results[name] = compare(editor, run.variants[name]!);
      record(info, `vs editor: ${name}`, results[name]);
    }

    expect(lines).toBeGreaterThan(200);
    // generateHtml is recorded, not asserted: it omits ProseMirror's extra break after a final soft
    // return, so paragraphs that end that way are one line shorter. staticNaive is the "what goes
    // wrong without the CSS rules" case and is expected to differ.
    for (const name of ['editorReadOnly', 'staticMatched']) {
      expect(results[name]!.docsWithDifferentWraps, name).toBe(0);
      expect(results[name]!.maxPositionDeltaPx, name).toBeLessThanOrEqual(1);
      expect(results[name]!.maxHeightDeltaPx, name).toBeLessThanOrEqual(1);
    }
    expect(results['generateHtml']!.docsWithDifferentWraps).toBe(0);
    expect(results['staticNaive']!.docsWithDifferentWraps).toBeGreaterThan(0);
  });

  for (const scale of [0.5, 0.3]) {
    test(`scaling the slide to ${scale} does not change the wraps`, async ({ page }, info) => {
      await page.goto('/index.html');
      const variants = ['editor', 'staticMatched'];
      const full = await runAll(page, { scale: 1, variants });
      const scaled = await runAll(page, { scale, variants });
      for (const name of variants) {
        const result = compare(full.variants[name]!, scaled.variants[name]!);
        record(info, `scale ${scale} vs scale 1: ${name}`, result);
        expect(result.docsWithDifferentWraps, name).toBe(0);
      }
    });
  }

  for (const dpr of [1.25, 1.5, 2]) {
    test(`a screen at ${dpr}x pixel density wraps like a 1x screen`, async ({ browser }, info) => {
      const baseContext = await browser.newContext({ deviceScaleFactor: 1, baseURL: info.project.use.baseURL });
      const denseContext = await browser.newContext({ deviceScaleFactor: dpr, baseURL: info.project.use.baseURL });
      try {
        const [basePage, densePage] = [await baseContext.newPage(), await denseContext.newPage()];
        await Promise.all([basePage.goto('/index.html'), densePage.goto('/index.html')]);
        const variants = ['editor', 'staticMatched'];
        const base = await runAll(basePage, { scale: 1, variants });
        const dense = await runAll(densePage, { scale: 1, variants });
        for (const name of variants) {
          const result = compare(base.variants[name]!, dense.variants[name]!);
          record(info, `dpr ${dpr} vs dpr 1: ${name}`, { reportedDpr: dense.dpr, ...result });
          expect.soft(result.docsWithDifferentWraps, `${name} at ${dpr}x`).toBe(0);
        }
      } finally {
        await baseContext.close();
        await denseContext.close();
      }
    });
  }
});
