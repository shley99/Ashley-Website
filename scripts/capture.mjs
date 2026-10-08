import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const demo = process.argv.includes('--demo');
const remote = process.argv.find((argument) => argument.startsWith('--url='))?.slice(6);
const output = path.resolve(process.env.CAPTURE_DIR ?? path.join(root, 'test-results', 'captures'));
const base = demo ? '/Ashley-Website/' : '/';
const port = demo ? 4451 : 4450;
const url = remote ?? `http://127.0.0.1:${port}${base}`;
const executablePath = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
const profiles = [
  { name: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
];
// The kit's header, footer, paw, and rips are not part of the Canva artboards, so composition proofs leave them out.
const additionStyles = '.an-topbar, .an-footer, #an-paw-cursor, #an-scratch-layer { display: none !important; } html { scroll-padding-top: 0 !important; }';
let server;
let browser;
let serverOutput = '';

async function settleAssets(page) {
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(async (element) => {
      if (!(element instanceof HTMLImageElement)) return;
      if (!element.complete || !element.naturalWidth) {
        await new Promise((resolve, reject) => {
          element.addEventListener('load', resolve, { once: true });
          element.addEventListener('error', reject, { once: true });
        });
      }
    });
  }
  for (const video of await page.locator('video[data-poster]').all()) {
    await video.scrollIntoViewIfNeeded();
    let posterReady = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await video.getAttribute('poster')) {
        posterReady = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    if (!posterReady) throw new Error('An ambient video poster did not load when its source node entered view.');
  }
}

await mkdir(output, { recursive: true });
try {
  if (!remote) {
    server = spawn(process.execPath, [path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'preview', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port), '--base', base, '--outDir', demo ? 'dist-demo' : 'dist'], { cwd: root, shell: false, windowsHide: true });
    server.stdout.on('data', (data) => { serverOutput = (serverOutput + data).slice(-10000); });
    server.stderr.on('data', (data) => { serverOutput = (serverOutput + data).slice(-10000); });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error(`Preview exited: ${serverOutput}`);
      try { ready = (await fetch(url)).ok; } catch (error) { if (error.cause?.code !== 'ECONNREFUSED') throw error; }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`Preview did not start: ${serverOutput}`);
  }

  browser = await chromium.launch({ executablePath, headless: true });
  const evidence = {
    url,
    browser: 'Isolated Brave',
    version: browser.version(),
    reducedMotion: 'reduce',
    hiddenDifferences: ['Purple header and footer, pixel paw cursor, and scroll rips from the paw kit'],
    state: 'Settled five-artboard composition proof. Source motion is covered by browser lifecycle tests and separate timed evidence.',
    captures: [],
  };

  for (const profile of profiles) {
    const page = await browser.newPage({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: additionStyles });
    await page.evaluate(() => document.fonts.ready);
    await settleAssets(page);

    const sections = page.locator('[data-canva-page]');
    const count = await sections.count();
    if (count !== 5) throw new Error(`Expected five source artboards; found ${count}.`);
    for (let index = 0; index < count; index++) {
      const section = sections.nth(index);
      await section.evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.waitForTimeout(100);
      const id = await section.getAttribute('id');
      const box = await section.boundingBox();
      if (!id || !box) throw new Error(`Source artboard ${index + 1} is unavailable.`);
      const sectionFilename = `${profile.name}-section-${index + 1}.png`;
      const viewportFilename = `${profile.name}-section-${index + 1}-viewport.png`;
      await page.screenshot({ path: path.join(output, viewportFilename), animations: 'disabled' });
      await section.screenshot({ path: path.join(output, sectionFilename), animations: 'disabled' });
      evidence.captures.push({
        profile: profile.name,
        viewport: { width: profile.width, height: profile.height, deviceScaleFactor: profile.deviceScaleFactor },
        artboard: id,
        box: { width: box.width, height: box.height },
        sectionFilename,
        viewportFilename,
      });
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(output, `${profile.name}-full.png`), fullPage: true, animations: 'disabled' });
    if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
    await page.close();
  }

  await writeFile(path.join(output, 'capture.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Captured five desktop and mobile artboards from ${url} in ${output}`);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
