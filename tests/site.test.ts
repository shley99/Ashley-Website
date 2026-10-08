import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { withBase, newsletterPath } from '../src/lib/site.ts';

test('root and project paths keep their prefix, including anchors and documents', () => {
  for (const base of ['/', '/ashley-naoko/', '/ashley-naoko']) {
    const prefix = base.replace(/\/$/, '');
    for (const resource of ['/', '/#digital', '/fonts/partita-1990.woff2', '/fidelity/8e9790e8e0350d8b.webp', '/documents/ashley-naoko-newsletter.pdf', '/media/videos/family-memories.mp4', '/newsletter/15/']) {
      assert.equal(withBase(resource, base), prefix + resource);
    }
  }
  for (const bad of ['https://example.com', '//example.com/image', 'relative.webp']) {
    assert.throws(() => withBase(bad, '/'), /root-relative/);
  }
  assert.throws(() => withBase('/', '//example.com/'), /Invalid site base/);
  assert.throws(() => withBase('/', '/../'), /Invalid site base/);
});

test('all fifteen document paths are unique and invalid page numbers fail', () => {
  const routes = Array.from({ length: 15 }, (_, index) => newsletterPath(index + 1));
  assert.equal(new Set(routes).size, 15);
  assert.equal(routes[0], '/newsletter/');
  assert.equal(routes[14], '/newsletter/15/');
  for (const invalid of [0, 16, -1, 2.5, NaN, Infinity]) assert.throws(() => newsletterPath(invalid));
});

function luminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi);
  assert.ok(channels && channels.length === 3);
  const [r, g, b] = channels.map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}
const contrast = (first: string, second: string) => {
  const colors = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (colors[0] + .05) / (colors[1] + .05);
};

test('the actual brand pairs meet normal and large text contrast thresholds', async () => {
  const css = await readFile(path.join('src', 'styles', 'global.css'), 'utf8');
  const token = (name: string) => {
    const match = css.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6});`, 'i'));
    assert.ok(match, `Missing color token ${name}`);
    return match[1];
  };
  assert.ok(contrast(token('ink'), token('lavender')) >= 4.5);
  assert.ok(contrast(token('ink'), token('paper')) >= 4.5);
  assert.ok(contrast(token('muted-ink'), token('paper')) >= 4.5);
  assert.ok(contrast(token('ink'), token('pink')) >= 4.5);
  assert.ok(contrast(token('white'), token('lavender')) >= 3);
});

test('all media roles are local and the complete document and clip inventory persist', async () => {
  const images = JSON.parse(await readFile(path.join('src', 'content', 'media.json'), 'utf8'));
  const videos = JSON.parse(await readFile(path.join('src', 'content', 'videos.json'), 'utf8'));
  const newsletter = JSON.parse(await readFile(path.join('src', 'content', 'newsletter.json'), 'utf8'));
  assert.equal(Object.keys(videos).length, 8);
  assert.equal(newsletter.pages.length, 15);
  assert.deepEqual(newsletter.pages.filter((page: { previewQuality: boolean }) => page.previewQuality).map((page: { number: number }) => page.number), [13, 14, 15]);
  assert.ok(Object.keys(images).length >= 60);
  for (const page of newsletter.pages) {
    assert.ok(page.paragraphs.length > 0);
    assert.ok(page.width > 0 && page.height > 0);
    assert.ok((await stat(path.join('public', page.src))).size > 0);
  }
  for (const key of ['wordmark', 'ashley-and-cat', 'christmas-card', 'glass-tumbler', 'dancing-cat']) {
    assert.ok(images[key]);
    assert.ok((await stat(path.join('public', images[key].src))).size > 0);
  }
});

test('the cursor sound is the recorded small audio-only asset, not its source video', async () => {
  const sound = JSON.parse(await readFile(path.join('src', 'content', 'cursor-audio.json'), 'utf8'));
  const bytes = await readFile(path.join('public', sound.src));
  assert.equal(bytes.length, sound.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sound.sha256);
  assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  assert.ok(sound.durationSeconds > 0 && sound.durationSeconds < 1);
  assert.ok(bytes.length < 16 * 1024);
  assert.equal(sound.src, '/media/studio-cat-click.m4a');
});

test('newsletter motion retains the observed six placements and original frame timing', async () => {
  const motion = JSON.parse(await readFile(path.join('src', 'content', 'newsletter-motion.json'), 'utf8'));
  const reference = JSON.parse(await readFile(path.join('tests', 'fixtures', 'newsletter-recording.json'), 'utf8'));
  assert.equal(motion.recordingSha256, reference.recordingSha256);
  assert.deepEqual(motion.pages.map((page: { number: number }) => page.number), [1, 2, 3]);
  for (const page of motion.pages) {
    assert.deepEqual(page.layers.map((layer: { role: string }) => layer.role).sort(), reference.pageRoles[page.number]);
    const background = await sharp(path.join('public', page.background)).metadata();
    assert.equal(background.width, 1203);
    assert.equal(background.height, 1700);
  }
  for (const [role, expected] of Object.entries(reference.assets) as [string, { sha256: string; frames: number; delay: number }][]) {
    const bytes = await readFile(path.join('public', 'media', 'newsletter-motion', `${role}.webp`));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
    const metadata = await sharp(bytes, { animated: true }).metadata();
    assert.equal(metadata.pages, expected.frames);
    assert.deepEqual(metadata.delay, Array(expected.frames).fill(expected.delay));
    assert.equal(metadata.loop, 0);
    const still = await sharp(path.join('public', 'media', 'newsletter-motion', `${role}-still.webp`), { animated: true }).metadata();
    assert.ok(!still.pages || still.pages === 1);
  }
});
