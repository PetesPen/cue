// Runs the visual tests inside the pinned container (config/visual.json). Needs Docker.
// Usage: node scripts/visual-docker.mjs [extra playwright arguments, for example --update-snapshots]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { image, tag, digest } = JSON.parse(readFileSync('config/visual.json', 'utf8'));
const reference = `${image}:${tag}@${digest}`;

const args = [
  'run',
  '--rm',
  '--ipc=host',
  '-e',
  'CUE_VISUAL_CONTAINER=1',
  '-v',
  `${process.cwd()}:/work`,
  '-w',
  '/work',
  reference,
  'sh',
  '-c',
  `npm ci && npx playwright test -c playwright.visual.config.ts ${process.argv.slice(2).join(' ')}`,
];

console.log(`Running in ${reference}`);
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error) {
  console.error(
    'Could not start Docker. Install Docker Desktop, or use the CI visual job instead.',
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
