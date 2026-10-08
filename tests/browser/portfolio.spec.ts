import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface ModelNode extends Layout {
  id: string;
  type: string;
  text?: string;
  lines?: string[];
  src?: string;
  role?: string;
  video?: string;
  entrance?: 'spring';
  continuousMotion?: {
    duration: number;
    interval: number;
    frames: [number, number, number][];
  };
  crop?: { x: number; y: number; width: number; height: number; rotation: number };
  mobileCrop?: { x: number; y: number; width: number; height: number; rotation: number };
  mobile: Layout;
}

interface ModelPage {
  id: string;
  height: number;
  mobileHeight: number;
  nodes: ModelNode[];
}

const model = JSON.parse(await readFile(new URL('../../src/content/canva-home.json', import.meta.url), 'utf8')) as {
  pages: ModelPage[];
};
const videoInventory = JSON.parse(await readFile(new URL('../../src/content/videos.json', import.meta.url), 'utf8')) as Record<string, {
  poster: string;
}>;
const totalNodes = model.pages.reduce((total, page) => total + page.nodes.length, 0);
const heroMotionIds = [
  'LBpXlxrypPRVzGzW',
  'LBhw8F3CDkDvmqg1',
  'LBZXkFBD6GXKStPP',
  'LBkGhBgrSJ5bBV58',
  'LB2Gn4btfHQ4sKPN',
];
const desktopReference = JSON.parse(await readFile(new URL('../fixtures/canva-desktop.json', import.meta.url), 'utf8')) as {
  viewport: { width: number; height: number };
  motion: { id: string; role: string; page: string; samples: { time: number; x: number; y: number; width: number; height: number }[] }[];
};
const continuousMotionIds = desktopReference.motion.map((node) => node.id);
const headingReference = JSON.parse(await readFile(new URL('../fixtures/desktop-heading-ink.json', import.meta.url), 'utf8')) as {
  viewport: { width: number; height: number };
  headings: { text: string; x: number; y: number; width: number; height: number }[];
};
const weldingLines = [
  'I began learning arc welding in high school',
  'and later expanded into MIG and TIG welding',
  'under the mentorship of my father.',
  'Combining these technical skills with my',
  'passion for jewelry making and sustainability, I',
  'designed and built a wind-powered rock',
  'tumbler that transforms broken glass into',
  'smooth, frosted “beach glass.”',
];
const posterVideos = ['japan-march', 'japan-february', 'family-memories'];
const ambientVideos = ['portrait-stamp', 'carving-block', 'pulling-print', 'stamp-workshop', 'laser-engraving'];
const aboutDeferredImage = model.pages.find((page) => page.id === 'about')?.nodes.find((node) => node.type === 'image')?.src;
const distantDeferredImage = [...(model.pages.find((page) => page.id === 'physical')?.nodes ?? [])].reverse().find((node) => node.type === 'image')?.src;

async function openHome(page: Page) {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.bringToFront();
  await expect(page.locator('html')).toHaveAttribute('data-source-motion-ready', '');
}

async function pointerPoint(page: Page) {
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const point = { x: 20, y: 700 };
  await page.mouse.move(point.x, point.y);
  return point;
}

async function renderedLayout(page: Page, id: string) {
  return page.locator(`[data-canva-node-id="${id}"]`).evaluate((element) => ({
    x: (element as HTMLElement).offsetLeft,
    y: (element as HTMLElement).offsetTop,
    width: (element as HTMLElement).offsetWidth,
    height: (element as HTMLElement).offsetHeight,
  }));
}

async function renderedCrop(page: Page, id: string) {
  return page.locator(`[data-canva-node-id="${id}"] .canva-media`).evaluate((frame) => {
    const media = frame.querySelector<HTMLElement>(':scope > img, :scope > video');
    if (!media) throw new Error('Media element is missing.');
    const style = getComputedStyle(media);
    const frameStyle = getComputedStyle(frame);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return {
      x: Number.parseFloat(style.left) / Number.parseFloat(frameStyle.width),
      y: Number.parseFloat(style.top) / Number.parseFloat(frameStyle.height),
      width: Number.parseFloat(style.width) / Number.parseFloat(frameStyle.width),
      height: Number.parseFloat(style.height) / Number.parseFloat(frameStyle.height),
      rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
      objectFit: style.objectFit,
    };
  });
}

test('the source-driven homepage contains every artboard, node, project, media role, and real link', async ({ page, baseURL }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseURL ?? '')) failures.push(`${response.status()} ${response.url()}`);
  });
  await openHome(page);

  await expect(page.locator('[data-canva-page]')).toHaveCount(5);
  await expect(page.locator('[data-canva-node-id]')).toHaveCount(totalNodes);
  await expect(page.getByRole('heading', { level: 1, name: 'CREATIVE PORTFOLIO', exact: true })).toHaveCount(1);
  for (const heading of ['I’M ASHLEY', 'DIGITAL WORKS', 'PHYSICAL WORKS', 'CONTACT ME', 'EDITORIAL DESIGN', 'GRAPHIC DESIGN', 'VIDEO EDITING', '3D PRINTING', 'LASER CUTTING', 'PRINTMAKING', 'WELDING']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(1);
  }

  await expect(page.locator('video')).toHaveCount(8);
  await expect(page.locator('[data-source-video-mode="poster"]')).toHaveCount(3);
  await expect(page.locator('[data-source-video-mode="ambient"]')).toHaveCount(5);
  await expect(page.locator('.canva-node--line path[marker-end]')).toHaveCount(3);
  await expect(page.locator('a[href="mailto:ashfagan99@gmail.com"]')).toHaveCount(1);
  await expect(page.locator('a[href="tel:+18315788657"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://www.youtube.com/@ashleynaoko"]')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Visit Ashley Naoko on YouTube' })).toHaveCount(1);
  await expect(page.locator('[data-newsletter-reader] > .canva-newsletter-link')).toHaveCount(1);
  await expect(page.locator('[data-newsletter-reader]')).toHaveAttribute('data-newsletter-enhanced', '');
  await expect(page.locator('iframe')).toHaveCount(0);

  await expect(page.locator('[data-canva-node-id="LBRF0Rq2Shp50HfZ"]')).toHaveCSS('font-family', /^"Partita 1990"/);
  await expect(page.locator('[data-canva-node-id="LBtHKR4qjBwbqBgp"]')).toHaveCSS('font-family', /Montserrat/);
  await expect(page.locator('[data-canva-node-id="LBbNCVwSccGln5QR"]')).toHaveCSS('font-family', /Roboto/);
  const channelPanel = page.locator('[data-canva-node-id="LBT8rhk6Vk8mtdRq"] .canva-vector-rect');
  await expect(channelPanel).toHaveCSS('border-top-width', '1px');
  await expect(channelPanel).toHaveCSS('border-top-left-radius', '9px');
  await expect(page.locator('[data-canva-node-id="LB9kN7RflJK8tclm"] image')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Visit Ashley Naoko on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@ashleynaoko');
  const subscribe = page.getByRole('link', { name: 'Visit Ashley Naoko on YouTube' });
  await subscribe.scrollIntoViewIfNeeded();
  const subscribeBounds = await subscribe.boundingBox();
  expect(subscribeBounds?.width).toBeGreaterThan(160);
  expect(subscribeBounds?.height).toBeGreaterThan(50);
  await page.context().route('https://www.youtube.com/**', (route) => route.fulfill({ body: '<title>Channel destination fixture</title>', contentType: 'text/html' }));
  const popupPromise = page.waitForEvent('popup');
  await subscribe.click();
  const popup = await popupPromise;
  await popup.waitForURL('https://www.youtube.com/@ashleynaoko');
  await popup.close();
  await page.bringToFront();

  for (const image of await page.locator('img[alt]:not([alt=""])').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element) =>
      element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0
    )).toBe(true);
  }
  expect(failures).toEqual([]);
});

test('desktop artboards preserve observed section joins, crops, and authored line strings', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);

  const desktopHeadings = ['LBbKRRRjlD2pyLxL', 'LBDQTkJRg7z9d7Cs', 'LBRF0Rq2Shp50HfZ', 'LBlJSCwSRDx4bbLT', 'LB4jHK1N8SPJnrVs'];
  for (const fixture of model.pages) {
    await expect(page.locator(`#${fixture.id}`)).toHaveCSS('height', `${fixture.height}px`);
  }
  for (const id of desktopHeadings) {
    const fixture = model.pages.flatMap((item) => item.nodes).find((node) => node.id === id);
    if (!fixture) throw new Error(`Missing fixture ${id}`);
    const actual = await renderedLayout(page, id);
    expect(actual.x).toBeCloseTo(fixture.x, 0);
    expect(actual.y).toBeCloseTo(fixture.y, 0);
    expect(actual.width).toBeCloseTo(fixture.width, 0);
    expect(actual.height).toBeCloseTo(fixture.height, 0);
  }
  const desktopWelding = await page.locator('[data-canva-node-id="LBLY57wXs0wk0f0c"]').evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    const ys: number[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      for (let index = 0; index < (textNode.textContent?.length ?? 0); index++) {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.height && !ys.some((y) => Math.abs(y - rect.y) < .75)) ys.push(rect.y);
      }
    }
    return { lineHeight, lines: ys.length };
  });
  expect(desktopWelding.lineHeight).toBeCloseTo(30, 2);
  expect(desktopWelding.lines).toBe(8);
  const actualWeldingLines = await page
    .locator('[data-canva-node-id="LBLY57wXs0wk0f0c"] .canva-text-content--desktop [data-authored-line]')
    .allTextContents();
  expect(actualWeldingLines.map((line) => line.trimEnd())).toEqual(weldingLines);
  expect(await page.evaluate(() => document.documentElement.scrollHeight))
    .toBe(model.pages.reduce((total, page) => total + page.height, 0) - 4);

  for (const id of ['LBCg8SFy0yX4l8CQ', 'LBzjpW9qDWCqh6j2', 'LBYmF0g85VcXTqSm']) {
    const fixture = model.pages.flatMap((item) => item.nodes).find((node) => node.id === id);
    if (!fixture?.crop) throw new Error(`Missing desktop crop fixture ${id}`);
    const crop = await renderedCrop(page, id);
    for (const [key, pixels] of [['x', fixture.width], ['width', fixture.width], ['y', fixture.height], ['height', fixture.height]] as const) {
      expect(Math.abs(crop[key] - fixture.crop[key]) * pixels, `${id} ${key} in CSS pixels`).toBeLessThan(.05);
    }
    expect(crop.rotation, id).toBeCloseTo(fixture.crop.rotation, 2);
    expect(crop.objectFit, id).toBe('fill');
  }

});

test('Partita 1990 supplies the actual glyphs and preserves all thirteen desktop heading bounds', async ({ page }, testInfo) => {
  await page.setViewportSize(headingReference.viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const dom = await cdp.send('DOM.getDocument');
  const proof = [];
  for (const expected of headingReference.headings) {
    const fixture = model.pages.flatMap((section) => section.nodes).find((node) => node.text === expected.text);
    if (!fixture) throw new Error(`Missing heading fixture: ${expected.text}`);
    const selector = `[data-canva-node-id="${fixture.id}"]`;
    const heading = page.locator(selector);
    const position = await heading.evaluate((element) => {
      if (!(element instanceof HTMLElement)) throw new Error('Expected an HTML heading.');
      const section = element.closest('section');
      if (!section) throw new Error('Heading has no artboard.');
      scrollTo({ top: section.offsetTop + element.offsetTop - 100, behavior: 'instant' });
      return {
        sectionTop: section.offsetTop, scrollTop: scrollY,
        white: getComputedStyle(element).color === 'rgb(255, 255, 255)',
      };
    });
    const clip = {
      x: expected.x - 8,
      y: expected.y + position.sectionTop - position.scrollTop - 8,
      width: expected.width + 16,
      height: expected.height + 16,
    };
    const screenshot = await page.screenshot({ clip });
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, right = -1, top = info.height, bottom = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const pixel = (y * info.width + x) * info.channels;
      const ink = position.white
        ? data[pixel] > 247 && data[pixel + 1] > 247 && data[pixel + 2] > 247
        : data[pixel] < 30 && data[pixel + 1] < 30 && data[pixel + 2] < 30;
      if (!ink) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    expect(right, expected.text).toBeGreaterThan(left);
    const actual = {
      x: clip.x + left, y: clip.y + top + position.scrollTop - position.sectionTop,
      width: right - left + 1, height: bottom - top + 1,
    };
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(actual[key] - expected[key]), `${expected.text} ${key}`).toBeLessThanOrEqual(1);
    }
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
      nodeId: dom.root.nodeId, selector: `${selector} .canva-text-content--desktop .canva-text-line span`,
    });
    const rendered = await Promise.all(nodeIds.map((nodeId) => cdp.send('CSS.getPlatformFontsForNode', { nodeId })));
    const fonts = rendered.flatMap((entry) => entry.fonts);
    expect(fonts.length, expected.text).toBeGreaterThan(0);
    expect(fonts.every((font) => font.isCustomFont && /Partita/i.test(font.familyName)), expected.text).toBe(true);
    proof.push({ text: expected.text, expected, actual, fonts });
  }
  await testInfo.attach('partita-rendered-headings', { body: JSON.stringify(proof, null, 2), contentType: 'application/json' });
  await cdp.detach();
});

test('existing compact layout and media crops remain isolated from desktop changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const desktopHeadings = ['LBbKRRRjlD2pyLxL', 'LBDQTkJRg7z9d7Cs', 'LBRF0Rq2Shp50HfZ', 'LBlJSCwSRDx4bbLT', 'LB4jHK1N8SPJnrVs'];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  for (const fixture of model.pages) {
    const height = await page.locator(`#${fixture.id}`).evaluate((element) => element.getBoundingClientRect().height);
    expect(height).toBeCloseTo(fixture.mobileHeight, 1);
  }
  for (const id of desktopHeadings) {
    const fixture = model.pages.flatMap((item) => item.nodes).find((node) => node.id === id);
    if (!fixture) throw new Error(`Missing fixture ${id}`);
    const actual = await renderedLayout(page, id);
    expect(actual.x).toBeCloseTo(fixture.mobile.x, 0);
    expect(actual.y).toBeCloseTo(fixture.mobile.y, 0);
    expect(actual.width).toBeCloseTo(fixture.mobile.width, 0);
    expect(actual.height).toBeCloseTo(fixture.mobile.height, 0);
  }
  const mobileWelding = await page.locator('[data-canva-node-id="LBLY57wXs0wk0f0c"]').evaluate((element) => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    const ys: number[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      for (let index = 0; index < (textNode.textContent?.length ?? 0); index++) {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.height && !ys.some((y) => Math.abs(y - rect.y) < .75)) ys.push(rect.y);
      }
    }
    return { lineHeight, lines: ys.length };
  });
  expect(mobileWelding.lineHeight).toBeCloseTo(8.768, 2);
  expect(mobileWelding.lines).toBe(8);

  for (const id of ['LBCg8SFy0yX4l8CQ', 'LBzjpW9qDWCqh6j2', 'LBYmF0g85VcXTqSm']) {
    const fixture = model.pages.flatMap((item) => item.nodes).find((node) => node.id === id);
    if (!fixture?.mobileCrop) throw new Error(`Missing mobile crop fixture ${id}`);
    const crop = await renderedCrop(page, id);
    for (const [key, pixels] of [['x', fixture.mobile.width], ['width', fixture.mobile.width], ['y', fixture.mobile.height], ['height', fixture.mobile.height]] as const) {
      expect(Math.abs(crop[key] - fixture.mobileCrop[key]) * pixels, `${id} ${key} in CSS pixels`).toBeLessThan(.05);
    }
    expect(crop.rotation, id).toBeCloseTo(fixture.mobileCrop.rotation, 2);
  }

  const arrowStroke = await page.locator('[data-canva-node-id="LBL2tTnFqrh14CFS"] path[marker-end]').evaluate((path) => {
    const ctm = (path as SVGPathElement).getScreenCTM();
    return ctm ? Number(path.getAttribute('stroke-width')) * Math.hypot(ctm.a, ctm.b) : 0;
  });
  expect(arrowStroke).toBeGreaterThan(1);
  expect(arrowStroke).toBeLessThan(1.4);

  for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768], [1440, 1000], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth, `${width}x${height}`).toBeLessThanOrEqual(layout.width + 1);
  }
});

test('typewriter headings reveal characters for 1.6 seconds exactly once and reduce to a static heading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  const heading = page.locator('[data-canva-node-id="LBRF0Rq2Shp50HfZ"]');
  const characters = heading.locator('.canva-text-content--desktop .canva-type-character');
  await expect(heading).toHaveClass(/is-type-pending/);
  expect(await characters.count()).toBe(13);

  const started = Date.now();
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toHaveClass(/is-type-revealing/);
  await page.waitForTimeout(350);
  const visibleCharacters = await characters.evaluateAll((items) =>
    items.filter((character) => Number(getComputedStyle(character).opacity) > .95).length
  );
  expect(visibleCharacters).toBeGreaterThan(0);
  expect(visibleCharacters).toBeLessThan(13);
  await expect(heading).toHaveClass(/is-type-complete/);
  expect(Date.now() - started).toBeGreaterThanOrEqual(1400);
  expect(Date.now() - started).toBeLessThan(2300);

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await expect(heading).toHaveClass(/is-type-complete/);
  expect(await characters.evaluateAll((items) =>
    items.every((character) => Number(getComputedStyle(character).opacity) === 1)
  )).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const physical = page.locator('[data-canva-node-id="LBlJSCwSRDx4bbLT"]');
  await expect(physical).toHaveClass(/is-type-complete/);
  expect(await physical.locator('.canva-text-content--desktop .canva-type-character').evaluateAll((items) =>
    items.every((character) => Number(getComputedStyle(character).opacity) === 1)
  )).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(heading).toHaveClass(/is-type-complete/);
  await expect(physical).toHaveClass(/is-type-complete/);
  expect(await characters.evaluateAll((items) => items.every((item) => getComputedStyle(item).opacity === '1'))).toBe(true);
});

test('twenty collage motions reproduce independently recorded positions without scaling', async ({ page }) => {
  await page.setViewportSize(desktopReference.viewport);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-hero-entry]')).toHaveCount(5);
  await expect(page.locator('[data-continuous-motion]')).toHaveCount(20);
  await expect(page.locator('[data-line-reveal]')).toHaveCount(2);
  expect((await page.locator('[data-continuous-motion]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-canva-node-id')).sort()
  ))).toEqual([...continuousMotionIds].sort());
  for (const id of heroMotionIds) {
    await expect(page.locator(`[data-canva-node-id="${id}"]`)).toHaveAttribute('data-hero-entry', '');
  }
  await expect(page.locator('[data-canva-node-id="LBmwkYZxhcSLTVHc"]')).not.toHaveAttribute('data-hero-entry', '');
  await expect(page.locator('html')).toHaveAttribute('data-source-motion-ready', '');
  await page.waitForTimeout(1100);

  for (const id of heroMotionIds) {
    const matrix = await page.locator(`[data-canva-node-id="${id}"] .canva-entry-shell`).evaluate((element) =>
      new DOMMatrixReadOnly(getComputedStyle(element).transform).a
    );
    expect(matrix).toBeCloseTo(1, 2);
  }

  for (const section of ['home', 'about']) {
    await page.locator(`#${section}`).evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const fixtures = desktopReference.motion.filter((entry) => entry.page === section);
    await page.waitForTimeout(100);
    for (let index = 0; index < 4; index++) {
      const boxes = await page.evaluate(async ({ fixtures, index }) => {
        for (const fixture of fixtures) {
          const shell = document.querySelector(`[data-canva-node-id="${fixture.id}"] [data-motion-shell]`);
          const animation = shell?.getAnimations()[0];
          if (!animation) throw new Error(`Missing animation ${fixture.id}`);
          animation.pause();
          animation.currentTime = fixture.samples[index].time * 1000;
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return fixtures.map((fixture) => {
          const node = document.querySelector(`[data-canva-node-id="${fixture.id}"]`)!;
          const image = node.querySelector('img')!;
          const shell = node.querySelector('[data-motion-shell]')!;
          const matrix = new DOMMatrixReadOnly(getComputedStyle(shell).transform);
          const rect = image.getBoundingClientRect();
          const section = node.closest('[data-canva-page]')!.getBoundingClientRect();
          return {
            id: fixture.id, x: rect.x, y: rect.y - section.y, width: rect.width, height: rect.height,
            scale: Math.hypot(matrix.a, matrix.b),
          };
        });
      }, { fixtures, index });
      for (const [position, box] of boxes.entries()) {
        const expected = fixtures[position].samples[index];
        for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[key] - expected[key]), `${box.id} ${key}`).toBeLessThan(1);
        expect(box.scale).toBeCloseTo(1, 4);
      }
    }
  }
});

test('source motion pauses offscreen, resumes without reset, and stays readable after preference changes', async ({ page }) => {
  await page.setViewportSize(desktopReference.viewport);
  await openHome(page);
  const target = page.locator('#home [data-continuous-motion]').first().locator('[data-motion-shell]');
  await page.locator('#about').evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(page.locator('#about')).toHaveClass(/is-source-active/);
  await expect.poll(() => target.evaluate((element) => element.getAnimations()[0]?.playState)).toBe('paused');
  const whileAway = await target.evaluate((element) => Number(element.getAnimations()[0]?.currentTime ?? -1));
  await page.waitForTimeout(250);
  expect(await target.evaluate((element) => Number(element.getAnimations()[0]?.currentTime ?? -1))).toBe(whileAway);
  const about = page.locator('#about [data-continuous-motion] [data-motion-shell]').first();
  const first = await about.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(450);
  expect(await about.evaluate((element) => getComputedStyle(element).transform)).not.toBe(first);
  await page.locator('#home').evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(page.locator('#home')).toHaveClass(/is-source-active/);
  await page.waitForTimeout(250);
  const afterReturn = await target.evaluate((element) => Number(element.getAnimations()[0]?.currentTime ?? -1));
  expect(afterReturn).toBeGreaterThan(whileAway + 100);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(target).toHaveCSS('transform', 'none');
  await expect(page.locator('html')).toHaveAttribute('data-source-motion-paused', '');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => target.evaluate((element) => element.getAnimations()[0]?.playState)).toBe('running');
  await page.goto('./#about');
  await expect(page.locator('#about [data-continuous-motion] [data-motion-shell]').first()).not.toHaveCSS('transform', 'none');
});

test('poster and ambient videos follow the Canva playback modes and lifecycle', async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);

  for (const role of posterVideos) {
    const figure = page.locator(`[data-video="${role}"]`);
    const video = figure.locator('video');
    const seek = figure.locator('[data-video-seek]');
    const mute = figure.locator('[data-video-mute]');
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute('data-video-enhanced', '');
    await expect(video).not.toHaveAttribute('controls', '');
    expect(await video.evaluate((element) => element instanceof HTMLVideoElement && element.muted)).toBe(false);
    await figure.getByRole('button', { name: new RegExp('^Play ') }).click();
    await expect(video).not.toHaveAttribute('controls', '');
    await expect.poll(() => video.evaluate((element) => element instanceof HTMLVideoElement ? element.currentTime : -1)).toBeGreaterThan(.05);
    const state = await video.evaluate((element) => ({
      duration: element instanceof HTMLVideoElement ? element.duration : -1,
      width: element instanceof HTMLVideoElement ? element.videoWidth : -1,
      error: element instanceof HTMLVideoElement ? element.error?.message : 'Not a video',
    }));
    expect(state.error).toBeUndefined();
    expect(state.duration).toBeGreaterThan(8);
    expect(state.width).toBeGreaterThanOrEqual(720);
    await expect(seek).toBeEnabled();
    await seek.evaluate((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      input.value = '600';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(() => video.evaluate((element) =>
      element instanceof HTMLVideoElement ? element.currentTime / element.duration : -1
    )).toBeGreaterThan(.55);
    await mute.click();
    expect(await video.evaluate((element) => element instanceof HTMLVideoElement && element.muted)).toBe(true);
    await figure.getByRole('button', { name: new RegExp('^Pause ') }).click();
    await expect.poll(() => video.evaluate((element) => element instanceof HTMLVideoElement && element.paused)).toBe(true);
    await expect(video).not.toHaveAttribute('controls', '');
  }

  for (const role of ambientVideos) {
    const figure = page.locator(`[data-video="${role}"]`);
    const video = figure.locator('video');
    const control = figure.locator('[data-source-video-control]');
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((element) => element instanceof HTMLVideoElement ? element.currentTime : -1)).toBeGreaterThan(.05);
    expect(await video.evaluate((element) => element instanceof HTMLVideoElement
      ? { muted: element.muted, loop: element.loop, controls: element.controls }
      : null
    )).toEqual({
      muted: true,
      loop: true,
      controls: false,
    });
    await page.mouse.move(1, 1);
    await expect(control).toHaveCSS('pointer-events', 'none');
    await figure.hover();
    await expect(control).toHaveCSS('pointer-events', 'auto');
    await expect(figure.locator('.canva-video-rail')).toHaveCSS('pointer-events', 'auto');
  }

  expect(Number.parseFloat(await page.locator('[data-video="japan-march"] .canva-media').evaluate((element) =>
    getComputedStyle(element).borderTopLeftRadius
  ))).toBeGreaterThan(0);

  const ambient = page.locator('[data-video="laser-engraving"] video');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => ambient.evaluate((element) => element instanceof HTMLVideoElement && element.paused)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => ambient.evaluate((element) => element instanceof HTMLVideoElement && element.paused)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => ambient.evaluate((element) => element instanceof HTMLVideoElement && element.paused)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => ambient.evaluate((element) => element instanceof HTMLVideoElement && element.paused)).toBe(false);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => ambient.evaluate((element) => element instanceof HTMLVideoElement && element.paused)).toBe(true);
  await expect(page.locator('.media-error:visible')).toHaveCount(0);
});

test('a failed video exposes an honest recovery link instead of a success-shaped player', async ({ page }) => {
  await page.route('**/media/videos/family-memories.mp4', (route) => route.abort('failed'));
  await openHome(page);
  const figure = page.locator('[data-video="family-memories"]');
  await figure.scrollIntoViewIfNeeded();
  await figure.getByRole('button', { name: 'Play Family film restoration' }).click();
  await expect(figure.locator('.media-error')).toBeVisible();
  await expect(figure.getByRole('link', { name: 'Open the video file.' })).toBeVisible();
});

test('authored video trims, manual ambient pause, and uncropped full screen remain real media state', async ({ page }) => {
  await openHome(page);
  const february = page.locator('[data-video="japan-february"]');
  await february.scrollIntoViewIfNeeded();
  await february.getByRole('button', { name: 'Play February - Life in Japan', exact: true }).click();
  const februaryVideo = february.locator('video');
  await expect.poll(() => februaryVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(28.51);
  expect(await februaryVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeLessThan(31);
  await february.getByRole('button', { name: 'Pause February - Life in Japan', exact: true }).click();
  await february.locator('[data-video-seek]').evaluate((slider) => {
    (slider as HTMLInputElement).value = '500';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => februaryVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeCloseTo((28.51 + 57.931999) / 2, 1);

  const laser = page.locator('[data-video="laser-engraving"]');
  const laserVideo = laser.locator('video');
  await laser.scrollIntoViewIfNeeded();
  await expect.poll(() => laserVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(8.09);
  expect(await laserVideo.evaluate((video) => (video as HTMLVideoElement).currentTime)).toBeLessThan(17.49);
  await laser.hover();
  await laser.getByRole('button', { name: 'Pause Laser engraving a tumbler', exact: true }).click();
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await expect.poll(() => laserVideo.evaluate((video) => (video as HTMLVideoElement).paused)).toBe(true);

  await laser.getByRole('button', { name: 'Full screen Laser engraving a tumbler', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('VIDEO');
  const fullScreen = await laserVideo.evaluate((video) => {
    const rect = video.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, innerWidth, innerHeight, fit: getComputedStyle(video).objectFit };
  });
  expect(fullScreen.x).toBe(0);
  expect(fullScreen.y).toBe(0);
  expect(fullScreen.width).toBe(fullScreen.innerWidth);
  expect(fullScreen.height).toBe(fullScreen.innerHeight);
  expect(fullScreen.fit).toBe('contain');
  await page.evaluate(() => document.exitFullscreen());
  await expect(laserVideo).not.toHaveAttribute('controls', '');
});

test('the homepage newsletter pages, zooms, enters fullscreen, and exposes verified fallbacks in place', async ({ page }) => {
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  await expect(reader).toHaveAttribute('data-newsletter-enhanced', '');
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('1 / 15');

  await reader.getByRole('button', { name: 'Next newsletter page' }).click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('2 / 15');
  await expect(reader.locator('[data-newsletter-image]')).toHaveAttribute('src', /newsletter-02\.webp$/);
  await reader.getByRole('button', { name: 'Previous newsletter page' }).click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('1 / 15');

  const canvas = reader.locator('[data-newsletter-canvas]');
  await reader.locator('summary[aria-label="Zoom in and out"]').click();
  const initialWidth = await canvas.evaluate((element) => element.getBoundingClientRect().width);
  await reader.getByRole('slider', { name: 'Newsletter zoom', exact: true }).focus();
  await page.keyboard.press('End');
  await expect.poll(() => canvas.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(initialWidth * 1.2);
  await reader.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect.poll(() => canvas.evaluate((element) => element.getBoundingClientRect().width)).toBe(initialWidth);

  await reader.locator('summary[aria-label="More newsletter options"]').click();
  await expect(reader.getByRole('link', { name: 'Open standalone reader' })).toBeVisible();
  await expect(reader.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', '');
  await expect(reader.getByRole('link', { name: 'Open current page image' })).toHaveAttribute('href', /newsletter-01\.webp$/);
  await reader.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await expect(reader.locator('.canva-newsletter-toolbar')).toBeHidden();
  await reader.getByRole('button', { name: 'Show newsletter controls', exact: true }).click();
  await expect(reader.locator('.canva-newsletter-toolbar')).toBeVisible();

  const fullscreen = reader.getByRole('button', { name: 'Enter newsletter full screen' });
  if (await fullscreen.isEnabled()) {
    await fullscreen.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute('data-newsletter-reader') ?? false)).toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  }
});

test('newsletter loading failures retain the last decoded page and retry without false page counts', async ({ page }) => {
  let fail = true;
  await page.route('**/documents/newsletter-02.webp', (route) => fail ? route.abort('failed') : route.continue());
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  const firstSource = await reader.locator('[data-newsletter-image]').evaluate((image) => (image as HTMLImageElement).currentSrc);
  await reader.getByRole('button', { name: 'Next newsletter page' }).click();
  await expect(reader.locator('.media-error')).toBeVisible();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('1 / 15');
  expect(await reader.locator('[data-newsletter-image]').evaluate((image) => (image as HTMLImageElement).currentSrc)).toBe(firstSource);
  fail = false;
  await reader.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('2 / 15');
  await expect(reader.locator('.media-error')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('2 / 15');
});

test('newsletter page areas use the recorded directional cursors and navigate without click sounds', async ({ page }) => {
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  const previous = reader.getByRole('button', { name: 'Previous page', exact: true });
  const next = reader.getByRole('button', { name: 'Next page', exact: true });
  const stage = reader.locator('[data-newsletter-stage]');
  await expect(previous).toBeDisabled();
  await expect(previous).toHaveCSS('cursor', 'auto');
  await expect(next).toHaveCSS('cursor', /next-page\.svg.*16 16, e-resize$/);
  const geometry = await stage.boundingBox();
  const previousGeometry = await previous.boundingBox();
  expect(geometry).not.toBeNull();
  expect(previousGeometry?.width).toBeCloseTo((geometry?.width ?? 0) / 3, 1);
  await next.hover();
  await expect(page.locator('#studio-cat')).toBeHidden();
  const before = page.url();
  await next.click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('2 / 15');
  await page.keyboard.press('ArrowRight');
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('3 / 15');
  await page.keyboard.press('ArrowLeft');
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('2 / 15');
  await previous.hover();
  await expect(previous).toHaveCSS('cursor', /previous-page\.svg.*16 16, w-resize$/);
  await previous.click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('1 / 15');
  expect(page.url()).toBe(before);
  await expect(page.locator('#studio-cat-click-audio')).not.toHaveAttribute('src');

  if (!geometry) throw new Error('Reader geometry missing.');
  await page.mouse.move(geometry.x + geometry.width * .65, geometry.y + geometry.height * .35);
  await page.mouse.down();
  await page.mouse.move(geometry.x + geometry.width * .7, geometry.y + geometry.height * .5);
  await page.mouse.up();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('1 / 15');
  await reader.locator('summary[aria-label="Zoom in and out"]').click();
  await reader.getByRole('slider', { name: 'Newsletter zoom', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(next).toBeHidden();
  await expect(previous).toBeHidden();
  await reader.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(next).toBeVisible();
});

test('only the recorded first three newsletter pages animate and all fifteen page-click destinations are correct', async ({ page }, testInfo) => {
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  const mount = reader.locator('[data-newsletter-motion]');
  const roles: Record<number, string[]> = { 1: ['heart-moth', 'orange-butterfly'], 2: ['luna-moth', 'star-moth'], 3: ['heart-moth', 'star-moth'] };
  for (let number = 1; number <= 15; number++) {
    await expect(reader.locator('[data-newsletter-counter]')).toHaveText(`${number} / 15`);
    if (number <= 3) {
      await expect(mount).toBeVisible();
      await expect(mount).toHaveAttribute('data-newsletter-motion-page', String(number));
      const decorations = mount.locator('[data-newsletter-decoration]');
      expect(await decorations.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-newsletter-decoration')).sort())).toEqual(roles[number]);
      for (const decoration of await decorations.all()) {
        await expect.poll(() => decoration.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth === 480)).toBe(true);
        const frames = new Set<string>();
        for (let frame = 0; frame < 4; frame++) {
          frames.add((await decoration.screenshot({ animations: 'allow' })).toString('base64'));
          await page.waitForTimeout(110);
        }
        expect(frames.size, `${number} ${await decoration.getAttribute('data-newsletter-decoration')}`).toBeGreaterThan(1);
      }
      await reader.screenshot({ path: testInfo.outputPath(`animated-newsletter-${number}.png`), animations: 'allow' });
    } else {
      await expect(mount).toBeHidden();
      await expect(reader.locator('[data-newsletter-image]')).toHaveAttribute('src', new RegExp(`newsletter-${String(number).padStart(2, '0')}\\.webp$`));
    }
    if (number < 15) await reader.getByRole('button', { name: 'Next page', exact: true }).click();
  }
  await expect(reader.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  await expect(reader.getByRole('button', { name: 'Next page', exact: true })).toHaveCSS('cursor', 'auto');
  await reader.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('14 / 15');
});

test('newsletter animations stop when hidden or reduced and return on the same page without duplicating layers', async ({ page }) => {
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  const mount = reader.locator('[data-newsletter-motion]');
  await reader.scrollIntoViewIfNeeded();
  await expect(mount).toBeVisible();
  await reader.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(mount).toHaveAttribute('data-newsletter-motion-page', '2');
  await expect(mount).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(mount).toBeHidden();
  await expect(reader.locator('[data-newsletter-image]')).toHaveAttribute('src', /newsletter-02\.webp$/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(mount).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(mount).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(mount).toBeVisible();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(mount).toBeHidden();
  await reader.scrollIntoViewIfNeeded();
  await expect(mount).toBeVisible();
  await expect(mount).toHaveAttribute('data-newsletter-motion-page', '2');
  await expect(mount.locator('[data-newsletter-decoration]')).toHaveCount(2);
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(mount).toBeHidden();
});

test('failed newsletter decorations leave the complete static page and real navigation available', async ({ page }) => {
  await page.route('**/media/newsletter-motion/heart-moth.webp', (route) => route.abort('failed'));
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  await expect(reader.locator('[data-newsletter-motion-status]')).toContainText('Page 1 animations could not load');
  await expect(reader.locator('[data-newsletter-motion]')).toBeHidden();
  await expect.poll(() => reader.locator('[data-newsletter-image]').evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true);
  await reader.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(reader.locator('[data-newsletter-counter]')).toHaveText('2 / 15');
  await expect(reader.locator('[data-newsletter-motion]')).toBeVisible();
  await expect(reader.locator('[data-newsletter-motion]')).toHaveAttribute('data-newsletter-motion-page', '2');
});

test('the independent reader preserves all fifteen pages, text, navigation, and the PDF download', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('newsletter/');
  for (let number = 1; number <= 15; number++) {
    await expect(page.locator('.reader-count')).toHaveText(`Page ${number} of 15`);
    await expect(page.locator('.page-index [aria-current="page"]')).toHaveText(String(number));
    const dimensions = await page.locator('.reader-page img').evaluate(async (image) => {
      if (!(image instanceof HTMLImageElement)) throw new Error('The document image is missing.');
      await image.decode();
      return { width: image.naturalWidth, displayedWidth: image.getBoundingClientRect().width };
    });
    expect(dimensions.width).toBeGreaterThanOrEqual(380);
    expect(dimensions.displayedWidth).toBeLessThanOrEqual(dimensions.width + 1);
    expect(await page.locator('.page-transcript p').count()).toBeGreaterThan(0);
    if (number >= 13) {
      await expect(page.locator('.reader-notice')).toBeVisible();
      await expect(page.locator('.reader-text')).toHaveAttribute('open', '');
    }
    if (number < 15) await page.getByRole('link', { name: `Next page, ${number + 1}`, exact: true }).click();
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ashley-naoko-newsletter.pdf');
  const file = testInfo.outputPath('newsletter.pdf');
  await download.saveAs(file);
  expect((await readFile(file)).subarray(0, 5).toString()).toBe('%PDF-');
});

test('keyboard navigation reaches the real content and source links without added navigation chrome', async ({ page }) => {
  await openHome(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  const email = page.locator('a[href="mailto:ashfagan99@gmail.com"]');
  const phone = page.locator('a[href="tel:+18315788657"]');
  await email.focus();
  await expect(email).toBeFocused();
  await phone.focus();
  await expect(phone).toBeFocused();
  await expect(page.getByRole('link', { name: 'Visit Ashley Naoko on YouTube' })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('link', { name: 'Ashley Naoko', exact: true })).toHaveAttribute('target', '_blank');

  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  const more = reader.locator('summary[aria-label="More newsletter options"]');
  await more.focus();
  await page.keyboard.press('Enter');
  await reader.getByRole('link', { name: 'Open standalone reader' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.reader-count')).toHaveText('Page 1 of 15');
  await expect(page.locator('html')).not.toHaveAttribute('data-cat-active');
});

test('Studio Cat tracks its hotspot, acknowledges clicks, persists its preference, and yields to native UI', async ({ page }) => {
  await openHome(page);
  const point = await pointerPoint(page);
  const cursor = page.locator('#studio-cat');
  await expect(cursor).toBeVisible();
  const box = await cursor.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box?.x ?? 0) + 3.6 - point.x)).toBeLessThan(.5);
  expect(Math.abs((box?.y ?? 0) + 2.7 - point.y)).toBeLessThan(.5);

  await page.mouse.down();
  await expect(cursor).toHaveAttribute('data-pressed', '');
  await page.mouse.up();
  await expect(page.locator('.paw-stamp')).toHaveCount(1);
  await expect(page.locator('.paw-stamp')).toHaveCount(0);

  await page.locator('a[href="mailto:ashfagan99@gmail.com"]').hover();
  await expect(cursor).toBeHidden();
  await pointerPoint(page);
  await page.keyboard.press('Tab');
  await expect(cursor).toBeHidden();

  const toggle = page.getByRole('button', { name: 'Studio Cat cursor' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await pointerPoint(page);
  await expect(cursor).toBeHidden();
  await toggle.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(toggle).toBeDisabled();
  await pointerPoint(page);
  await expect(cursor).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
  await expect(toggle).toBeDisabled();
});

test('the tabby cursor plays the supplied short sound only on completed clicks without overlapping copies', async ({ page, baseURL }, testInfo) => {
  const soundRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('studio-cat-click.m4a')) soundRequests.push(request.url());
  });
  await openHome(page);
  const audio = page.locator('#studio-cat-click-audio');
  await expect(audio).toHaveCount(1);
  await expect(audio).not.toHaveAttribute('src');
  await expect(audio).toHaveAttribute('preload', 'none');
  expect(soundRequests).toEqual([]);
  await audio.evaluate((element) => {
    element.setAttribute('data-play-starts', '[]');
    element.addEventListener('playing', () => {
      const starts = JSON.parse(element.getAttribute('data-play-starts') ?? '[]');
      starts.push((element as HTMLAudioElement).currentTime);
      element.setAttribute('data-play-starts', JSON.stringify(starts));
    });
  });

  const point = await pointerPoint(page);
  await expect(page.locator('#studio-cat .cat-outline')).toHaveAttribute('fill', '#b7a07a');
  await expect(page.locator('#studio-cat .cat-tabby-markings path')).toHaveCount(3);
  await expect(page.locator('#studio-cat .cat-muzzle')).toHaveAttribute('fill', '#eee4d0');
  await page.mouse.down();
  await page.waitForTimeout(80);
  await expect(audio).not.toHaveAttribute('src');
  await page.mouse.up();
  await expect.poll(() => audio.evaluate((element) => JSON.parse(element.getAttribute('data-play-starts') ?? '[]').length)).toBe(1);
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  const state = await audio.evaluate((element) => {
    const sound = element as HTMLAudioElement;
    return { duration: sound.duration, volume: sound.volume, loop: sound.loop, source: sound.currentSrc, error: sound.error };
  });
  expect(state.duration).toBeCloseTo(.371519, 2);
  expect(state.volume).toBe(.8);
  expect(state.loop).toBe(false);
  expect(state.error).toBeNull();
  expect(state.source).toBe(new URL('media/studio-cat-click.m4a', baseURL).href);
  for (let count = 2; count <= 4; count++) {
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => audio.evaluate((element) => JSON.parse(element.getAttribute('data-play-starts') ?? '[]').length)).toBe(count);
  }
  const starts: number[] = JSON.parse(await audio.getAttribute('data-play-starts') ?? '[]');
  expect(starts.every((time) => time < .1)).toBe(true);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).ended)).toBe(true);
  await expect(page.locator('.paw-stamp')).toHaveCount(0);
  await page.locator('#studio-cat').screenshot({ path: testInfo.outputPath('tabby-cursor.png') });
  await page.screenshot({ path: testInfo.outputPath('tabby-home.png') });
});

test('click sound stays silent on drag, text, mute, cursor-off, reduced motion, and existing media playback', async ({ page }) => {
  await openHome(page);
  const audio = page.locator('#studio-cat-click-audio');
  const mute = page.getByRole('button', { name: 'Studio Cat click sound', exact: true });
  const point = await pointerPoint(page);
  await page.mouse.down();
  await page.mouse.move(point.x + 40, point.y + 20);
  await page.mouse.up();
  await expect(audio).not.toHaveAttribute('src');
  await page.getByRole('heading', { name: 'CREATIVE PORTFOLIO', exact: true }).click();
  await expect(audio).not.toHaveAttribute('src');

  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).not.toHaveAttribute('src');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await pointerPoint(page);
  await expect(page.locator('#studio-cat')).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(audio).not.toHaveAttribute('src');
  await mute.click();

  const cursorToggle = page.getByRole('button', { name: 'Studio Cat cursor', exact: true });
  await cursorToggle.click();
  await expect(mute).toBeDisabled();
  await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).not.toHaveAttribute('src');
  await cursorToggle.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(mute).toBeDisabled();
  await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).not.toHaveAttribute('src');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  const family = page.locator('[data-video="family-memories"]');
  await family.scrollIntoViewIfNeeded();
  await family.getByRole('button', { name: 'Play Family film restoration', exact: true }).click();
  await expect.poll(() => family.locator('video').evaluate((element) => (element as HTMLVideoElement).paused)).toBe(false);
  await expect(audio).not.toHaveAttribute('src');
  await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).not.toHaveAttribute('src');
});

test('click sound stops on mute and lifecycle interruption without replaying on focus or restoration', async ({ page }) => {
  await openHome(page);
  const audio = page.locator('#studio-cat-click-audio');
  await audio.evaluate((element) => {
    element.setAttribute('data-play-count', '0');
    element.addEventListener('playing', () => {
      element.setAttribute('data-play-count', String(Number(element.getAttribute('data-play-count')) + 1));
    });
  });
  const point = await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).toHaveAttribute('data-play-count', '1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(100);
  await expect(audio).toHaveAttribute('data-play-count', '1');
  await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).toHaveAttribute('data-play-count', '2');
  await page.getByRole('button', { name: 'Studio Cat click sound', exact: true }).click();
  expect(await audio.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
  await page.getByRole('button', { name: 'Studio Cat click sound', exact: true }).click();
  await expect(audio).toHaveAttribute('data-play-count', '2');

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(audio).not.toHaveAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(audio).not.toHaveAttribute('src');
  await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(audio).toHaveAttribute('data-play-count', '3');
});

test('a failed click sound reports the failure without disabling the cursor or navigation', async ({ page }) => {
  await page.route('**/media/studio-cat-click.m4a', (route) => route.abort('failed'));
  await openHome(page);
  const point = await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('button', { name: 'Studio Cat click sound', exact: true })).toBeDisabled();
  await expect(page.locator('[data-cat-sound-status]')).toContainText('The click sound could not play');
  await expect(page.locator('.paw-stamp')).toHaveCount(0);
  await pointerPoint(page);
  await expect(page.locator('#studio-cat')).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.paw-stamp')).toHaveCount(1);
  await expect(page.locator('a[href="mailto:ashfagan99@gmail.com"]')).toHaveCount(1);
});

test('touch, pen, blur, runtime failure, and no-JavaScript keep the native pointer and complete content', async ({ browser, page, baseURL }) => {
  await openHome(page);
  await pointerPoint(page);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'pen', bubbles: true, clientX: 20, clientY: 700 })));
  await expect(page.locator('#studio-cat')).toBeHidden();
  await pointerPoint(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#studio-cat')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'Deliberate lifecycle fixture' })));
  await pointerPoint(page);
  await expect(page.locator('#studio-cat')).toBeHidden();

  const touch = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const mobile = await touch.newPage();
    await mobile.goto('./');
    await mobile.tap('.canva-page--home');
    await expect(mobile.locator('#studio-cat')).toBeHidden();
    await expect(mobile.locator('#studio-cat-click-audio')).not.toHaveAttribute('src');
    await expect(mobile.locator('[data-cat-sound-toggle]')).toBeHidden();
    expect(await mobile.evaluate(() => getComputedStyle(document.documentElement).cursor)).not.toBe('none');
  } finally {
    await touch.close();
  }

  const noScript = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const fallback = await noScript.newPage();
    await fallback.goto('./');
    await expect(fallback.getByRole('heading', { name: 'I’M ASHLEY', exact: true })).toBeVisible();
    await expect(fallback.locator('video[controls]')).toHaveCount(8);
    await expect(fallback.locator('[data-effects-toggle]')).toBeHidden();
    await expect(fallback.locator('[data-cat-sound-toggle]')).toBeHidden();
    await expect(fallback.locator('#studio-cat-click-audio')).not.toHaveAttribute('src');
    await expect(fallback.locator('html')).not.toHaveAttribute('data-js', 'on');
    await expect(fallback.locator('[data-hero-entry]').first().locator('.canva-media')).not.toHaveCSS('transform', 'matrix(0, 0, 0, 0, 0, 0)');
    await expect(fallback.locator('.canva-page--about noscript img').first()).toBeVisible();
    await fallback.getByRole('link', { name: "Read Ashley's complete 15-page newsletter" }).click();
    await fallback.getByRole('link', { name: 'Next page, 2', exact: true }).click();
    await expect(fallback.locator('.reader-count')).toHaveText('Page 2 of 15');
  } finally {
    await noScript.close();
  }
});

test('accessibility checks isolate the three source contrast limitations and verify the higher-contrast mode', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(home.violations.map((violation) => violation.id)).toEqual(['color-contrast']);
  const contrast = home.violations[0];
  const sourceLabels = ['LBWPvcb2GzhJDZFn', 'LB8mM0fHTx6kH9BF', 'LBt9gBGMBZmjFFnZ'].sort();
  expect(contrast.nodes.map((node) => JSON.stringify(node.target).match(/LB[a-zA-Z0-9]+/)?.[0]).sort()).toEqual(sourceLabels);
  for (const node of contrast.nodes) {
    const measurement = node.any.find((check) => check.id === 'color-contrast')?.data;
    expect(measurement?.fgColor).toBe('#a6a6a6');
    expect(measurement?.bgColor).toBe('#ffffff');
    expect(measurement?.contrastRatio).toBeCloseTo(2.43, 2);
  }
  await testInfo.attach('source-contrast-limitations', { body: JSON.stringify(contrast.nodes, null, 2), contentType: 'application/json' });
  await page.emulateMedia({ contrast: 'more' });
  const enhanced = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(enhanced.violations).toEqual([]);
  await page.goto('newsletter/13/');
  const reader = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(reader.violations).toEqual([]);
});

test('the first settled mobile load stays local and does not fetch videos or the PDF', async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('./', { waitUntil: 'networkidle' });
    const metrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource').filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming);
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        transferBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0) + (navigation instanceof PerformanceNavigationTiming ? navigation.transferSize : 0),
        resources: entries.map((entry) => ({ url: entry.name, bytes: entry.transferSize })),
      };
    });
    await testInfo.attach('mobile-transfer', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
    expect(metrics.transferBytes).toBeGreaterThan(0);
    expect(metrics.transferBytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(requests.filter((url) => /\.mp4(?:\?|$)|\.pdf(?:\?|$)/.test(url))).toEqual([]);
    expect(requests.filter((url) => /studio-cat-click\.m4a/.test(url))).toEqual([]);
    expect(requests.filter((url) => /\/newsletter-motion\/.*\.webp/.test(url))).toEqual([]);
    expect(requests.some((url) => /\/fidelity\/newsletter-cover-640\.webp(?:\?|$)/.test(url))).toBe(true);
    expect(requests.some((url) => /\/documents\/newsletter-01\.webp(?:\?|$)/.test(url))).toBe(false);
    expect(aboutDeferredImage).toBeTruthy();
    expect(requests.some((url) => new URL(url).pathname.endsWith(aboutDeferredImage ?? ''))).toBe(true);
    expect(distantDeferredImage).toBeTruthy();
    expect(requests.some((url) => new URL(url).pathname.endsWith(distantDeferredImage ?? ''))).toBe(false);
    const ambientPosterPaths = ambientVideos.map((role) => videoInventory[role].poster);
    expect(requests.filter((url) => ambientPosterPaths.some((poster) => new URL(url).pathname.endsWith(poster)))).toEqual([]);
    const origin = new URL(baseURL ?? '').origin;
    expect(requests.filter((url) => /^https?:/.test(url) && new URL(url).origin !== origin)).toEqual([]);
  } finally {
    await context.close();
  }
});

test('the exact deployment prefix survives document navigation, 404 recovery, and browser back', async ({ page, baseURL }, testInfo) => {
  await openHome(page);
  const reader = page.locator('[data-newsletter-reader]');
  await reader.scrollIntoViewIfNeeded();
  await reader.locator('summary[aria-label="More newsletter options"]').click();
  await reader.getByRole('link', { name: 'Open standalone reader' }).click();
  expect(page.url().startsWith(baseURL ?? '')).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'CREATIVE PORTFOLIO', exact: true })).toBeVisible();
  await pointerPoint(page);
  await expect(page.locator('#studio-cat')).toBeVisible();
  await page.goto('404.html');
  await page.getByRole('link', { name: "Back to Ashley's portfolio" }).click();
  await expect(page).toHaveURL(baseURL ?? '');
  if (testInfo.project.name === 'pages') await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  else await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});
