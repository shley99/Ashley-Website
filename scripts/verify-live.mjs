import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { verifyBuild } from './verify-build.mjs';

const root = path.resolve(import.meta.dirname, '..');
const repository = 'Nicolassalazar-pro/ashley-naoko';
const url = 'https://nicolassalazar-pro.github.io/ashley-naoko/';
const output = path.join(root, 'test-results', 'live');
const api = (endpoint) => JSON.parse(execFileSync('gh', ['api', endpoint], { cwd: root, encoding: 'utf8', windowsHide: true }));
const expected = await verifyBuild(path.join(root, 'dist-demo'), { base: '/ashley-naoko/', preview: true });
const repo = api(`repos/${repository}`);
const pages = api(`repos/${repository}/pages`);
assert.equal(repo.private, true);
assert.equal(pages.public, true);
assert.equal(pages.status, 'built');
assert.equal(pages.cname, null);
assert.equal(pages.source.branch, 'gh-pages');
const anonymousRepository = await fetch(`https://api.github.com/repos/${repository}`, { headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit' });
assert.equal(anonymousRepository.status, 404, 'Anonymous requests must not expose the private repository.');

const files = Object.entries(expected.hashes).filter(([file]) => file !== '.nojekyll');
const verified = [];
const abort = new AbortController();
let nextFile = 0;
async function worker() {
  while (nextFile < files.length) {
    const [file, expectedHash] = files[nextFile++];
    const route = file.replace(/index\.html$/, '').split('/').map(encodeURIComponent).join('/');
    const response = await fetch(new URL(route, url), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: abort.signal });
    assert.equal(response.status, 200, `Public artifact unavailable: ${file}`);
    assert.ok(response.body, `Missing response body: ${file}`);
    const digest = createHash('sha256');
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      digest.update(chunk);
    }
    assert.equal(digest.digest('hex'), expectedHash, `Published bytes differ from the reviewed artifact: ${file}`);
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
  await page.goto(url, { waitUntil: 'networkidle' });
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
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  const hero = await page.locator('[data-canva-page]').first().boundingBox();
  assert.ok(hero);
  const clickSound = page.locator('#studio-cat-click-audio');
  assert.equal(await clickSound.getAttribute('src'), null, 'Click audio must not load before activation.');
  await clickSound.evaluate((element) => {
    element.addEventListener('playing', () => element.setAttribute('data-audio-exercised', ''), { once: true });
  });
  assert.equal(await page.locator('#studio-cat .cat-outline').getAttribute('fill'), '#b7a07a');
  await page.mouse.move(20, hero.y + 95);
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-cat-active'));
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#studio-cat-click-audio')?.hasAttribute('data-audio-exercised'));
  assert.ok(await clickSound.evaluate((element) => element instanceof HTMLAudioElement && element.duration > 0 && element.duration < 1));
  await page.screenshot({ path: path.join(output, 'desktop-cursor.png') });
  await page.getByRole('button', { name: 'Studio Cat click sound', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Studio Cat click sound', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await clickSound.evaluate((element) => (element instanceof HTMLAudioElement) && element.paused), true);
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
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  mobile.on('pageerror', (error) => runtimeErrors.push(error.message));
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.evaluate(() => document.fonts.ready);
  assert.equal(await mobile.locator('#studio-cat').isVisible(), false);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: path.join(output, 'mobile-home.png') });
  await mobile.locator('[data-canva-page]').last().scrollIntoViewIfNeeded();
  assert.equal(await mobile.locator('a[href="mailto:ashfagan99@gmail.com"]').isVisible(), true);
  await mobile.screenshot({ path: path.join(output, 'mobile-contact.png') });
  await mobile.close();
  assert.deepEqual(runtimeErrors, []);
} finally {
  await browser.close();
}
await writeFile(path.join(output, 'verification.json'), JSON.stringify({
  url, repository, repositoryPrivate: repo.private, anonymousRepositoryStatus: anonymousRepository.status,
  pagesPublic: pages.public, customDomain: pages.cname, verifiedAt: new Date().toISOString(),
  browser: 'Isolated Brave, anonymous desktop and touch contexts', files: verified.sort((a, b) => a.file.localeCompare(b.file)),
  displayFont: { family: 'Partita 1990 Regular', sha256: expected.hashes['fonts/partita-1990.woff2'], renderedFonts: displayFonts },
  interactions: ['Partita 1990 rendered glyphs', 'Tabby cursor and paw response', 'Real short click audio playback and mute', 'Real custom-control video playback', 'Page-specific newsletter animation layers', 'Directional page cursor and page-area navigation', 'Inline and standalone document next page', 'Preview-quality notice', 'Actual PDF download', 'Touch layout and contact navigation'],
}, null, 2) + '\n');
console.log(`Anonymous public artifact verified: ${verified.length} exact file hashes, real desktop/mobile flows, private source, and no custom-domain change.`);
