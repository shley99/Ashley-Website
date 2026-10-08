export {};

interface NewsletterPage {
  number: number;
  src: string;
  width: number;
  height: number;
  previewQuality: boolean;
  motion?: {
    background: string;
    layers: {
      id: string;
      role: string;
      src: string;
      still: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    }[];
  };
}

interface NewsletterController {
  synchronize: () => void;
  dispose: () => void;
}

function required<T extends Element>(container: Element, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`Missing portfolio control: ${selector}.`);
  return element;
}

function readPages(reader: HTMLElement): NewsletterPage[] {
  const localPath = (value: unknown): value is string =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
  const validMotion = (value: unknown) => {
    if (value === undefined) return true;
    if (!value || typeof value !== 'object' || !('background' in value) || !('layers' in value)
      || !localPath(value.background) || !Array.isArray(value.layers) || value.layers.length > 4) return false;
    return value.layers.every((layer) =>
      layer && typeof layer === 'object' && typeof layer.id === 'string' && typeof layer.role === 'string'
      && localPath(layer.src) && localPath(layer.still)
      && [layer.x, layer.y, layer.width, layer.height, layer.rotation].every(Number.isFinite)
      && layer.width > 0 && layer.width <= 1 && layer.height > 0 && layer.height <= 1);
  };
  const value: unknown = JSON.parse(reader.dataset.newsletterPages ?? '');
  if (!Array.isArray(value) || value.length !== 15 || !value.every((entry): entry is NewsletterPage =>
    entry && typeof entry === 'object' && Number.isInteger(entry.number)
    && localPath(entry.src)
    && Number.isFinite(entry.width) && entry.width > 0 && Number.isFinite(entry.height) && entry.height > 0
    && typeof entry.previewQuality === 'boolean'
    && validMotion(entry.motion)
  ) || value.some((entry, index) => entry.number !== index + 1)) {
    throw new Error('The inline newsletter needs all fifteen ordered local pages.');
  }
  return value;
}

function installNewsletter(reader: HTMLElement, desktop: MediaQueryList, signal: AbortSignal, motionAllowed: () => boolean): NewsletterController {
  const pages = readPages(reader);
  const image = required<HTMLImageElement>(reader, '[data-newsletter-image]');
  const desktopImage = required<HTMLSourceElement>(reader, '[data-newsletter-desktop-image]');
  const stage = required<HTMLElement>(reader, '[data-newsletter-stage]');
  const canvas = required<HTMLElement>(reader, '[data-newsletter-canvas]');
  const counter = required<HTMLElement>(reader, '[data-newsletter-counter]');
  const previous = required<HTMLButtonElement>(reader, '[data-newsletter-prev]');
  const next = required<HTMLButtonElement>(reader, '[data-newsletter-next]');
  const zoomSlider = required<HTMLInputElement>(reader, '[data-newsletter-zoom]');
  const fit = required<HTMLButtonElement>(reader, '[data-newsletter-fit]');
  const hideControls = required<HTMLButtonElement>(reader, '[data-newsletter-hide-controls]');
  const showControls = required<HTMLButtonElement>(reader, '[data-newsletter-show-controls]');
  const zoomValue = required<HTMLOutputElement>(reader, '[data-newsletter-zoom-value]');
  const fullscreen = required<HTMLButtonElement>(reader, '[data-newsletter-fullscreen]');
  const pageLink = required<HTMLAnchorElement>(reader, '[data-newsletter-page-link]');
  const standalone = required<HTMLAnchorElement>(reader, '[data-newsletter-standalone]');
  const error = required<HTMLElement>(reader, '.media-error');
  const errorText = required<HTMLElement>(error, '[data-newsletter-error]');
  const retry = required<HTMLButtonElement>(error, '[data-newsletter-retry]');
  const notice = required<HTMLElement>(reader, '[data-newsletter-quality]');
  const live = required<HTMLElement>(reader, '[data-newsletter-status]');
  const previousArea = required<HTMLButtonElement>(reader, '[data-newsletter-page-previous]');
  const nextArea = required<HTMLButtonElement>(reader, '[data-newsletter-page-next]');
  const motionMount = required<HTMLElement>(reader, '[data-newsletter-motion]');
  const motionStatus = required<HTMLElement>(reader, '[data-newsletter-motion-status]');
  let displayed = 0;
  let desired = 0;
  let sequence = 0;
  let zoom = 1;
  let stopped = false;
  let inView = false;
  const visuals = new Map<number, { element: HTMLDivElement; decorations: HTMLImageElement[] }>();
  const pendingVisuals = new Set<number>();
  const failedVisuals = new Set<number>();

  function positionMotion() {
    const bounds = canvas.getBoundingClientRect();
    const page = pages[displayed];
    const scale = Math.min(bounds.width / page.width, bounds.height / page.height);
    const width = page.width * scale, height = page.height * scale;
    Object.assign(motionMount.style, {
      left: `${(bounds.width - width) / 2}px`, top: `${(bounds.height - height) / 2}px`,
      width: `${width}px`, height: `${height}px`,
    });
  }

  function stopDecorations() {
    motionMount.hidden = true;
    for (const visual of visuals.values()) {
      for (const image of visual.decorations) {
        if (image.dataset.stillSrc && image.getAttribute('src') !== image.dataset.stillSrc) image.src = image.dataset.stillSrc;
      }
    }
  }

  async function loadVisual(index: number) {
    const motion = pages[index].motion;
    if (!motion || pendingVisuals.has(index) || failedVisuals.has(index)) return;
    pendingVisuals.add(index);
    try {
      const element = document.createElement('div');
      element.className = 'canva-newsletter-motion-page';
      const background = new Image();
      background.alt = '';
      background.src = motion.background;
      background.className = 'canva-newsletter-motion-background';
      element.append(background);
      const decorations = motion.layers.map((layer) => {
        const image = new Image();
        image.alt = '';
        image.draggable = false;
        image.className = 'canva-newsletter-decoration';
        image.dataset.newsletterDecoration = layer.role;
        image.dataset.sourceNode = layer.id;
        image.dataset.stillSrc = layer.still;
        image.dataset.animatedSrc = layer.src;
        image.src = layer.still;
        Object.assign(image.style, {
          left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
          width: `${layer.width * 100}%`, height: `${layer.height * 100}%`,
          transform: `rotate(${layer.rotation}deg)`,
        });
        element.append(image);
        return image;
      });
      const animated = motion.layers.map((layer) => {
        const image = new Image();
        image.src = layer.src;
        return image.decode();
      });
      await Promise.all([background.decode(), ...decorations.map((image) => image.decode()), ...animated]);
      if (stopped || signal.aborted) return;
      visuals.set(index, { element, decorations });
      if (index === displayed) synchronizeMotion();
    } catch (cause) {
      if (stopped || signal.aborted) return;
      failedVisuals.add(index);
      if (displayed === index) motionStatus.textContent = `Page ${index + 1} animations could not load. The static page remains available.`;
      console.warn(`Newsletter page ${index + 1} animations are unavailable; showing the complete static page.`, cause);
    } finally {
      pendingVisuals.delete(index);
    }
  }

  function synchronizeMotion() {
    if (stopped || !desktop.matches || !inView || !motionAllowed() || !pages[displayed].motion) {
      stopDecorations();
      return;
    }
    const visual = visuals.get(displayed);
    if (!visual) {
      stopDecorations();
      void loadVisual(displayed);
      return;
    }
    if (motionMount.firstElementChild !== visual.element) {
      stopDecorations();
      motionMount.replaceChildren(visual.element);
    }
    positionMotion();
    for (const image of visual.decorations) {
      if (image.dataset.animatedSrc && image.getAttribute('src') !== image.dataset.animatedSrc) image.src = image.dataset.animatedSrc;
    }
    motionMount.dataset.newsletterMotionPage = String(displayed + 1);
    motionMount.hidden = false;
  }

  function updateControls() {
    previous.disabled = desired === 0;
    next.disabled = desired === pages.length - 1;
    previousArea.disabled = !desktop.matches || zoom !== 1 || displayed === 0 || desired !== displayed;
    nextArea.disabled = !desktop.matches || zoom !== 1 || displayed === pages.length - 1 || desired !== displayed;
    reader.toggleAttribute('data-newsletter-page-navigation', desktop.matches && zoom === 1);
    counter.textContent = `${displayed + 1} / ${pages.length}`;
    zoomSlider.value = String(Math.round(zoom * 100));
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    canvas.style.setProperty('--newsletter-zoom', String(zoom));
    pageLink.href = pages[displayed].src;
    const route = displayed === 0 ? '' : `${displayed + 1}/`;
    standalone.href = new URL(route, standalone.dataset.readerRoot).href;
    notice.hidden = !pages[displayed].previewQuality;
    required<HTMLAnchorElement>(notice, 'a').href = standalone.href;
    fullscreen.disabled = !document.fullscreenEnabled;
    fullscreen.setAttribute('aria-label', `${document.fullscreenElement === reader ? 'Exit' : 'Enter'} newsletter full screen`);
    positionMotion();
  }

  async function showPage(index: number) {
    if (stopped || signal.aborted || index < 0 || index >= pages.length) return;
    desired = index;
    const request = ++sequence;
    const target = pages[index];
    reader.setAttribute('aria-busy', 'true');
    live.textContent = `Loading newsletter page ${target.number}.`;
    error.hidden = true;
    updateControls();
    try {
      const decoded = new Image();
      decoded.src = target.src;
      await decoded.decode();
      if (signal.aborted || stopped || request !== sequence) return;
      image.removeAttribute('srcset');
      desktopImage.srcset = target.src;
      image.src = target.src;
      image.width = target.width;
      image.height = target.height;
      image.alt = `Ashley Naoko newsletter page ${target.number} of ${pages.length}`;
      stopDecorations();
      displayed = index;
      zoom = 1;
      stage.scrollTo(0, 0);
      updateControls();
      motionStatus.textContent = '';
      synchronizeMotion();
      live.textContent = `Newsletter page ${target.number} of ${pages.length}${target.previewQuality ? ', preview-quality image' : ''}.`;
    } catch (cause) {
      if (signal.aborted || stopped || request !== sequence) return;
      error.hidden = false;
      errorText.textContent = `Page ${target.number} could not load. Page ${displayed + 1} is still displayed.`;
      live.textContent = `Page ${target.number} failed to load.`;
      console.error(`Newsletter page could not load: ${target.src}`, cause);
    } finally {
      if (request === sequence && !stopped) reader.removeAttribute('aria-busy');
    }
  }

  function toggleDesktop() {
    reader.toggleAttribute('data-newsletter-enhanced', desktop.matches);
    stage.tabIndex = desktop.matches ? 0 : -1;
    if (!desktop.matches) {
      sequence++;
      desired = displayed;
      reader.removeAttribute('aria-busy');
      error.hidden = true;
    }
    updateControls();
    synchronizeMotion();
  }

  const options = { signal };
  standalone.dataset.readerRoot = standalone.href;
  previous.addEventListener('click', () => void showPage(desired - 1), options);
  next.addEventListener('click', () => void showPage(desired + 1), options);
  for (const [area, direction] of [[previousArea, -1], [nextArea, 1]] as const) {
    let press: { x: number; y: number } | undefined;
    area.addEventListener('pointerdown', (event) => {
      press = event.button === 0 && event.isPrimary ? { x: event.clientX, y: event.clientY } : undefined;
    }, options);
    area.addEventListener('pointercancel', () => { press = undefined; }, options);
    area.addEventListener('click', (event) => {
      const accepted = event.detail === 0 || (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 8);
      press = undefined;
      if (accepted && !area.disabled && zoom === 1) {
        stage.focus({ preventScroll: true });
        void showPage(displayed + direction);
      }
    }, options);
  }
  retry.addEventListener('click', () => void showPage(desired), options);
  zoomSlider.addEventListener('input', () => { zoom = Number(zoomSlider.value) / 100; updateControls(); }, options);
  fit.addEventListener('click', () => { zoom = 1; stage.scrollTo(0, 0); updateControls(); }, options);
  hideControls.addEventListener('click', () => {
    reader.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((details) => { details.open = false; });
    reader.dataset.controlsHidden = '';
    showControls.hidden = false;
    showControls.focus();
  }, options);
  showControls.addEventListener('click', () => {
    reader.removeAttribute('data-controls-hidden');
    showControls.hidden = true;
    next.focus();
  }, options);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === reader) await document.exitFullscreen();
      else await reader.requestFullscreen();
    } catch (cause) {
      live.textContent = 'Full screen is unavailable. The inline reader remains available.';
      console.error('Newsletter full screen could not open.', cause);
    }
  }, options);
  document.addEventListener('fullscreenchange', updateControls, options);
  reader.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      reader.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((details) => {
        details.open = false;
        details.querySelector<HTMLElement>('summary')?.focus();
      });
    }
    if ((event.target !== stage && event.target !== previousArea && event.target !== nextArea) || zoom !== 1) return;
    if (event.key === 'ArrowLeft' && desired > 0) { event.preventDefault(); void showPage(desired - 1); }
    if (event.key === 'ArrowRight' && desired < pages.length - 1) { event.preventDefault(); void showPage(desired + 1); }
  }, options);
  reader.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (details.open) reader.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((other) => {
        if (other !== details) other.open = false;
      });
    }, options);
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !reader.contains(event.target)) {
      reader.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((details) => { details.open = false; });
    }
  }, options);
  image.addEventListener('error', () => {
    error.hidden = false;
    errorText.textContent = 'The newsletter image could not load.';
    console.error(`Newsletter image failed: ${image.currentSrc || image.src}`);
  }, options);
  desktop.addEventListener('change', toggleDesktop, options);
  const visibilityObserver = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
    synchronizeMotion();
  }, { threshold: 0 });
  visibilityObserver.observe(reader);
  const sizeObserver = new ResizeObserver(positionMotion);
  sizeObserver.observe(canvas);
  toggleDesktop();
  return {
    synchronize: synchronizeMotion,
    dispose: () => {
      stopped = true;
      sequence++;
      stopDecorations();
      visibilityObserver.disconnect();
      sizeObserver.disconnect();
      reader.removeAttribute('data-newsletter-enhanced');
      reader.removeAttribute('data-newsletter-page-navigation');
      reader.removeAttribute('aria-busy');
      canvas.style.removeProperty('--newsletter-zoom');
      reader.removeAttribute('data-controls-hidden');
      showControls.hidden = true;
      stage.tabIndex = -1;
    },
  };
}

function installInteractions(): () => void {
  const abort = new AbortController();
  const { signal } = abort;
  const options = { signal };
  const desktop = matchMedia('(min-width: 601px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const images = [...document.querySelectorAll<HTMLImageElement>('img[data-animated-src]')];
  const visibleImages = new Set<HTMLImageElement>();
  let focused = document.hasFocus();
  let suspended = false;
  const visible = () => focused && !document.hidden && !suspended;
  const motionAllowed = () => !reduced.matches && !forced.matches;
  const readers: NewsletterController[] = [];

  const players = [...document.querySelectorAll<HTMLElement>('.canva-video')].map((figure) => ({
    figure,
    video: required<HTMLVideoElement>(figure, 'video'),
    controls: required<HTMLElement>(figure, '[data-video-controls]'),
    toggle: required<HTMLButtonElement>(figure, '[data-source-video-control]'),
    seek: required<HTMLInputElement>(figure, '[data-video-seek]'),
    mute: required<HTMLButtonElement>(figure, '[data-video-mute]'),
    fullscreen: required<HTMLButtonElement>(figure, '[data-video-fullscreen]'),
    error: required<HTMLElement>(figure, '.media-error'),
    ambient: figure.dataset.sourceVideoMode === 'ambient',
    inView: false,
    userPaused: false,
    failed: false,
    pending: false,
  }));
  type Player = typeof players[number];

  const segment = ({ video }: Player) => {
    const start = desktop.matches ? Number(video.dataset.sourceStart) : 0;
    const end = desktop.matches ? Math.min(Number(video.dataset.sourceEnd), video.duration) : video.duration;
    return { start, end };
  };
  function update(player: Player) {
    const { video, figure, toggle, seek, mute } = player;
    const title = video.getAttribute('aria-label') ?? 'video';
    const { start, end } = segment(player);
    const playing = !video.paused && !video.ended;
    figure.toggleAttribute('data-video-playing', playing);
    figure.toggleAttribute('data-video-muted', video.muted);
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${title}`);
    mute.setAttribute('aria-label', `${video.muted ? 'Unmute' : 'Mute'} ${title}`);
    mute.disabled = video.dataset.hasAudio === 'false';
    seek.disabled = !Number.isFinite(end) || end <= start;
    seek.value = seek.disabled ? '0' : String(Math.round(Math.max(0, Math.min(1, (video.currentTime - start) / (end - start))) * 1000));
    if (!seek.disabled) seek.setAttribute('aria-valuetext', `${Math.max(0, video.currentTime - start).toFixed(1)} of ${(end - start).toFixed(1)} seconds`);
  }

  async function play(player: Player, userInitiated = false) {
    if (player.pending || player.failed) return;
    const { video } = player;
    const { start, end } = segment(player);
    if (video.readyState > 0 && (video.ended || video.currentTime < start || video.currentTime >= end)) video.currentTime = start;
    player.pending = true;
    try {
      await video.play();
      if (!visible() || (player.ambient && (!player.inView || !motionAllowed() || player.userPaused))) video.pause();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError' && video.paused) return;
      if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
        player.userPaused = true;
        if (userInitiated) {
          player.error.hidden = false;
          console.warn('Browser playback permission was denied; open the video file to play it.', cause);
        }
      } else {
        player.failed = true;
        player.controls.hidden = true;
        player.error.hidden = false;
        video.controls = true;
        console.error(`Video could not play: ${video.getAttribute('aria-label')}`, cause);
      }
    } finally {
      player.pending = false;
      update(player);
    }
  }

  function synchronize() {
    readers.forEach((reader) => reader.synchronize());
    images.forEach((image) => {
      if (!image.hasAttribute('src') && !visibleImages.has(image)) return;
      const src = motionAllowed() && visible() && visibleImages.has(image) ? image.dataset.animatedSrc : image.dataset.stillSrc;
      if (src && image.getAttribute('src') !== src) image.src = src;
    });
    for (const player of players) {
      if (!player.ambient) continue;
      if (!player.inView || !visible() || !motionAllowed()) {
        player.video.pause();
      } else if (player.video.paused && !player.userPaused && !player.failed) {
        void play(player);
      }
    }
  }
  const imageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!(entry.target instanceof HTMLImageElement)) continue;
      if (entry.isIntersecting) visibleImages.add(entry.target);
      else visibleImages.delete(entry.target);
    }
    synchronize();
  }, { rootMargin: '40px' });
  images.forEach((image) => imageObserver.observe(image));
  const videoObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const player = players.find(({ figure }) => figure === entry.target);
      if (!player) continue;
      player.inView = entry.isIntersecting;
    }
    synchronize();
  }, { threshold: .01 });
  const posterObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const player = players.find(({ figure }) => figure === entry.target);
      if (!player) continue;
      const poster = desktop.matches ? player.video.dataset.desktopPoster ?? player.video.dataset.poster : player.video.dataset.poster;
      if (poster) player.video.poster = poster;
      posterObserver.unobserve(entry.target);
    }
  }, { rootMargin: '80px' });

  for (const player of players) {
    const { figure, video, controls, toggle, seek, mute, fullscreen } = player;
    const volume = Number(video.dataset.sourceVolume);
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Invalid source audio volume.');
    video.volume = desktop.matches ? volume : 1;
    video.loop = player.ambient;
    video.controls = false;
    controls.hidden = false;
    figure.setAttribute('data-video-enhanced', '');
    if (player.ambient) {
      video.muted = true;
      videoObserver.observe(figure);
    }
    if (video.dataset.poster || video.dataset.desktopPoster) posterObserver.observe(figure);
    toggle.addEventListener('click', () => {
      if (video.paused) {
        player.userPaused = false;
        if (!desktop.matches && !player.ambient) { video.controls = true; controls.hidden = true; }
        void play(player, true);
      } else {
        player.userPaused = true;
        video.pause();
      }
    }, options);
    seek.addEventListener('input', () => {
      const { start, end } = segment(player);
      if (Number.isFinite(end) && end > start) video.currentTime = start + Number(seek.value) / 1000 * (end - start);
    }, options);
    mute.addEventListener('click', () => {
      if (video.muted && video.volume === 0) video.volume = 1;
      video.muted = !video.muted;
    }, options);
    fullscreen.disabled = !document.fullscreenEnabled;
    fullscreen.addEventListener('click', async () => {
      try {
        video.controls = true;
        await video.requestFullscreen();
      } catch (cause) {
        video.controls = false;
        player.error.hidden = false;
        console.error('Video full screen is unavailable. The video file remains available.', cause);
      }
    }, options);
    video.addEventListener('loadedmetadata', () => {
      const { start } = segment(player);
      if (video.currentTime < start) video.currentTime = start;
      update(player);
    }, options);
    video.addEventListener('timeupdate', () => {
      const { start, end } = segment(player);
      if (desktop.matches && Number.isFinite(end) && video.currentTime >= end) {
        if (player.ambient) video.currentTime = start;
        else if (!video.paused) { video.pause(); video.currentTime = end; }
      }
      update(player);
    }, options);
    for (const event of ['pause', 'ended', 'volumechange']) video.addEventListener(event, () => update(player), options);
    video.addEventListener('play', () => {
      if (!player.ambient) players.filter((other) => !other.ambient && other !== player).forEach((other) => other.video.pause());
      update(player);
    }, options);
    video.addEventListener('error', () => {
      player.failed = true;
      video.controls = true;
      controls.hidden = true;
      player.error.hidden = false;
      console.error(`Video could not load: ${video.getAttribute('aria-label')}`);
    }, { signal, capture: true });
    update(player);
  }

  for (const reader of document.querySelectorAll<HTMLElement>('[data-newsletter-reader]')) {
    try { readers.push(installNewsletter(reader, desktop, signal, () => motionAllowed() && visible())); }
    catch (cause) {
      reader.removeAttribute('data-newsletter-enhanced');
      console.error('The inline newsletter could not start; its standalone reader remains available.', cause);
    }
  }
  document.addEventListener('fullscreenchange', () => {
    players.forEach((player) => {
      if (document.fullscreenElement !== player.video && !player.failed) player.video.controls = false;
    });
  }, options);
  desktop.addEventListener('change', () => {
    for (const player of players) {
      if (!player.failed) { player.video.controls = false; player.controls.hidden = false; }
      if (player.video.dataset.desktopPoster) posterObserver.observe(player.figure);
    }
    synchronize();
  }, options);
  for (const query of [reduced, forced]) query.addEventListener('change', synchronize, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) players.forEach(({ video }) => video.pause());
    synchronize();
  }, options);
  window.addEventListener('blur', () => { focused = false; synchronize(); }, options);
  window.addEventListener('focus', () => { focused = true; synchronize(); }, options);
  window.addEventListener('pagehide', () => {
    suspended = true;
    players.forEach(({ video }) => video.pause());
    synchronize();
  }, options);
  window.addEventListener('pageshow', () => { suspended = false; focused = document.hasFocus(); synchronize(); }, options);
  synchronize();
  return () => {
    abort.abort();
    imageObserver.disconnect();
    posterObserver.disconnect();
    videoObserver.disconnect();
    readers.forEach((reader) => reader.dispose());
    images.forEach((image) => { if (image.hasAttribute('src') && image.dataset.stillSrc) image.src = image.dataset.stillSrc; });
    players.forEach(({ video, controls, figure }) => {
      video.pause();
      video.controls = true;
      controls.hidden = true;
      figure.removeAttribute('data-video-enhanced');
    });
  };
}

let dispose: (() => void) | undefined;
try { dispose = installInteractions(); }
catch (cause) {
  document.querySelectorAll<HTMLVideoElement>('.canva-video video').forEach((video) => { video.controls = true; });
  document.querySelectorAll<HTMLElement>('[data-video-controls]').forEach((controls) => { controls.hidden = true; });
  document.querySelectorAll('[data-newsletter-reader]').forEach((reader) => reader.removeAttribute('data-newsletter-enhanced'));
  console.error('Enhanced media controls could not start; native players and the standalone newsletter remain available.', cause);
}
window.addEventListener('error', () => { dispose?.(); dispose = undefined; });
