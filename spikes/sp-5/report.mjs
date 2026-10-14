// Throwaway: prints what each browser recorded in spikes/sp-1/results/*.jsonl.
// Usage: node spikes/sp-1/report.mjs [project ...]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'results');
const wanted = process.argv.slice(2);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  const project = file.replace('.jsonl', '');
  if (wanted.length && !wanted.includes(project)) continue;
  const latest = new Map();
  for (const line of readFileSync(join(dir, file), 'utf8').split('\n').filter(Boolean)) {
    const { key, value } = JSON.parse(line);
    latest.set(key, value);
  }
  console.log(`\n=== ${project} ===`);
  for (const [key, value] of latest) console.log(`${key}: ${JSON.stringify(value)}`);
}
