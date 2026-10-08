import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const research = path.join(root, 'research');
const originals = path.join(research, 'originals');
const publicRoot = path.join(root, 'public');
const outputRoot = path.join(publicRoot, 'fidelity');
const contentRoot = path.join(root, 'src', 'content');
const designFile = path.join(research, 'canva-design.json');
const desktopLayoutFile = path.join(research, 'canva-desktop-layout.json');
const mobileLayoutFile = path.join(research, 'canva-mobile-layout.json');
const motionEvidenceFile = path.join(research, 'desktop-motion-evidence.json');
const modelFile = path.join(contentRoot, 'canva-home.json');
const provenanceFile = path.join(contentRoot, 'canva-provenance.json');
const displayFontFile = path.join(publicRoot, 'fonts', 'partita-1990.woff2');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const normalizeHex = (value) => {
  if (!value) return value;
  if (value.startsWith('#')) return value.toLowerCase();
  const channels = value.match(/\d+/g)?.map(Number);
  return channels?.length === 3 ? `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}` : value;
};

await mkdir(outputRoot, { recursive: true });
await mkdir(contentRoot, { recursive: true });

const design = JSON.parse(await readFile(designFile, 'utf8'));
const desktopLayout = JSON.parse(await readFile(desktopLayoutFile, 'utf8'));
const mobileLayout = JSON.parse(await readFile(mobileLayoutFile, 'utf8'));
const motionEvidence = JSON.parse(await readFile(motionEvidenceFile, 'utf8'));
if (motionEvidence.version !== 2) throw new Error('Desktop motion evidence must contain measured translations and rotations.');
const displayFontBytes = await readFile(displayFontFile);
if (displayFontBytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error('Partita 1990 must be a valid prepared WOFF2 file.');
const sourceFiles = new Set(await readdir(originals));
const media = JSON.parse(await readFile(path.join(contentRoot, 'media.json'), 'utf8'));
const videos = JSON.parse(await readFile(path.join(contentRoot, 'videos.json'), 'utf8'));
const prepared = JSON.parse(await readFile(path.join(contentRoot, 'provenance.json'), 'utf8'));
const previous = await readFile(provenanceFile, 'utf8').then(JSON.parse).catch((error) => {
  if (error.code === 'ENOENT') return { outputs: [] };
  throw error;
});

const definitions = new Map();
for (const definition of [...design.E, ...design.F]) {
  const variants = definitions.get(definition.id) ?? [];
  variants.push(definition);
  definitions.set(definition.id, variants);
}

const preparedBySource = new Map();
for (const asset of prepared.assets) {
  try {
    preparedBySource.set(path.basename(new URL(asset.source).pathname), asset.key);
  } catch {
    // Records generated from the design URL do not identify one source file.
  }
}

const fontFamilies = {
  YAEzwJyAXWQ: 'Partita 1990',
  YAFdtQi73Xs: 'Montserrat',
  YAD1aU3sLnI: 'DM Sans',
  YACgEev4gKc: 'Roboto',
};
const desktopDisplayMetrics = new Map([
  ['CREATIVE PORTFOLIO', { scaleX: 0.865784, scaleY: 1, offsetX: 1.303920, offsetY: -1 }],
  ['I’M ASHLEY', { scaleX: 0.864865, scaleY: 1, offsetX: 1.733953, offsetY: -1 }],
  ['EDITORIAL DESIGN', { scaleX: 0.872757, scaleY: 1, offsetX: 1.744520, offsetY: -2 }],
  ['TESTIMONIAL', { scaleX: 0.892704, scaleY: 1, offsetX: 1.391866, offsetY: -1 }],
  ['DIGITAL WORKS', { scaleX: 0.862295, scaleY: 1.02, offsetX: 1.729969, offsetY: -3.683924 }],
  ['GRAPHIC DESIGN', { scaleX: 0.874088, scaleY: 1, offsetX: 2.218664, offsetY: -2 }],
  ['VIDEO EDITING', { scaleX: 0.873684, scaleY: 1, offsetX: 1.740461, offsetY: -2 }],
  ['PHYSICAL WORKS', { scaleX: 0.869065, scaleY: 1.02, offsetX: 2.174708, offsetY: -3.678611 }],
  ['3D PRINTING', { scaleX: 0.882353, scaleY: 1, offsetX: 1.761029, offsetY: -1 }],
  ['LASER CUTTING', { scaleX: 0.895551, scaleY: 1, offsetX: 1.793551, offsetY: -1 }],
  ['PRINTMAKING', { scaleX: 0.881944, scaleY: 1, offsetX: 1.287869, offsetY: -1 }],
  ['WELDING', { scaleX: 0.884892, scaleY: 1, offsetX: 1.763489, offsetY: -1 }],
  ['CONTACT ME', { scaleX: 0.876740, scaleY: 1.02, offsetX: 1.721701, offsetY: -3.684236 }],
]);

const pageNames = ['home', 'about', 'digital', 'physical', 'contact'];
const pageLabels = ['Creative portfolio', 'About Ashley', 'Digital works', 'Physical works', 'Contact Ashley'];
const assetPlans = new Map();
const motionNodes = new Map(Object.entries(motionEvidence.nodes));
const usedMotionNodes = new Set();
const intentionallyUnrenderedMobileNodes = new Set(['LBnfRJw80tQ1NGL8']);
const mobilePages = new Map(mobileLayout.map((page) => [
  page.pageIndex,
  {
    ...page,
    nodes: new Map(page.nodes.map((node) => [node.id, node])),
  },
]));
const desktopPages = new Map(desktopLayout.map((page) => [
  page.pageIndex,
  {
    ...page,
    nodes: new Map(page.nodes.map((node) => [node.id, node])),
  },
]));

function mediaIds(node) {
  return [...new Set([
    node.a?.B?.I?.A,
    node.a?.B?.A?.A,
    node.a?.I?.A,
  ].filter((id) => typeof id === 'string'))];
}

function pickDefinitionByIds(ids, label) {
  for (const id of ids) {
    const candidates = (definitions.get(id) ?? []).flatMap((definition) =>
      (definition.files ?? []).flatMap((file) => {
        if (!file.url) return [];
        const filename = path.basename(file.url);
        return sourceFiles.has(filename) ? [{ definition, file, filename }] : [];
      }),
    ).sort((left, right) => (right.file.width * right.file.height) - (left.file.width * left.file.height));
    if (candidates[0]) return candidates[0];
  }
  throw new Error(`No authorized local source resolved for ${label}.`);
}

function pickDefinition(node) {
  return pickDefinitionByIds(mediaIds(node), `node ${node._}`);
}

function mergedTextStyle(node) {
  const styles = node.a?.C?.C ?? [];
  const merged = {};
  for (const style of styles) {
    if (style['1'] === true) break;
    Object.assign(merged, style);
  }
  const alias = merged.C?.split(',')[0];
  const family = fontFamilies[alias];
  if (!family) throw new Error(`Unsupported visible font alias ${alias} in text node ${node._}.`);
  return {
    family,
    size: Number.parseFloat(merged.G),
    color: merged.M ?? '#000000',
    align: merged.c ?? 'left',
    lineHeight: Number.parseFloat(merged.Y) || 1.1,
    letterSpacing: merged.W ?? '0em',
    weight: merged.I === 'bold' ? 700 : 400,
    style: merged.K === 'italic' ? 'italic' : 'normal',
  };
}

function layout(node, scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0, rotation = 0) {
  return {
    x: offsetX + node.B * scaleX,
    y: offsetY + node.A * scaleY,
    width: node.D * scaleX,
    height: node.C * scaleY,
    rotation: rotation + (node.E ?? 0),
  };
}

function responsiveLayout(node, transform, context) {
  const {
    mobileScaleX,
    mobileScaleY,
    mobileOffsetX = 0,
    mobileOffsetY = 0,
    mobileRotation = 0,
    mobilePage,
    pageIndex,
    pageWidth,
    pageHeight,
  } = context;
  if (Number.isFinite(mobileScaleX) && Number.isFinite(mobileScaleY)) {
    return layout(node, mobileScaleX, mobileScaleY, mobileOffsetX, mobileOffsetY, mobileRotation);
  }
  const measured = mobilePage.nodes.get(node._);
  if (measured && [measured.x, measured.y, measured.width, measured.height].every(Number.isFinite)) {
    return {
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: measured.height,
      rotation: pageIndex === 0 ? transform.rotation : measured.rotation,
    };
  }
  if (!intentionallyUnrenderedMobileNodes.has(node._)) {
    throw new Error(`Mobile source layout missing for visible node ${node._}.`);
  }
  return layout(
    node,
    mobilePage.width / pageWidth,
    mobilePage.height / pageHeight,
  );
}

function assetPlanForDefinition(picked, palette, displayWidth) {
  const planKey = `${picked.filename}:${JSON.stringify(palette)}`;
  const outputName = `${hash(planKey).slice(0, 16)}.webp`;
  const existing = assetPlans.get(planKey);
  const targetWidth = Math.max(1, Math.ceil(displayWidth * 2));
  if (existing) existing.targetWidth = Math.max(existing.targetWidth, targetWidth);
  else assetPlans.set(planKey, {
    key: planKey,
    input: path.join(originals, picked.filename),
    filename: picked.filename,
    definition: picked.definition,
    palette,
    targetWidth,
    outputName,
    source: picked.file.url,
  });
  return { src: `/fidelity/${outputName}`, filename: picked.filename };
}

function assetPlan(node, displayWidth) {
  const picked = pickDefinition(node);
  const palette = Object.fromEntries(Object.entries(node.a?.B?.C ?? {}).map(([from, to]) => [normalizeHex(from), normalizeHex(to)]));
  return assetPlanForDefinition(picked, palette, displayWidth);
}

function normalizedCrop(crop, width, height) {
  return {
    x: crop.B / width,
    y: crop.A / height,
    width: crop.D / width,
    height: crop.C / height,
    rotation: crop.E ?? 0,
  };
}

function mediaCrop(node) {
  return normalizedCrop(
    node.a?.I?.B ?? node.a?.B?.B ?? { A: 0, B: 0, D: node.D, C: node.C, E: 0 },
    node.D,
    node.C,
  );
}

function legacyMediaCrop(node) {
  return {
    ...normalizedCrop(
      node.a?.B?.B ?? { A: 0, B: 0, D: node.D, C: node.C, E: 0 },
      node.D,
      node.C,
    ),
    rotation: 0,
  };
}

function trimmedVideoPoster(node, definition, start) {
  if (!(start > 0)) return undefined;
  let remaining = Math.floor(start);
  for (const timeline of definition.videoTimelines ?? []) {
    if (remaining >= timeline.G) { remaining -= timeline.G; continue; }
    const filename = path.basename(timeline.F);
    if (!sourceFiles.has(filename)) throw new Error(`Trimmed video poster is unavailable for ${node._}.`);
    const cropRegion = {
      left: remaining % timeline.C * timeline.A,
      top: Math.floor(remaining / timeline.C) * timeline.B,
      width: timeline.A,
      height: timeline.B,
    };
    const key = `${filename}:${JSON.stringify(cropRegion)}`;
    const outputName = `${hash(key).slice(0, 16)}.webp`;
    assetPlans.set(key, {
      key, input: path.join(originals, filename), filename, definition: {},
      palette: {}, targetWidth: timeline.A, outputName, source: timeline.F, cropRegion,
    });
    return `/fidelity/${outputName}`;
  }
  throw new Error(`Source poster timeline does not cover ${start}s for ${node._}.`);
}

function convertImage(node, index, transform, mobile) {
  const picked = pickDefinition(node);
  const extension = path.extname(picked.filename).toLowerCase();
  const role = preparedBySource.get(picked.filename);
  const hasContinuousMotion = node['3']?.D?.A === -1;
  const observedMotion = hasContinuousMotion ? motionNodes.get(node._) : undefined;
  if (hasContinuousMotion && !observedMotion) {
    throw new Error(`Source-authored continuous motion has no retained observation for node ${node._}.`);
  }
  if (observedMotion && observedMotion.role !== role) {
    throw new Error(`Motion evidence role mismatch for ${node._}: ${observedMotion.role} !== ${role}.`);
  }
  if (observedMotion && (
    !Number.isFinite(observedMotion.duration) || observedMotion.duration <= 0
    || !Number.isFinite(observedMotion.interval) || observedMotion.interval <= 0
    || !Array.isArray(observedMotion.frames) || observedMotion.frames.length < 2
    || observedMotion.frames.some((frame) => frame.length !== 3 || !frame.every(Number.isFinite))
  )) throw new Error(`Invalid observed motion frames for ${node._}.`);
  if (observedMotion) usedMotionNodes.add(node._);
  const base = {
    id: node._,
    index,
    ...transform,
    mobile,
    crop: mediaCrop(node),
    mobileCrop: legacyMediaCrop(node),
    entrance: node.X?.A === 7 ? 'spring' : undefined,
    continuousMotion: observedMotion
      ? {
        duration: observedMotion.duration,
        interval: observedMotion.interval,
        frames: observedMotion.frames,
      }
      : undefined,
    role,
  };

  if (extension === '.mp4') {
    if (!role || !videos[role]) throw new Error(`Prepared video role missing for ${picked.filename}.`);
    const start = (node.a.I.E?.A ?? 0) / 1_000_000;
    const end = node.a.I.E?.B === undefined ? videos[role].duration : node.a.I.E.B / 1_000_000;
    return {
      ...base, type: 'video', video: role,
      playback: { start, end, volume: node.a.I.G ?? 1 },
      desktopPoster: trimmedVideoPoster(node, picked.definition, start),
    };
  }
  if (extension === '.gif') {
    if (!role || !media[role]?.animated) throw new Error(`Prepared animation role missing for ${picked.filename}.`);
    return { ...base, type: 'animation', src: media[role].src, animated: media[role].animated };
  }
  const asset = assetPlan(node, transform.width);
  return { ...base, type: 'image', src: asset.src };
}

function authoredText(node) {
  const raw = node.a?.C?.A?.join('') ?? '';
  const lengths = node.b?.A ?? [raw.length];
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total !== raw.length) {
    throw new Error(`Authored text line lengths do not match node ${node._}: ${total} !== ${raw.length}.`);
  }
  let offset = 0;
  const lines = lengths.map((length) => {
    const line = raw.slice(offset, offset + length);
    offset += length;
    return line.replace(/\n$/, '');
  });
  const deltas = node.a?.C?.C ?? [];
  const deltaLengths = node.a?.C?.D ?? [];
  const transitions = [];
  let position = 0;
  let color = '#000000';
  let weight = 400;
  let style = 'normal';
  for (let index = 0; index < deltas.length; index++) {
    position += deltaLengths[index] ?? 0;
    const delta = deltas[index];
    if (delta.N === true) color = '#000000';
    if (delta.M !== undefined) color = delta.M;
    if (delta.J === true) weight = 400;
    if (delta.I !== undefined) weight = delta.I === 'bold' ? 700 : 400;
    if (delta.L === true) style = 'normal';
    if (delta.K !== undefined) style = delta.K === 'italic' ? 'italic' : 'normal';
    transitions.push({ position, color, weight, style });
  }
  let lineOffset = 0;
  const lineRuns = lines.map((line, index) => {
    const end = lineOffset + line.length;
    const boundaries = [
      lineOffset,
      ...transitions.map((entry) => entry.position).filter((position) => position > lineOffset && position < end),
      end,
    ];
    const runs = boundaries.slice(0, -1).map((start, runIndex) => {
      const current = transitions.findLast((entry) => entry.position <= start);
      return {
        text: raw.slice(start, boundaries[runIndex + 1]),
        color: current?.color ?? '#000000',
        weight: current?.weight ?? 400,
        style: current?.style ?? 'normal',
      };
    });
    lineOffset += lengths[index];
    return runs;
  });
  return {
    text: raw.replace(/\n$/, ''),
    lines,
    lineRuns,
  };
}

function convertText(node, index, transform, mobile, desktopTextStyle, mobileTextStyle) {
  const { text, lines, lineRuns } = authoredText(node);
  const style = mergedTextStyle(node);
  const desktopTextSize = desktopTextStyle?.fontSize ?? style.size;
  const desktopLineHeight = desktopTextStyle?.lineHeight && desktopTextSize
    ? desktopTextStyle.lineHeight / desktopTextSize
    : style.lineHeight;
  const mobileTextSize = mobileTextStyle?.fontSize;
  const mobileLineHeight = mobileTextStyle?.lineHeight && mobileTextSize
    ? mobileTextStyle.lineHeight / mobileTextSize
    : desktopLineHeight;
  const desktopDisplay = desktopDisplayMetrics.get(text) ?? { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
  const display = style.family === 'Partita 1990';
  return {
    id: node._,
    index,
    ...transform,
    mobile,
    type: 'text',
    text,
    lines,
    lineRuns,
    fitted: node.h === 'B',
    style: {
      ...style,
      size: desktopTextSize,
      lineHeight: desktopLineHeight,
      desktopScaleX: display ? desktopDisplay.scaleX : 1,
      desktopScaleY: display ? desktopDisplay.scaleY : 1,
      desktopOffsetX: display ? desktopDisplay.offsetX : 0,
      desktopOffsetY: display ? desktopDisplay.offsetY : 0,
      mobileScaleX: display ? desktopDisplay.scaleX : 1,
      mobileScaleY: display ? desktopDisplay.scaleY : 1,
    },
    mobileTextSize,
    mobileLineHeight,
    effect: node.X?.A === 24 ? 'typewriter' : undefined,
    duration: node.X?.B?.G?.A ? node.X.B.G.A / 1_000_000 : undefined,
  };
}

function normalizedOpacity(value) {
  return 1 - Math.min(1, Math.max(0, value ?? 0));
}

function canonicalHref(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (/^(?:www\.)?youtube\.com$/i.test(url.hostname) && url.pathname === '/@ashleynaoko') {
    return 'https://www.youtube.com/@ashleynaoko';
  }
  return url.href;
}

function isRectPath(item, node) {
  return node.a.A === 0
    && node.a.B === 0
    && node.a.D === 64
    && node.a.C === 64
    && item.A === 'M0 0H64V64H0z';
}

function vectorFill(node, item, transform) {
  if (item.B?.A && item.B?.B) {
    const paint = item.B.B;
    const definitionId = paint.A?.A;
    if (!definitionId) throw new Error(`Image-filled vector ${node._} has no media definition.`);
    const picked = pickDefinitionByIds([definitionId], `vector paint ${node._}`);
    const palette = Object.fromEntries(Object.entries(paint.C ?? {}).map(([from, to]) => [normalizeHex(from), normalizeHex(to)]));
    const asset = assetPlanForDefinition(picked, palette, transform.width);
    return {
      type: 'image',
      src: asset.src,
      crop: normalizedCrop(
        paint.B ?? { A: 0, B: 0, D: node.a.D, C: node.a.C, E: 0 },
        node.a.D,
        node.a.C,
      ),
      opacity: normalizedOpacity(item.B.D),
    };
  }
  if (item.B?.C) {
    return {
      type: 'solid',
      color: item.B.C,
      opacity: normalizedOpacity(item.B.D),
    };
  }
  return { type: 'none' };
}

function convertVector(node, index, transform, mobile) {
  return {
    id: node._,
    index,
    ...transform,
    mobile,
    type: 'vector',
    href: canonicalHref(node.G),
    linkLabel: node.G ? 'Visit Ashley Naoko on YouTube' : undefined,
    viewBox: [node.a.A, node.a.B, node.a.D, node.a.C],
    paths: node.b.map((item) => ({
      kind: isRectPath(item, node) ? 'rect' : 'path',
      d: item.A,
      fill: vectorFill(node, item, transform),
      legacyFill: item.B?.C ?? 'none',
      fillOpacity: normalizedOpacity(item.B?.D),
      legacyFillOpacity: item.B?.D ?? 1,
      stroke: item.C?.A ? item.C.B : 'none',
      strokeWidth: item.C?.A ?? 0,
      dash: item.C?.C ?? [],
      cornerRadius: item.D ?? 0,
    })),
  };
}

function convertLine(node, index, transform, mobile) {
  return {
    id: node._,
    index,
    ...transform,
    mobile,
    type: 'line',
    color: node.d,
    thickness: node.a,
    arrowEnd: node.c?.A === 'C',
    curve: node.i?.A ?? 0,
    reveal: node.X?.A === 6 ? motionEvidence.lines[node._] : undefined,
  };
}

function convertEmbed(node, index, transform, mobile) {
  return {
    id: node._,
    index,
    ...transform,
    mobile,
    type: 'newsletter',
  };
}

function convertNode(node, index, context = {}) {
  const {
    scaleX = 1,
    scaleY = 1,
    offsetX = 0,
    offsetY = 0,
    rotation = 0,
  } = context;
  const transform = layout(node, scaleX, scaleY, offsetX, offsetY, rotation);
  const mobile = responsiveLayout(node, transform, context);
  const desktopTextStyle = context.desktopPage.nodes.get(node._)?.textStyle;
  const mobileTextStyle = context.mobilePage.nodes.get(node._)?.textStyle;
  switch (node['A?']) {
    case 'I': return [convertImage(node, index, transform, mobile)];
    case 'K': return [convertText(node, index, transform, mobile, desktopTextStyle, mobileTextStyle)];
    case 'J': return [convertVector(node, index, transform, mobile)];
    case 'U': return [convertLine(node, index, transform, mobile)];
    case 'O': return [convertEmbed(node, index, transform, mobile)];
    case 'H': {
      if (node.E) throw new Error(`Rotated group ${node._} needs an explicit transform implementation.`);
      const childScaleX = scaleX * node.D / node.b;
      const childScaleY = scaleY * node.C / node.a;
      const childOffsetX = offsetX + node.B * scaleX;
      const childOffsetY = offsetY + node.A * scaleY;
      return node.c.flatMap((child, childIndex) => convertNode(child, Number(`${index}.${childIndex + 1}`), {
        ...context,
        scaleX: childScaleX,
        scaleY: childScaleY,
        offsetX: childOffsetX,
        offsetY: childOffsetY,
        rotation,
        mobileScaleX: mobile.width / node.b,
        mobileScaleY: mobile.height / node.a,
        mobileOffsetX: mobile.x,
        mobileOffsetY: mobile.y,
        mobileRotation: mobile.rotation,
      }));
    }
    default:
      throw new Error(`Unsupported source node type ${node['A?']} (${node._}).`);
  }
}

const pages = design.A.A[0].t.slice(0, 5).map((page, pageIndex) => {
  const desktopPage = desktopPages.get(pageIndex);
  const mobilePage = mobilePages.get(pageIndex);
  if (!desktopPage) throw new Error(`Desktop source page ${pageIndex} is missing.`);
  if (!mobilePage) throw new Error(`Mobile source page ${pageIndex} is missing.`);
  if (mobilePage.width !== 390) throw new Error(`Unexpected mobile source width ${mobilePage.width} for page ${pageIndex}.`);
  return {
    id: pageNames[pageIndex],
    label: pageLabels[pageIndex],
    width: page.C.A,
    height: page.C.B,
    mobileWidth: mobilePage.width,
    mobileHeight: mobilePage.height,
    background: page.D.C,
    nodes: page.E.flatMap((node, nodeIndex) => convertNode(node, nodeIndex + 1, {
      desktopPage,
      mobilePage,
      pageIndex,
      pageWidth: page.C.A,
      pageHeight: page.C.B,
    })),
  };
});

for (const page of pages) {
  const links = page.nodes.filter((node) => node.type === 'vector' && node.href);
  for (const text of page.nodes.filter((node) => node.type === 'text')) {
    const link = links.find((node) =>
      text.x >= node.x && text.y >= node.y
      && text.x + text.width <= node.x + node.width
      && text.y + text.height <= node.y + node.height);
    if (link) text.linkedTo = link.id;
  }
}

for (const id of motionNodes.keys()) {
  if (!usedMotionNodes.has(id)) throw new Error(`Retained motion evidence no longer matches a visible source node: ${id}.`);
}

async function renderLayered(plan) {
  const metadata = await sharp(plan.input).metadata();
  const sheet = plan.definition.spritesheetMetadata;
  const tileWidth = Math.round(metadata.width / sheet.spritesWide);
  const tileHeight = Math.round(metadata.height / sheet.spritesHigh);
  const layers = [];
  for (let index = 1; index < sheet.layers.length; index++) {
    const layer = sheet.layers[index];
    if (layer.type !== 'RECOLORABLE') continue;
    const sourceColor = normalizeHex(layer.color);
    const targetColor = normalizeHex(plan.palette[sourceColor] ?? sourceColor);
    const red = Number.parseInt(targetColor.slice(1, 3), 16);
    const green = Number.parseInt(targetColor.slice(3, 5), 16);
    const blue = Number.parseInt(targetColor.slice(5, 7), 16);
    const left = (index % sheet.spritesWide) * tileWidth;
    const top = Math.floor(index / sheet.spritesWide) * tileHeight;
    const { data } = await sharp(plan.input)
      .extract({ left, top, width: tileWidth, height: tileHeight })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgba = Buffer.alloc(tileWidth * tileHeight * 4);
    for (let pixel = 0; pixel < data.length; pixel++) {
      rgba[pixel * 4] = red;
      rgba[pixel * 4 + 1] = green;
      rgba[pixel * 4 + 2] = blue;
      rgba[pixel * 4 + 3] = data[pixel];
    }
    layers.push({ input: rgba, raw: { width: tileWidth, height: tileHeight, channels: 4 } });
  }
  if (!layers.length) throw new Error(`No recolorable layers found for ${plan.filename}.`);
  return sharp({
    create: {
      width: tileWidth,
      height: tileHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(layers).png().toBuffer();
}

const outputs = [];
for (const plan of [...assetPlans.values()].sort((left, right) => left.outputName.localeCompare(right.outputName))) {
  const source = plan.cropRegion
    ? await sharp(plan.input).extract(plan.cropRegion).png().toBuffer()
    : plan.definition.spritesheetMetadata ? await renderLayered(plan) : plan.input;
  const metadata = await sharp(source).metadata();
  const width = Math.min(metadata.width, plan.targetWidth);
  const bytes = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 90, effort: 5, alphaQuality: 100 })
    .toBuffer();
  const output = path.join(outputRoot, plan.outputName);
  await writeFile(output, bytes);
  const outputMetadata = await sharp(bytes).metadata();
  outputs.push({
    source: plan.source,
    sourceFile: plan.filename,
    sourceSha256: hash(await readFile(plan.input)),
    palette: plan.palette,
    cropRegion: plan.cropRegion,
    output: `fidelity/${plan.outputName}`,
    width: outputMetadata.width,
    height: outputMetadata.height,
    bytes: bytes.length,
    sha256: hash(bytes),
  });
}

const newsletterCoverInput = path.join(publicRoot, 'documents', 'newsletter-01.webp');
const newsletterCoverBytes = await sharp(newsletterCoverInput)
  .resize({ width: 640, withoutEnlargement: true })
  .webp({ quality: 82, effort: 6 })
  .toBuffer();
const newsletterCoverName = 'newsletter-cover-640.webp';
await writeFile(path.join(outputRoot, newsletterCoverName), newsletterCoverBytes);
const newsletterCoverMetadata = await sharp(newsletterCoverBytes).metadata();
outputs.push({
  source: 'Owner-authorized first newsletter page prepared for the homepage preview.',
  sourceFile: 'documents/newsletter-01.webp',
  sourceSha256: hash(await readFile(newsletterCoverInput)),
  palette: {},
  output: `fidelity/${newsletterCoverName}`,
  width: newsletterCoverMetadata.width,
  height: newsletterCoverMetadata.height,
  bytes: newsletterCoverBytes.length,
  sha256: hash(newsletterCoverBytes),
});

const currentOutputs = new Set(outputs.map((output) => output.output));
for (const obsolete of previous.outputs.filter((output) => !currentOutputs.has(output.output))) {
  const target = path.resolve(publicRoot, obsolete.output);
  if (!target.startsWith(`${outputRoot}${path.sep}`)) throw new Error(`Refusing to remove unmanaged output ${obsolete.output}.`);
  try {
    await unlink(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await writeFile(modelFile, json({
  source: 'Ashley Naoko Canva portfolio, decoded from owner-authorized public design metadata.',
  displayFont: {
    source: 'Retropix',
    family: 'Partita 1990',
    format: 'woff2',
    file: '/fonts/partita-1990.woff2',
    selection: 'Partita 1990 Regular selected by the commissioning user.',
  },
  pages,
}));
await writeFile(provenanceFile, json({
  displayFont: {
    family: 'Partita 1990 Regular',
    designer: 'Stefano Giliberti (brumale)',
    officialSource: 'https://www.brumale.xyz/partita/',
    output: 'fonts/partita-1990.woff2',
    bytes: displayFontBytes.length,
    sha256: hash(displayFontBytes),
    rights: 'User-attested self-hosted web-use permission; official font kit and license document pending owner handoff.',
  },
  generatedFrom: [
    path.relative(root, designFile),
    path.relative(root, desktopLayoutFile),
    path.relative(root, mobileLayoutFile),
    path.relative(root, motionEvidenceFile),
  ],
  permission: 'The commissioning user confirmed owner permission to reproduce the portfolio and assets.',
  outputs,
}));

const bytes = outputs.reduce((total, output) => total + output.bytes, 0);
console.log(`Generated ${pages.length} source-geometry artboards with ${pages.reduce((total, page) => total + page.nodes.length, 0)} nodes.`);
console.log(`Prepared ${outputs.length} exact-canvas media variants (${(bytes / 1048576).toFixed(1)} MiB).`);
for (const file of [modelFile, provenanceFile]) {
  const metadata = await stat(file);
  if (!metadata.size) throw new Error(`Generated file is empty: ${file}`);
}
