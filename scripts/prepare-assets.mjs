import { copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = path.resolve(import.meta.dirname, '..');
const research = path.join(root, 'research');
const originals = path.join(research, 'originals');
const publicRoot = path.join(root, 'public');
const mediaRoot = path.join(publicRoot, 'media');
const contentRoot = path.join(root, 'src', 'content');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'));
const json = (value) => JSON.stringify(value, null, 2) + '\n';
// The owner-licensed display font is retained, not replaced by a package download.
const displayFont = await readFile(path.join(publicRoot, 'fonts', 'partita-1990.woff2'));
if (displayFont.toString('ascii', 0, 4) !== 'wOF2') throw new Error('Prepare the licensed Partita 1990 WOFF2 before regenerating assets.');
await readFile(path.join(publicRoot, 'fonts', 'partita-1990-NOTICE.txt'), 'utf8');
let previousOutputs = [];
try {
  const prior = await readJSON(path.join(contentRoot, 'provenance.json'));
  previousOutputs = prior.assets.flatMap((asset) => asset.outputs.map((output) => output.path));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

for (const directory of [mediaRoot, contentRoot, path.join(mediaRoot, 'videos'), path.join(publicRoot, 'documents'), path.join(publicRoot, 'fonts')]) {
  await mkdir(directory, { recursive: true });
}

async function manifests(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await manifests(file));
    else if (entry.name === 'capture-manifest.json') result.push(file);
  }
  return result;
}

const inventory = await readJSON(path.join(research, 'source-inventory.json'));
for (const file of await manifests(path.join(research, 'download'))) {
  const capture = await readJSON(file);
  if (capture.status !== 'complete' || capture.response.status !== 200 || capture.access_wall) throw new Error(`Incomplete source download: ${file}`);
  const url = new URL(capture.requested_url);
  if (url.origin !== 'https://ashleynaoko.com' || !url.pathname.startsWith('/_assets/')) throw new Error(`Unexpected source origin: ${url.origin}`);
  const download = capture.downloads[0];
  const bytes = await readFile(path.join(path.dirname(file), download.path));
  const hash = sha(bytes);
  if (download.truncated || bytes.length !== download.byte_size || `sha256:${hash}` !== download.sha256) throw new Error(`Source integrity failure: ${file}`);
  const filename = path.basename(url.pathname);
  await writeFile(path.join(originals, filename), bytes);
  if (!inventory.assets.some((asset) => asset.filename === filename)) {
    inventory.assets.push({ url: url.href, filename, bytes: bytes.length, sha256: hash, type: download.mime_type, status: 200, state: 'recovered' });
  }
}

const sourceFiles = await readdir(originals);
function source(prefix) {
  const matches = sourceFiles.filter((file) => file.startsWith(prefix));
  if (matches.length !== 1) throw new Error(`Expected one source for ${prefix}; found ${matches.length}.`);
  return path.join(originals, matches[0]);
}

const images = {};
const provenance = [];
async function record(key, input, options, outputFiles) {
  const original = inventory.assets.find((asset) => asset.filename === path.basename(input));
  provenance.push({ key, source: original?.url ?? 'https://www.canva.com/design/DAG9wT14HXc/iZuVBjOrBccbwgqGl9ChFw/view', sourceSha256: sha(await readFile(input)), recipe: options, outputs: outputFiles });
}

async function prepareImage(key, prefix, maxWidth = 960, options = {}) {
  const input = source(prefix);
  let image = sharp(input);
  if (options.rotate) image = image.rotate(options.rotate);
  if (options.sprite) {
    const { data, info } = await image.extract({ left: 0, top: 0, width: options.sprite[0], height: options.sprite[1] }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
    const color = options.color ?? [255, 204, 221];
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let pixel = 0; pixel < data.length; pixel++) {
      rgba[pixel * 4] = color[0];
      rgba[pixel * 4 + 1] = color[1];
      rgba[pixel * 4 + 2] = color[2];
      rgba[pixel * 4 + 3] = data[pixel];
    }
    image = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim();
  } else if (options.trim) {
    image = image.trim();
  }
  const normalized = await image.png().toBuffer();
  const metadata = await sharp(normalized).metadata();
  const maximum = Math.min(maxWidth, metadata.width);
  const widths = [...new Set([240, 480, 800, maximum].filter((width) => width <= maximum))].sort((a, b) => a - b);
  const variants = [];
  const outputFiles = [];
  for (const width of widths) {
    const filename = `${key}-${width}.webp`;
    const bytes = await sharp(normalized).resize({ width, withoutEnlargement: true }).webp({ quality: options.quality ?? 87, effort: 5 }).toBuffer();
    await writeFile(path.join(mediaRoot, filename), bytes);
    variants.push({ src: `/media/${filename}`, width });
    outputFiles.push({ path: `media/${filename}`, bytes: bytes.length, sha256: sha(bytes) });
  }
  images[key] = { src: variants.at(-1).src, width: maximum, height: Math.round(metadata.height * maximum / metadata.width), variants };
  await record(key, input, { maxWidth, ...options }, outputFiles);
}

const cutouts = [
  ['camcorder', '588e626d39', 640], ['welding-helmet', '914a852ad4', 480],
  ['origami-crane', '9426e8344a', 640], ['thread', '8bb45e12c6', 480],
  ['paint-tube', '8b5ddf47b1', 320], ['paintbrush', '540f1403a8', 640],
  ['laptop', '6305009e4f', 640], ['printer', '7ba60fa191', 800],
  ['laser-cutter', '438ffcb50a', 480], ['lino-block', 'f704aab4ad', 480],
  ['carving-tool', '7790336b34', 480], ['wordmark', '25e421797a', 800],
  ['globe', 'ad8dcc4917', 900], ['laptop-friend', 'c7d81c4919', 320],
  ['ashley-and-cat', '0056ce0c18', 720], ['pink-stars', 'bf7caf0398', 320],
  ['cat-doodle', '330fc525e1', 320], ['bunny', 'e971c5be71', 320],
  ['kewpie', '0fc8449f2b', 240], ['nail-polish', 'a155ac6e8e', 200],
  ['snowboarder', '2fef533b63', 320], ['butterfly', 'ec16d88604', 320],
  ['onigiri', 'b88e5d5700', 320], ['fishing-rod', 'a0c49242d3', 480],
  ['switch', 'bcfd8af63c', 480], ['television', 'b56764d276', 1000],
  ['tape', '4b455b0151', 480], ['curved-arrow', '796330a606', 320],
  ['glass-tumbler', '0a8ed2fcd1', 1000], ['printer-front', '516229eac9', 800],
  ['sticker-so-full', '8848169277', 320], ['sticker-listening', '3756f36c94', 320],
  ['sticker-confused', '49d737513f', 320], ['sticker-bye', '0827496aca', 320],
  ['sticker-bangin', 'c7c5eaf17b', 320], ['sticker-nuts', '15a8c4379c', 320],
  ['sticker-cat', 'a2404a93ff', 320], ['sticker-surprised', '866ed4e1e9', 320],
  ['sticker-yo', '973f4f38da', 320],
];
for (const [key, prefix, width] of cutouts) await prepareImage(key, prefix, width, { trim: true });
for (const [key, prefix, width] of [
  ['christmas-card', 'ea0c192ecd', 1200], ['youtube-avatar', '030db99fa5', 240],
  ['welding', 'fdc0b39587', 960], ['tinkercad', '2926d413e1', 1200],
  ['slicer', '417a55c00f', 1200], ['laser-design', 'd2a8996ae7', 1200],
  ['portrait-prints', 'eaeb322cb8', 1000], ['workshop-group', 'fcd94909ad', 1000],
  ['greeting-cards', 'e3172a404a', 960], ['holiday-card', 'f845d4ed59', 720],
  ['community-table', 'bb01d75bd8', 1000],
]) await prepareImage(key, prefix, width, key === 'christmas-card' ? { rotate: 90 } : {});
for (const [key, prefix, sprite] of [
  ['doodle-stars', '050cd1cf9e', [744, 800]], ['doodle-confetti', '26d90d67dd', [800, 696]],
  ['doodle-rays', '694880e0c2', [800, 378]], ['doodle-clouds', '9c8f9b8074', [800, 730]],
  ['doodle-lines', 'e67829402b', [386, 800]], ['doodle-hearts', 'e5ac176328', [800, 607]],
  ['doodle-coil', 'd1bd1b90bd', [524, 800]], ['doodle-flowers', '726b9e7495', [800, 699]],
  ['doodle-arrow', '173d2ea82c', [800, 615]],
]) await prepareImage(key, prefix, 480, { sprite, color: key === 'doodle-arrow' ? [49, 30, 64] : [255, 211, 226] });

for (const [key, prefix, width] of [
  ['dancing-cat', '95e41688be', 240], ['printed-mug', 'c88899f686', 480], ['engraved-cup', '62e9b4f2c', 400],
]) {
  const input = source(prefix);
  const still = await sharp(input).resize({ width }).webp({ quality: 90 }).toBuffer();
  const animation = await sharp(input, { animated: true }).resize({ width }).webp({ quality: 82, effort: 5, loop: 0 }).toBuffer();
  const output = await sharp(animation, { animated: true }).metadata();
  if (!output.pages || output.pages < 2) throw new Error(`Animation lost its frames: ${key}`);
  await writeFile(path.join(mediaRoot, `${key}.webp`), still);
  await writeFile(path.join(mediaRoot, `${key}-animated.webp`), animation);
  images[key] = { src: `/media/${key}.webp`, width, height: output.pageHeight, animated: `/media/${key}-animated.webp`, variants: [{ src: `/media/${key}.webp`, width }] };
  await record(key, input, { width, format: 'animated-webp', loops: 'continuous', sourceTiming: true, staticAlternative: true }, [
    { path: `media/${key}.webp`, bytes: still.length, sha256: sha(still) },
    { path: `media/${key}-animated.webp`, bytes: animation.length, sha256: sha(animation) },
  ]);
}
await writeFile(path.join(contentRoot, 'media.json'), json(images));
console.log(`Prepared ${Object.keys(images).length} image and animation roles.`);

const videos = {};
const videoList = [
  ['family-memories', '57a7bc93d43', 'Family film restoration'],
  ['japan-march', 'ea3b7cc970', 'March - Life in Japan'],
  ['japan-february', '620df96271', 'February - Life in Japan'],
  ['laser-engraving', 'c48369c7d8', 'Laser engraving a tumbler'],
  ['portrait-stamp', '2b97cf522b', 'Carving and printing a portrait stamp'],
  ['carving-block', '5f46331bc7', 'Hand-carved linoleum block'],
  ['pulling-print', 'e6555fb3b6', 'Pulling a print by hand'],
  ['stamp-workshop', '3ba521f599', 'Stamp-carving workshop'],
];
const declaredPosters = { 'family-memories': '245d32f33c', 'japan-march': '02a85b831c', 'japan-february': '25744b1a2c' };
const probe = (file) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', file], { encoding: 'utf8', windowsHide: true }));
const encoderRecipe = 'libx264-slow-crf24-yuv420p-aac128-faststart-v1';
const cacheFile = path.join(research, 'prepared-video-cache.json');
let cache = {};
try { cache = await readJSON(cacheFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const mappedPlayers = [];
for (const [key, prefix, title] of videoList) {
  const input = source(prefix);
  const inputHash = sha(await readFile(input));
  const output = path.join(mediaRoot, 'videos', `${key}.mp4`);
  const expected = `${encoderRecipe}:${inputHash}`;
  let reusable = false;
  if (cache[key]?.recipe === expected) {
    try { reusable = sha(await readFile(output)) === cache[key].sha256; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!reusable) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  }
  const metadata = probe(output);
  const originalMetadata = probe(input);
  const video = metadata.streams.find((stream) => stream.codec_type === 'video');
  const duration = Number(metadata.format.duration);
  if (!video || !Number.isFinite(duration) || Math.abs(duration - Number(originalMetadata.format.duration)) > 0.15) throw new Error(`Incomplete video conversion: ${key}`);
  const bytes = await readFile(output);
  const hash = sha(bytes);
  cache[key] = { recipe: expected, sha256: hash };
  await writeFile(cacheFile, json(cache));
  const posterSource = declaredPosters[key] ? source(declaredPosters[key]) : undefined;
  const frame = posterSource ? await readFile(posterSource) : execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', '0.4', '-i', output, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', 'pipe:1'], { maxBuffer: 12 * 1024 * 1024, windowsHide: true });
  const poster = await sharp(frame).resize({ width: Math.min(960, video.width), withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  await writeFile(path.join(mediaRoot, `${key}-poster.webp`), poster);
  videos[key] = { title, src: `/media/videos/${key}.mp4`, poster: `/media/${key}-poster.webp`, width: video.width, height: video.height, duration, hasAudio: metadata.streams.some((stream) => stream.codec_type === 'audio') };
  mappedPlayers.push({ key, title, source: inventory.assets.find((asset) => asset.filename === path.basename(input)).url, duration: Number(originalMetadata.format.duration), width: video.width, height: video.height, method: 'Declared progressive-file identity, poster association, complete download hash and ffprobe' });
  await record(key, input, { encoder: encoderRecipe, poster: posterSource ? { source: inventory.assets.find((asset) => asset.filename === path.basename(posterSource)).url, sha256: sha(frame) } : { method: 'frame at 0.4 seconds from the prepared video' } }, [
    { path: `media/videos/${key}.mp4`, bytes: bytes.length, sha256: hash },
    { path: `media/${key}-poster.webp`, bytes: poster.length, sha256: sha(poster) },
  ]);
  console.log(`Prepared ${key}: ${duration.toFixed(1)} seconds, ${(bytes.length / 1048576).toFixed(1)} MiB.`);
}
await writeFile(path.join(contentRoot, 'videos.json'), json(videos));
inventory.inventory.players = mappedPlayers;
await writeFile(path.join(research, 'source-inventory.json'), json(inventory));
await writeFile(path.join(research, 'players.json'), json({ method: 'Corrected identity-based recovery; supersedes invalid broad-ancestor matching.', players: mappedPlayers }));

const document = await readJSON(path.join(research, 'newsletter', 'newsletter.json'));
const newsletter = { title: 'Monthly newsletters', edition: 'Independent image edition with selectable page text', source: document.source, missingExports: document.missingExports, pages: [] };
const pdf = await PDFDocument.create();
const newsletterEditionDate = new Date('2026-10-01T20:24:23.000Z');
pdf.setTitle('Ashley Naoko - Newsletter portfolio (image edition)');
pdf.setAuthor('Ashley Naoko');
pdf.setSubject('An independent image edition. Pages 13-15 use the available public previews, not high-resolution exports.');
pdf.setCreationDate(newsletterEditionDate);
pdf.setModificationDate(newsletterEditionDate);
const pdfFont = await pdf.embedFont(StandardFonts.Helvetica);
for (const page of document.pages) {
  const input = path.join(research, 'newsletter', page.publicPreview?.filename ?? page.filename);
  const image = sharp(input);
  const dimensions = await image.metadata();
  const filename = `newsletter-${String(page.number).padStart(2, '0')}.webp`;
  const bytes = await image.webp({ quality: 93, effort: 5 }).toBuffer();
  await writeFile(path.join(publicRoot, 'documents', filename), bytes);
  const seen = new Set();
  const paragraphs = page.paragraphs.flatMap((paragraph) => {
    const text = paragraph.text.replace(/\u00a0/g, ' ').trim();
    if (!text || seen.has(text)) return [];
    seen.add(text);
    return [{ text, lang: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text) ? 'ja' : 'en' }];
  });
  const links = [];
  for (const link of page.links) {
    const parsed = new URL(link.href);
    const href = parsed.origin === 'https://www.canva.com' && parsed.pathname === '/link' ? parsed.searchParams.get('target') : parsed.href;
    if (!href || !href.startsWith('https://') || links.some((item) => item.href === href)) continue;
    links.push({ href, text: link.text.trim() || 'Original reference link' });
  }
  newsletter.pages.push({ number: page.number, src: `/documents/${filename}`, width: dimensions.width, height: dimensions.height, previewQuality: Boolean(page.publicPreview), paragraphs, links });
  const jpg = await image.flatten({ background: '#ffffff' }).jpeg({ quality: 91, mozjpeg: true }).toBuffer();
  const embedded = await pdf.embedJpg(jpg);
  const pdfPage = pdf.addPage([595.28, 861.89]);
  pdfPage.drawImage(embedded, { x: 0, y: 20, width: 595.28, height: 841.89 });
  pdfPage.drawText(`Page ${page.number} of 15${page.publicPreview ? ' - Public preview quality; high-resolution export pending.' : ' - Independent image edition.'}`, { x: 22, y: 7, font: pdfFont, size: 8, color: rgb(0.25, 0.2, 0.3) });
  await record(`newsletter-${page.number}`, input, { format: 'webp', quality: 93, publicPreview: Boolean(page.publicPreview), noUpscaling: true }, [{ path: `documents/${filename}`, bytes: bytes.length, sha256: sha(bytes) }]);
}
if (newsletter.pages.length !== 15) throw new Error('The complete 15-page document is required.');
await writeFile(path.join(contentRoot, 'newsletter.json'), json(newsletter));
await writeFile(path.join(publicRoot, 'documents', 'ashley-naoko-newsletter.pdf'), await pdf.save());

for (const [family, style, filename] of [
  ['montserrat', 'normal', 'montserrat.woff2'],
  ['montserrat', 'italic', 'montserrat-italic.woff2'],
  ['roboto', 'normal', 'roboto.woff2'],
  ['dm-sans', 'normal', 'dm-sans.woff2'],
]) {
  const directory = path.join(root, 'node_modules', '@fontsource-variable', family);
  await copyFile(path.join(directory, 'files', `${family}-latin-wght-${style}.woff2`), path.join(publicRoot, 'fonts', filename));
  await copyFile(path.join(directory, 'LICENSE'), path.join(publicRoot, 'fonts', `${family}-OFL.txt`));
}
{
  const directory = path.join(root, 'node_modules', '@fontsource', 'silkscreen');
  await copyFile(path.join(directory, 'files', 'silkscreen-latin-400-normal.woff2'), path.join(publicRoot, 'fonts', 'silkscreen.woff2'));
  await copyFile(path.join(directory, 'LICENSE'), path.join(publicRoot, 'fonts', 'silkscreen-OFL.txt'));
}
await writeFile(path.join(contentRoot, 'provenance.json'), json({ permission: 'The commissioning user confirmed owner permission to reproduce the existing portfolio and assets.', source: 'https://ashleynaoko.com/', assets: provenance }));
const currentOutputs = new Set(provenance.flatMap((asset) => asset.outputs.map((output) => output.path)));
for (const previous of previousOutputs.filter((file) => !currentOutputs.has(file))) {
  const target = path.resolve(publicRoot, previous);
  if (!target.startsWith(publicRoot + path.sep) || !/^(?:media|documents)\//.test(previous)) throw new Error(`Refusing to remove an unmanaged asset: ${previous}`);
  try { await unlink(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Prepared ${newsletter.pages.length} document pages, a real image-edition PDF, and licensed local fonts.`);
const outputSizes = await Promise.all(provenance.flatMap((item) => item.outputs).map(async (output) => (await stat(path.join(publicRoot, output.path))).size));
console.log(`Public assets: ${(outputSizes.reduce((sum, size) => sum + size, 0) / 1048576).toFixed(1)} MiB.`);
