import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { verifyBuild } from './verify-build.mjs';

const root = path.resolve(import.meta.dirname, '..');
const repository = process.env.PAGES_REPOSITORY ?? 'shley99/Ashley-Website';
const output = path.join(root, 'test-results', 'live');
const artifact = path.join(root, 'dist-live');
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, ...options });
const api = (endpoint) => JSON.parse(run(process.env.GH_PATH ?? 'gh', ['api', endpoint]));

const repo = api(`repos/${repository}`);
const pages = api(`repos/${repository}/pages`);
assert.equal(repo.private, false, 'GitHub Pages on a free plan needs a public repository.');
assert.equal(pages.build_type, 'workflow', 'Pages must publish from the GitHub Actions workflow.');
const url = new URL(pages.html_url.endsWith('/') ? pages.html_url : `${pages.html_url}/`);
assert.equal(url.protocol, 'https:', 'Turn on Enforce HTTPS in Settings > Pages once the certificate is ready.');
const base = url.pathname;

// Byte comparison only means something when the local source is exactly the deployed commit.
assert.equal(run('git', ['status', '--porcelain']).trim(), '', 'Commit local changes before verifying the live site.');
const commit = run('git', ['rev-parse', 'HEAD']).trim();
const [deployment] = api(`repos/${repository}/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=1`).workflow_runs;
assert.equal(deployment?.head_sha, commit, 'The latest successful deployment is not this commit. Push it, or wait for the workflow to finish.');

// Rebuild exactly as the workflow does, then require every public file to match it.
run(process.execPath, [path.join(root, 'run.mjs'), 'astro', 'build', '--site', url.origin, '--base', base, '--outDir', artifact], { stdio: 'inherit' });
const expected = await verifyBuild(artifact, { base, preview: false });
const files = Object.entries(expected.hashes).filter(([file]) => file !== '.nojekyll');
const verified = [];
const abort = new AbortController();
let nextFile = 0;
async function worker() {
  while (nextFile < files.length) {
    const [file, expectedHash] = files[nextFile++];
    const route = file.replace(/index\.html$/, '').split('/').map(encodeURIComponent).join('/');
    const response = await fetch(new URL(route, url), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: abort.signal });
    assert.equal(response.status, 200, `Public file unavailable: ${file}`);
    assert.ok(response.body, `Missing response body: ${file}`);
    const digest = createHash('sha256');
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      digest.update(chunk);
    }
    assert.equal(digest.digest('hex'), expectedHash, `Published bytes differ from commit ${commit.slice(0, 7)}: ${file}`);
    verified.push({ file, bytes, sha256: expectedHash });
  }
}
try {
  await Promise.all(Array.from({ length: 4 }, () => worker()));
} catch (error) {
  abort.abort();
  throw error;
}

await mkdir(output, { recursive: true });
const executablePath = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
const browser = await chromium.launch({ executablePath, headless: true });
const runtimeErrors = [];
let displayFonts = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const portfolioHeading = page.getByRole('heading', { level: 1, name: 'CREATIVE PORTFOLIO', exact: true });
  assert.equal(await portfolioHeading.count(), 1);
  assert.equal(await portfolioHeading.isVisible(), true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const document = await cdp.send('DOM.getDocument');
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
    nodeId: document.root.nodeId,
    selector: 'h1 .canva-text-content--desktop .canva-type-character',
  });
  const renderedFonts = await Promise.all(nodeIds.map((nodeId) => cdp.send('CSS.getPlatformFontsForNode', { nodeId })));
  displayFonts = renderedFonts.flatMap((result) => result.fonts);
  assert.ok(displayFonts.length > 0 && displayFonts.every((font) => font.isCustomFont && /Partita/i.test(font.familyName)), 'The public retro heading must render Partita 1990, not a fallback.');
  await cdp.detach();
  assert.equal(await page.locator('[data-canva-page]').count(), 5);
  assert.equal(await page.locator('[data-canva-node-id]').count(), 162);
  assert.equal(await page.locator('video').count(), 8);
  assert.equal(await page.locator('[data-source-video-mode="poster"]').count(), 3);
  assert.equal(await page.locator('[data-source-video-mode="ambient"]').count(), 5);
  assert.equal(await page.locator('meta[name="robots"]').count(), 0, 'The live site must stay indexable.');

  const header = page.getByRole('banner');
  assert.deepEqual(await header.evaluate((element) => [getComputedStyle(element).position, getComputedStyle(element).backgroundColor]), ['sticky', 'rgb(114, 74, 171)']);
  const nav = page.getByRole('navigation', { name: 'Main' });
  assert.deepEqual(await nav.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['about', 'digital', 'physical', 'contact'].map((id) => `${base}#${id}`));
  assert.ok(await page.evaluate(() => [...document.fonts].some((font) => font.family.replaceAll('"', '') === 'AshPixel' && font.status === 'loaded')), 'The header pixel font must load.');
  assert.match(await page.getByRole('contentinfo').innerText(), /made with love/);

  await page.mouse.move(700, 520);
  await page.mouse.move(720, 540);
  await page.waitForFunction(() => document.documentElement.classList.contains('an-js-paw')
    && getComputedStyle(document.querySelector('#an-paw-cursor')).opacity === '1');
  await page.mouse.wheel(0, 500);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#an-scratch-layer');
    const context = canvas instanceof HTMLCanvasElement && canvas.width ? canvas.getContext('2d') : null;
    if (!context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 3; index < data.length; index += 4) if (data[index]) return true;
    return false;
  });
  await page.screenshot({ path: path.join(output, 'desktop-paw-rips.png') });
  await nav.getByRole('link', { name: 'Physical', exact: true }).click();
  await page.waitForFunction(() => {
    const bar = document.querySelector('.an-topbar')?.getBoundingClientRect().bottom ?? 0;
    const top = document.querySelector('#physical')?.getBoundingClientRect().top ?? Infinity;
    return location.hash === '#physical' && (Math.abs(top - bar) <= 1 || Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 1);
  });

  const poster = page.locator('[data-video="japan-march"]');
  const video = poster.locator('video');
  await poster.scrollIntoViewIfNeeded();
  await poster.getByRole('button', { name: 'Play March - Life in Japan' }).click();
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-video="japan-march"] video');
    return element instanceof HTMLVideoElement && element.currentTime > .1;
  });
  await video.evaluate((element) => {
    if (!(element instanceof HTMLVideoElement)) throw new Error('Expected the native video player.');
    element.pause();
  });
  const inlineReader = page.locator('[data-newsletter-reader]');
  await inlineReader.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const motion = document.querySelector('[data-newsletter-motion]');
    return motion instanceof HTMLElement && !motion.hidden && motion.dataset.newsletterMotionPage === '1';
  });
  assert.equal(await inlineReader.locator('[data-newsletter-decoration]').count(), 2);
  const pageNext = inlineReader.getByRole('button', { name: 'Next page', exact: true });
  assert.ok((await pageNext.evaluate((element) => getComputedStyle(element).cursor)).includes('e-resize'));
  await pageNext.click();
  await page.waitForFunction(() => document.querySelector('[data-newsletter-counter]')?.textContent?.trim() === '2 / 15');
  await page.waitForFunction(() => document.querySelector('[data-newsletter-motion]')?.getAttribute('data-newsletter-motion-page') === '2');
  const decorationRoles = await inlineReader.locator('[data-newsletter-decoration]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-newsletter-decoration')).sort());
  assert.deepEqual(decorationRoles, ['luna-moth', 'star-moth']);
  await inlineReader.locator('summary[aria-label="More newsletter options"]').click();
  await inlineReader.getByRole('link', { name: 'Open standalone reader', exact: true }).click();
  assert.equal(await page.locator('.reader-count').innerText(), 'Page 2 of 15');
  assert.equal(await page.getByRole('banner').count(), 1);
  await page.goto(new URL('newsletter/', url).href);
  await page.getByRole('link', { name: 'Next page, 2', exact: true }).click();
  assert.equal(await page.locator('.reader-count').innerText(), 'Page 2 of 15');
  await page.goto(new URL('newsletter/13/', url).href);
  assert.equal(await page.locator('.reader-notice').isVisible(), true);
  await page.screenshot({ path: path.join(output, 'newsletter-preview-quality.png') });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download PDF' }).click()]);
  const downloadPath = path.join(output, 'newsletter.pdf');
  await download.saveAs(downloadPath);
  assert.equal(createHash('sha256').update(await readFile(downloadPath)).digest('hex'), expected.hashes['documents/ashley-naoko-newsletter.pdf']);
  const missing = await page.goto(new URL('this-page-does-not-exist/', url).href);
  assert.equal(missing?.status(), 404);
  assert.equal(await page.getByRole('banner').count(), 1, 'The 404 page keeps the header for recovery.');
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  mobile.on('pageerror', (error) => runtimeErrors.push(error.message));
  await mobile.goto(url.href, { waitUntil: 'networkidle' });
  await mobile.evaluate(() => document.fonts.ready);
  assert.equal(await mobile.getByRole('banner').isVisible(), true);
  assert.equal(await mobile.locator('#an-paw-cursor').count(), 0, 'Touch screens keep their own pointer.');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: path.join(output, 'mobile-home.png') });
  await mobile.locator('[data-canva-page]').last().scrollIntoViewIfNeeded();
  assert.equal(await mobile.locator('main a[href="mailto:ashfagan99@gmail.com"]').isVisible(), true);
  await mobile.screenshot({ path: path.join(output, 'mobile-contact.png') });
  await mobile.close();
  assert.deepEqual(runtimeErrors, []);
} finally {
  await browser.close();
}
await writeFile(path.join(output, 'verification.json'), JSON.stringify({
  url: url.href, repository, commit, deploymentRun: deployment.html_url, verifiedAt: new Date().toISOString(),
  browser: 'Isolated headless browser, anonymous desktop and touch contexts', files: verified.sort((a, b) => a.file.localeCompare(b.file)),
  displayFont: { family: 'Partita 1990 Regular', sha256: expected.hashes['fonts/partita-1990.woff2'], renderedFonts: displayFonts },
  interactions: ['Partita 1990 rendered glyphs', 'Purple header, pixel font, and footer', 'Pixel paw cursor and scroll rips', 'Header anchor lands below the header', 'Real custom-control video playback', 'Page-specific newsletter animation layers', 'Directional page cursor and page-area navigation', 'Inline and standalone document next page', 'Preview-quality notice', 'Actual PDF download', '404 recovery', 'Touch layout and contact navigation'],
}, null, 2) + '\n');
console.log(`Live site verified at ${url.href}: ${verified.length} public files match commit ${commit.slice(0, 7)}, plus real desktop and touch flows.`);
