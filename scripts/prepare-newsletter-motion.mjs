import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const input = path.join(root, 'research', 'newsletter-motion');
const output = path.join(root, 'public', 'media', 'newsletter-motion');
const source = JSON.parse(await readFile(path.join(input, 'source.json'), 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const publicPath = (file) => `/media/newsletter-motion/${file}`;
const expectedRoles = ['heart-moth', 'luna-moth', 'orange-butterfly', 'star-moth'];
assert.deepEqual(source.assets.map((asset) => asset.role).sort(), expectedRoles);
assert.deepEqual(source.pages.map((page) => page.number), [1, 2, 3]);
await mkdir(output, { recursive: true });

const assets = new Map();
const provenance = [];
for (const asset of source.assets) {
  assert.equal(path.basename(asset.file), asset.file);
  const bytes = await readFile(path.join(input, asset.file));
  assert.equal(sha(bytes), asset.sha256, `Source animation drifted: ${asset.role}`);
  const metadata = await sharp(bytes, { animated: true }).metadata();
  assert.ok(metadata.pages > 1 && metadata.pages <= 60 && metadata.pageHeight);
  assert.equal(metadata.loop, 0, 'The source GIFs loop continuously.');
  assert.equal(metadata.delay.length, metadata.pages);
  assert.ok(metadata.delay.every((delay) => delay > 0));
  const filename = `${asset.role}.webp`;
  await copyFile(path.join(input, asset.file), path.join(output, filename));
  const still = await sharp(bytes).webp({ lossless: true }).toBuffer();
  const stillName = `${asset.role}-still.webp`;
  await writeFile(path.join(output, stillName), still);
  assets.set(asset.role, { src: publicPath(filename), still: publicPath(stillName) });
  provenance.push({
    role: asset.role, sourceAsset: asset.sourceAsset, sourceSha256: asset.sha256,
    output: publicPath(filename), sha256: sha(bytes), bytes: bytes.length,
    width: metadata.width, height: metadata.pageHeight, frames: metadata.pages,
    delaysMs: metadata.delay, loop: metadata.loop,
    still: { output: publicPath(stillName), sha256: sha(still), bytes: still.length },
    method: 'Original source-loaded animated WebP bytes preserved without recompression, frame resampling or timing changes.',
  });
}

const pages = [];
for (const page of source.pages) {
  assert.equal(path.basename(page.file), page.file);
  const inputBytes = await readFile(path.join(input, page.file));
  assert.equal(sha(inputBytes), page.sha256, `Source background drifted: page ${page.number}`);
  const background = await sharp(inputBytes).webp({ quality: 93, effort: 6 }).toBuffer();
  const metadata = await sharp(background).metadata();
  assert.equal(metadata.width, 1203);
  assert.equal(metadata.height, 1700);
  const filename = `page-${String(page.number).padStart(2, '0')}-background.webp`;
  await writeFile(path.join(output, filename), background);
  assert.equal(page.layers.length, 2);
  const layers = page.layers.map((layer) => {
    assert.ok(assets.has(layer.role));
    for (const key of ['x', 'y', 'width', 'height', 'rotation']) assert.ok(Number.isFinite(layer[key]));
    return { ...layer, ...assets.get(layer.role) };
  });
  pages.push({ number: page.number, background: publicPath(filename), width: metadata.width, height: metadata.height, layers });
  provenance.push({
    page: page.number, sourceSha256: page.sha256, output: publicPath(filename),
    sha256: sha(background), bytes: background.length,
    method: 'Original rendered artboard with only animated image nodes and viewer chrome hidden; no painted or inferred background patches.',
  });
}
await writeFile(path.join(root, 'src', 'content', 'newsletter-motion.json'), JSON.stringify({
  version: 1, source: source.source, recordingSha256: source.recordingSha256,
  pages, provenance,
}, null, 2) + '\n');
console.log(`Prepared ${pages.length} animated newsletter pages, six placements and ${assets.size} original animation assets.`);
