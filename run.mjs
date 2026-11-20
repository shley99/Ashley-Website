import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [tool, ...args] = process.argv.slice(2);
const entrypoints = {
  astro: ['node_modules', 'astro', 'bin', 'astro.mjs'],
  playwright: ['node_modules', '@playwright', 'test', 'cli.js'],
};
if (!Object.hasOwn(entrypoints, tool)) throw new Error(`Unsupported project tool: ${tool}`);

// Windows npm shims split the ampersand in the parent folder; invoke Node directly.
const result = spawnSync(process.execPath, [path.join(import.meta.dirname, ...entrypoints[tool]), ...args], {
  stdio: 'inherit',
  shell: false,
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`${tool} terminated with ${result.signal}`);
process.exitCode = result.status ?? 1;
npm run verify:live
