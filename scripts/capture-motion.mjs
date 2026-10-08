import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const url = process.argv[2] ?? 'http://127.0.0.1:4450/';
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
const output = path.resolve(process.argv[3] ?? path.join('research', 'motion-captures', stamp));
const viewport = { width: 1522, height: 830 };
const bravePath = process.env.BRAVE_PATH
  ?? path.join(process.env.LOCALAPPDATA ?? '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');

async function sourceRevision() {
  try {
    const [{ stdout: revision }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD']),
      execFileAsync('git', ['status', '--short']),
    ]);
    return { revision: revision.trim(), dirty: Boolean(status.trim()) };
  } catch (cause) {
    throw new Error('Cannot identify the captured source revision.', { cause });
  }
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: bravePath, headless: true });
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
  recordVideo: { dir: output, size: viewport },
});
const page = await context.newPage();
const video = page.video();
const report = {
  version: 1,
  url,
  output,
  viewport,
  deviceScaleFactor: 1,
  browser: browser.version(),
  motionPreference: 'no-preference',
  animationOverrides: false,
  source: await sourceRevision(),
  startedAt: new Date().toISOString(),
  stages: [],
  pageErrors: [],
};
page.on('pageerror', (error) => report.pageErrors.push(error.message));

async function captureStage(label, top, holdSeconds) {
  await page.evaluate((scrollTop) => scrollTo({ top: scrollTop, behavior: 'instant' }), top);
  const startedAt = performance.now();
  const offsets = [...new Set([0, .25, .5, 1, 2, holdSeconds])]
    .filter((offset) => offset <= holdSeconds);
  const stage = { label, requestedScrollTop: top, startedAt: new Date().toISOString(), frames: [] };

  for (const offset of offsets) {
    const delay = offset * 1000 - (performance.now() - startedAt);
    if (delay > 0) await page.waitForTimeout(delay);
    const filename = `${label}-${offset.toFixed(2)}s.png`;
    await page.screenshot({ path: path.join(output, filename) });
    stage.frames.push({
      filename,
      requestedOffsetSeconds: offset,
      actualOffsetSeconds: (performance.now() - startedAt) / 1000,
    });
  }

  stage.state = await page.evaluate(() => ({
    scrollTop: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    focused: document.hasFocus(),
    hidden: document.hidden,
    sourceMotionReady: document.documentElement.hasAttribute('data-source-motion-ready'),
    sourceMotionPaused: document.documentElement.hasAttribute('data-source-motion-paused'),
    activeSections: [...document.querySelectorAll('.canva-page.is-source-active')].map((element) => element.id),
    visibleImages: [...document.images].filter((image) => {
      const frame = image.closest('[data-canva-node-id]') ?? image;
      const rect = frame.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;
    }).map((image) => ({
      source: image.currentSrc || image.getAttribute('src'),
      loaded: image.complete && image.naturalWidth > 0,
      node: image.closest('[data-canva-node-id]')?.getAttribute('data-canva-node-id'),
    })),
    visibleVideos: [...document.querySelectorAll('video')].filter((video) => {
      const rect = video.closest('[data-video]').getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    }).map((video) => ({ title: video.getAttribute('aria-label'), time: video.currentTime, paused: video.paused, readyState: video.readyState })),
  }));
  if (!label.startsWith('cold-') && stage.state.visibleImages.some((image) => !image.loaded)) {
    throw new Error(`Visible artwork is not ready in ${label}.`);
  }
  report.stages.push(stage);
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
}

try {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) throw new Error(`Capture target returned HTTP ${response?.status()}.`);
  report.documentSha256 = createHash('sha256').update(await response.body()).digest('hex');
  await page.bringToFront();
  await captureStage('cold-home', 0, 2);
  await page.evaluate(() => document.fonts.ready);

  const sections = await page.locator('[data-canva-page]').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { id: element.id, top: rect.top + scrollY, height: rect.height };
    }));
  if (sections.length !== 5) throw new Error(`Expected five artboards, found ${sections.length}.`);
  report.sections = sections;

  const stages = [
    ['home', 0, 12],
    ['about', sections[1].top, 8],
    ['editorial', sections[2].top + 185, 4],
    ['graphic', sections[2].top + 1120, 4],
    ['television', sections[2].top + 2030, 4],
    ['channel', sections[2].top + 2550, 4],
    ['printing', sections[3].top, 4],
    ['laser-heading', sections[3].top + 1150, 4],
    ['laser-media', sections[3].top + 2100, 4],
    ['printmaking', sections[3].top + 2800, 4],
    ['portrait', sections[3].top + 3740, 4],
    ['pulling-print', sections[3].top + 4440, 4],
    ['welding', sections[3].top + 5430, 4],
    ['contact', sections[4].top, 4],
    ['about-return', sections[1].top, 3],
    ['home-return', 0, 3],
  ];
  for (const [label, top, hold] of stages) await captureStage(label, top, hold);
  if (report.pageErrors.length) throw new Error(`Capture encountered runtime errors: ${report.pageErrors.join('; ')}`);
  report.completedAt = new Date().toISOString();
} finally {
  await context.close();
  report.video = await video.path();
  await browser.close();
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
}

console.log(`Normal-motion capture written to ${output}`);
