import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { isRecord } from './support/guards';

const DIR = '.github/workflows';

const workflows = readdirSync(DIR)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => {
    const document: unknown = parse(readFileSync(join(DIR, file), 'utf8'));
    if (!isRecord(document)) throw new Error(`${file} is not a YAML mapping`);
    return { file, document };
  });

/** Every string value stored under `key` anywhere in the document. */
function valuesOf(node: unknown, key: string): string[] {
  if (Array.isArray(node)) return node.flatMap((item: unknown) => valuesOf(item, key));
  if (!isRecord(node)) return [];
  return Object.entries(node).flatMap(([name, value]) =>
    name === key && typeof value === 'string' ? [value] : valuesOf(value, key),
  );
}

function jobsOf(document: Record<string, unknown>): [string, Record<string, unknown>][] {
  const jobs = document.jobs;
  if (!isRecord(jobs)) throw new Error('A workflow has no jobs');
  return Object.entries(jobs).map(([name, job]) => {
    if (!isRecord(job)) throw new Error(`Job ${name} is not a mapping`);
    return [name, job];
  });
}

describe('Given the GitHub workflows (docs/development-plan.md, pipeline)', () => {
  test('When the folder is read, Then there is a CI workflow, a nightly workflow and the throwaway spikes workflow', () => {
    expect(workflows.map((w) => w.file).sort()).toEqual(['ci.yml', 'nightly.yml', 'spikes.yml']);
  });

  describe.each(workflows)('workflow $file', ({ document }) => {
    test('Then it only has read access to the repository', () => {
      expect(document.permissions).toEqual({ contents: 'read' });
    });

    test('Then it does not run untrusted pull request code with secrets (no pull_request_target)', () => {
      expect(JSON.stringify(document.on)).not.toContain('pull_request_target');
    });

    test('Then every action is pinned to a full commit hash', () => {
      const used = valuesOf(document, 'uses');
      expect(used.length).toBeGreaterThan(0);
      for (const action of used) expect(action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    });

    test('Then every job has a timeout of at most 15 minutes', () => {
      for (const [name, job] of jobsOf(document)) {
        const minutes = job['timeout-minutes'];
        expect(typeof minutes === 'number' && minutes <= 15, `job ${name}`).toBe(true);
      }
    });
  });

  test('When ci.yml is read, Then it runs on pull requests and on main', () => {
    const ci = workflows.find((w) => w.file === 'ci.yml');
    const triggers = ci?.document.on;
    expect(isRecord(triggers) && 'pull_request' in triggers && 'push' in triggers).toBe(true);
  });

  test('When ci.yml is read, Then the end-to-end job covers Chromium, Firefox and WebKit', () => {
    const ci = workflows.find((w) => w.file === 'ci.yml');
    const e2e = ci && jobsOf(ci.document).find(([name]) => name === 'e2e')?.[1];
    const strategy = e2e?.strategy;
    const matrix = isRecord(strategy) ? strategy.matrix : undefined;
    expect(isRecord(matrix) && matrix.browser).toEqual(['chromium', 'firefox', 'webkit']);
  });
});
