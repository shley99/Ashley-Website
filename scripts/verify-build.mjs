import assert from 'node:assert/strict';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

export const artifactTopLevel = new Set(['index.html', '404.html', 'favicon.svg', 'robots.txt', '.nojekyll', '_astro', 'fidelity', 'media', 'fonts', 'documents', 'newsletter']);
export async function artifactFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!prefix && entry.name === '.git') continue;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in the published artifact: ${entry.name}`);
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await artifactFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unexpected artifact entry: ${relative}`);
  }
  return files;
}

export async function verifyBuild(directory, { base = '/', preview = false, allowGit = false } = {}) {
  const root = path.resolve(directory);
  assert.ok(base.startsWith('/') && base.endsWith('/'));
  for (const entry of await readdir(root)) {
    if (entry === '.git' && allowGit) {
      const metadata = await lstat(path.join(root, entry));
      assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), 'Git metadata must be a local directory.');
      continue;
    }
    assert.ok(artifactTopLevel.has(entry), `Unexpected published root entry: ${entry}`);
  }
  const files = await artifactFiles(root);
  assert.ok(files.includes('.nojekyll'), 'The Pages artifact must include .nojekyll.');
  assert.ok(!files.some((file) => /(?:^|[\\/])(?:CNAME|\.git|\.env|node_modules|research|src|tests)(?:[\\/]|$)|\.(?:map|ts|astro|md)$/i.test(file)), 'Private/development files must not be published.');
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  assert.equal(htmlFiles.length, 17, 'Expected the portfolio, fifteen newsletter pages, and 404.');
  const rootHTML = await readFile(path.join(root, 'index.html'), 'utf8');
  const font = await readFile(path.join(root, 'fonts', 'partita-1990.woff2'));
  assert.equal(font.toString('ascii', 0, 4), 'wOF2', 'Partita 1990 must be a real WOFF2 file.');
  assert.ok(rootHTML.includes(`${base}fonts/partita-1990.woff2`), 'The selected display font must load beneath the deployment prefix.');
  assert.ok((await readFile(path.join(root, 'fonts', 'partita-1990-NOTICE.txt'), 'utf8')).includes('Stefano Giliberti'), 'The display font attribution must ship with the font.');
  assert.equal((rootHTML.match(/<video\b/g) ?? []).length, 8, 'All eight portfolio clips must be present.');
  assert.equal((rootHTML.match(/id="studio-cat-click-audio"/g) ?? []).length, 1, 'Expected one reusable cursor sound player.');
  assert.equal((rootHTML.match(/data-canva-node-id=/g) ?? []).length, 162, 'All 162 source-rendered nodes must be present.');
  assert.equal((rootHTML.match(/data-source-video-mode="poster"/g) ?? []).length, 3, 'Expected three source poster videos.');
  assert.equal((rootHTML.match(/data-source-video-mode="ambient"/g) ?? []).length, 5, 'Expected five source ambient videos.');
  assert.equal((rootHTML.match(/<h1\b/g) ?? []).length, 1);
  const headings = [...rootHTML.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/g)]
    .map((match) => match[1].replace(/<[^>]*>/g, ''));
  for (const section of ['about', 'digital', 'physical', 'contact']) assert.ok(rootHTML.includes(`id="${section}"`), `Missing ${section} section.`);
  for (const title of ['EDITORIAL DESIGN', 'GRAPHIC DESIGN', 'VIDEO EDITING', '3D PRINTING', 'LASER CUTTING', 'PRINTMAKING', 'WELDING']) {
    assert.ok(headings.some((heading) => heading.includes(title)), `Missing project heading: ${title}`);
  }
  assert.ok(rootHTML.includes('mailto:ashfagan99@gmail.com'));
  assert.ok(rootHTML.includes('tel:+18315788657'));
  assert.ok(rootHTML.includes('https://www.youtube.com/@ashleynaoko'));
  assert.ok(!rootHTML.includes('<iframe'), 'The portfolio must not require a Canva or YouTube runtime embed.');
  assert.ok(!rootHTML.includes('autoplay'), 'Ambient playback must remain an enhanced in-view behavior, not eager HTML autoplay.');
  const pageHTML = new Map(await Promise.all(htmlFiles.map(async (file) => [file, await readFile(path.join(root, file), 'utf8')])));
  const origin = 'https://artifact.invalid';
  for (const [file, html] of pageHTML) {
    assert.ok(!/(?:src|poster)=["']https?:\/\//i.test(html), `Remote runtime asset in ${file}`);
    assert.ok(!/https?:\/\/[^"' ]*canva\.com/i.test(html), `Canva dependency in ${file}`);
    assert.equal(/name="robots" content="noindex, nofollow"/.test(html), preview, `Incorrect indexing policy in ${file}`);
    const route = `${base}${file.replaceAll(path.sep, '/').replace(/index\.html$/, '')}`;
    const references = [...html.matchAll(/\b(?:href|src|poster|data-image-src|data-poster|data-still-src|data-animated-src|data-click-sound-src)=["']([^"']+)["']/g)].map((match) => match[1].replaceAll('&amp;', '&'));
    const newsletterData = html.match(/\bdata-newsletter-pages="([^"]+)"/)?.[1];
    if (newsletterData) {
      const pages = JSON.parse(newsletterData.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&'));
      assert.deepEqual(pages.filter((page) => page.motion).map((page) => page.number), [1, 2, 3], 'Only the recorded newsletter pages may contain animation layers.');
      for (const page of pages) {
        references.push(page.src);
        if (!page.motion) continue;
        references.push(page.motion.background);
        assert.equal(page.motion.layers.length, 2, `Incorrect animation inventory on page ${page.number}.`);
        for (const layer of page.motion.layers) references.push(layer.src, layer.still);
      }
    }
    for (const srcset of html.matchAll(/\bsrcset="([^"]+)"/g)) references.push(...srcset[1].split(',').map((part) => part.trim().split(/\s+/)[0]));
    for (const reference of references) {
      if (/^(?:https?:|mailto:|tel:|data:)/.test(reference)) continue;
      const url = new URL(reference, origin + route);
      assert.ok(url.origin === origin && url.pathname.startsWith(base), `Reference escapes the deployment prefix: ${file} -> ${reference}`);
      let target = decodeURIComponent(url.pathname.slice(base.length));
      if (!target || target.endsWith('/')) target += 'index.html';
      const absolute = path.resolve(root, target);
      assert.ok(absolute.startsWith(root + path.sep), `Reference escapes the artifact: ${reference}`);
      assert.ok((await stat(absolute)).isFile(), `Missing reference: ${file} -> ${reference}`);
      if (url.hash && target.endsWith('.html')) {
        const document = pageHTML.get(path.normalize(target));
        assert.ok(document?.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing anchor: ${reference}`);
      }
    }
    for (const match of html.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
      const asset = match[1].replaceAll('&quot;', '').replaceAll('&#39;', '');
      if (!asset.startsWith('/')) continue;
      assert.ok(asset.startsWith(base), `Inline CSS escapes the prefix: ${asset}`);
      assert.ok((await stat(path.join(root, asset.slice(base.length)))).isFile());
    }
  }
  for (let page = 1; page <= 15; page++) {
    const filename = page === 1 ? path.join('newsletter', 'index.html') : path.join('newsletter', String(page), 'index.html');
    const html = pageHTML.get(filename);
    assert.ok(html?.includes(`Page ${page} of 15`));
    assert.ok(html.includes(`Read page ${page} as text`));
    assert.ok(html.includes(`aria-current="page"`));
    if (page >= 13) assert.ok(html.includes('Preview-quality image.'));
  }
  let compressedJS = 0;
  let cursorBytes = 0;
  const hashes = {};
  for (const file of files) {
    const bytes = await readFile(path.join(root, file));
    assert.ok(bytes.length <= 50 * 1024 * 1024, `Individual asset exceeds the release limit: ${file}`);
    hashes[file.replaceAll(path.sep, '/')] = createHash('sha256').update(bytes).digest('hex');
    if (file.endsWith('.js')) {
      const size = gzipSync(bytes).length;
      compressedJS += size;
      const script = bytes.toString('utf8');
      if (script.includes('studio-cat')) cursorBytes += size;
      assert.ok(!script.includes('requestAnimationFrame'), 'The cursor must not use an idle frame loop.');
      assert.ok(!script.includes('sourceMappingURL'), 'Do not publish source maps.');
    }
  }
  assert.ok(compressedJS <= 40 * 1024, `Compressed JS exceeds 40 KiB: ${compressedJS}`);
  assert.ok(cursorBytes > 0 && cursorBytes <= 10 * 1024, `Cursor/effects module exceeds 10 KiB: ${cursorBytes}`);
  const pdf = await PDFDocument.load(await readFile(path.join(root, 'documents', 'ashley-naoko-newsletter.pdf')));
  assert.equal(pdf.getPageCount(), 15, 'The download must be a real, complete PDF.');
  for (const notice of ['montserrat-OFL.txt', 'roboto-OFL.txt', 'dm-sans-OFL.txt', 'silkscreen-OFL.txt']) {
    assert.ok((await readFile(path.join(root, 'fonts', notice), 'utf8')).includes('SIL OPEN FONT LICENSE'), `Missing or invalid font notice: ${notice}`);
  }
  return { directory: root, base, preview, files: files.length, pages: htmlFiles.length, compressedJS, cursorBytes, hashes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = process.argv[2] ?? 'dist';
  const preview = path.basename(directory) === 'dist-demo';
  const result = await verifyBuild(directory, { base: preview ? '/ashley-naoko/' : '/', preview });
  console.log(`Verified ${result.pages} pages and ${result.files} files at ${result.base}. JS: ${result.compressedJS} compressed bytes; cursor/effects: ${result.cursorBytes} bytes.`);
}
