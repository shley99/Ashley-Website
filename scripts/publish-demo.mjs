import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { artifactFiles, artifactTopLevel, verifyBuild } from './verify-build.mjs';

const root = path.resolve(import.meta.dirname, '..');
const repository = 'Nicolassalazar-pro/ashley-naoko';
const remote = `https://github.com/${repository}.git`;
const publicURL = 'https://nicolassalazar-pro.github.io/ashley-naoko/';
const checkout = path.join(root, '.pages-publish');
const artifact = path.join(root, 'dist-demo');
const confirm = process.argv.includes('--confirm');
const trailer = 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>';
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
const run = (program, args, cwd = root, input) => execFileSync(program, args, { cwd, env, input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const git = (args, cwd = root) => run('git', args, cwd);
const networkGit = (args, cwd = root) => git(['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...args], cwd);
const api = (endpoint, method = 'GET', body) => JSON.parse(run('gh', ['api', '--method', method, endpoint, ...(body ? ['--input', '-'] : [])], root, body ? JSON.stringify(body) : undefined));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function currentPages() {
  try {
    return api(`repos/${repository}/pages`);
  } catch (error) {
    if (!String(error.stderr).includes('HTTP 404')) throw error;
    return null;
  }
}
function checkPages(pages) {
  if (!pages) return;
  if (pages.cname) throw new Error('A custom domain is configured. This publisher will not alter it or publish to it.');
  if (pages.source?.branch !== 'gh-pages' || pages.source?.path !== '/') throw new Error('Unexpected Pages source; it will not be changed automatically.');
  if (!pages.public) throw new Error('Pages is not public; source visibility will not be weakened as a fallback.');
}

const verified = await verifyBuild(artifact, { base: '/ashley-naoko/', preview: true });
const settings = api(`repos/${repository}`);
if (!settings.private || settings.full_name !== repository) throw new Error('Publishing requires the exact, private source repository. Its visibility will not be changed automatically.');
const repoRoot = git(['rev-parse', '--show-toplevel']);
if (path.resolve(repoRoot).toLowerCase() !== root.toLowerCase()) throw new Error('The source must be its own repository, not a parent project.');
if (git(['remote', 'get-url', 'origin']) !== remote) throw new Error('Unexpected source remote; refusing to publish.');
if (git(['status', '--porcelain'])) throw new Error('Commit the reviewed source changes before publishing.');
const sourceCommit = git(['rev-parse', 'HEAD']);
checkPages(currentPages());
if (!confirm) {
  console.log(`Dry run: verified ${verified.files} artifact files for ${publicURL}`);
  console.log('No files, branches, repository settings, or hosting settings changed. Add --confirm to publish this reviewed artifact.');
  process.exit(0);
}

console.log('Rebuilding the committed source and comparing it with the reviewed artifact.');
run(process.execPath, [path.join(root, 'run.mjs'), 'astro', 'build', '--mode', 'demo', '--site', 'https://nicolassalazar-pro.github.io', '--base', '/ashley-naoko/', '--outDir', 'dist-demo']);
const rebuilt = await verifyBuild(artifact, { base: '/ashley-naoko/', preview: true });
if (rebuilt.files !== verified.files || Object.entries(verified.hashes).some(([file, hash]) => rebuilt.hashes[file] !== hash)) {
  throw new Error('Rebuilding changed the artifact. Exercise the new build before publishing it; nothing was pushed.');
}
if (git(['rev-parse', 'HEAD']) !== sourceCommit || git(['status', '--porcelain'])) throw new Error('Source changed during the release preflight.');

let existing = false;
try {
  const info = await lstat(checkout);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('The publishing checkout must be an ordinary managed directory.');
  existing = true;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const markerPath = path.join(checkout, '.git', 'ashley-publish-owner.json');
if (existing) {
  const marker = JSON.parse(await readFile(markerPath, 'utf8'));
  if (marker.repository !== repository || marker.sourceRoot !== root) throw new Error('The existing directory is not this project\'s managed publishing checkout.');
  if (path.resolve(git(['rev-parse', '--show-toplevel'], checkout)).toLowerCase() !== checkout.toLowerCase()) throw new Error('Publishing checkout root mismatch.');
  if (git(['remote', 'get-url', 'origin'], checkout) !== remote) throw new Error('Publishing remote mismatch.');
  if (git(['status', '--porcelain'], checkout)) throw new Error('The publishing checkout contains uncommitted changes. Inspect it instead of overwriting them.');
} else {
  await mkdir(checkout);
  git(['init', '--initial-branch=gh-pages'], checkout);
  git(['remote', 'add', 'origin', remote], checkout);
  git(['config', 'user.name', git(['config', 'user.name'])], checkout);
  git(['config', 'user.email', git(['config', 'user.email'])], checkout);
  git(['config', 'core.autocrlf', 'false'], checkout);
  await writeFile(markerPath, JSON.stringify({ repository, sourceRoot: root }, null, 2) + '\n');
}

const branchProbe = spawnSync('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'ls-remote', '--exit-code', '--heads', 'origin', 'gh-pages'], { cwd: checkout, env, encoding: 'utf8', windowsHide: true });
if (branchProbe.error) throw branchProbe.error;
if (branchProbe.status === 0) {
  networkGit(['fetch', 'origin', 'gh-pages'], checkout);
  const localHead = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: checkout, encoding: 'utf8', windowsHide: true });
  if (localHead.status === 0) git(['merge', '--ff-only', 'FETCH_HEAD'], checkout);
  else git(['switch', '-c', 'published-artifact', '--track', 'origin/gh-pages'], checkout);
} else if (branchProbe.status !== 2) {
  throw new Error(`Could not inspect the publishing branch: ${branchProbe.stderr}`);
}

for (const entry of await readdir(checkout, { withFileTypes: true })) {
  if (entry.name === '.git') continue;
  if (!artifactTopLevel.has(entry.name) || entry.isSymbolicLink()) throw new Error(`Unexpected publishing file; refusing to remove it: ${entry.name}`);
  const target = path.join(checkout, entry.name);
  if (entry.isDirectory()) {
    for (const file of await artifactFiles(target)) await unlink(path.join(target, file));
  } else await unlink(target);
}
for (const file of await artifactFiles(artifact)) {
  const destination = path.join(checkout, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(artifact, file), destination);
}
await verifyBuild(checkout, { base: '/ashley-naoko/', preview: true, allowGit: true });
for (const [file, hash] of Object.entries(verified.hashes)) {
  if (sha(await readFile(path.join(checkout, file))) !== hash) throw new Error(`Publishing copy drifted: ${file}`);
}
git(['add', '--all'], checkout);
if (git(['status', '--porcelain'], checkout)) {
  git(['commit', '-m', `Publish portfolio preview\n\nSource: ${sourceCommit}\n\n${trailer}`], checkout);
}
const pagesCommit = git(['rev-parse', 'HEAD'], checkout);
if (git(['rev-parse', 'HEAD']) !== sourceCommit || git(['status', '--porcelain'])) throw new Error('Source changed during publication preparation; nothing was pushed.');
checkPages(currentPages());
networkGit(['push', 'origin', 'HEAD:refs/heads/gh-pages'], checkout);

let pages = currentPages();
if (!pages) {
  try {
    pages = api(`repos/${repository}/pages`, 'POST', { build_type: 'legacy', source: { branch: 'gh-pages', path: '/' }, public: true });
  } catch (error) {
    if (!String(error.stderr).includes('HTTP 409')) throw error;
    console.warn('Pages was enabled during publication. Reading its settings without repeating the creation request.');
    for (let attempt = 0; attempt < 5 && !pages; attempt++) {
      pages = currentPages();
      if (!pages) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!pages) throw new Error('Pages creation conflicted, but its settings are not visible yet. Inspect deployment status before publishing again.', { cause: error });
  }
}
checkPages(pages);

let live = false;
for (let attempt = 0; attempt < 40; attempt++) {
  pages = api(`repos/${repository}/pages`);
  checkPages(pages);
  if (pages.status === 'errored') throw new Error('GitHub Pages reported a build error. Inspect its build log; no automatic submission retry was made.');
  if (pages.status === 'built') {
    const response = await fetch(publicURL, { cache: 'no-store', redirect: 'error' });
    if (response.ok && sha(Buffer.from(await response.arrayBuffer())) === verified.hashes['index.html']) {
      live = true;
      break;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 15000));
}
if (!live) throw new Error('The branch was pushed, but the exact artifact is not confirmed public yet. Inspect deployment status before rerunning any publish.');
if (!api(`repos/${repository}`).private) throw new Error('Source repository privacy did not persist.');
await mkdir(path.join(root, 'test-results'), { recursive: true });
await writeFile(path.join(root, 'test-results', 'publication.json'), JSON.stringify({ repository, private: true, publicURL, sourceCommit, pagesCommit, verifiedAt: new Date().toISOString(), fileHashes: verified.hashes }, null, 2) + '\n');
console.log(`Published ${publicURL}`);
console.log(`Private source: https://github.com/${repository}`);
console.log('The existing website, domain, DNS, email, and Canva hosting were not changed.');
