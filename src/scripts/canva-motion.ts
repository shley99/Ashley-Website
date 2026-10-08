import type { CanvaContinuousMotion } from '../types/canva';

function readMotion(node: HTMLElement): CanvaContinuousMotion {
  const motion: unknown = JSON.parse(node.dataset.continuousMotion ?? '');
  if (!motion || typeof motion !== 'object' || !('duration' in motion) || !('interval' in motion) || !('frames' in motion)) {
    throw new Error(`Missing motion contract for ${node.dataset.canvaNodeId}.`);
  }
  const { duration, interval, frames } = motion;
  if (
    typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0
    || typeof interval !== 'number' || !Number.isFinite(interval) || interval <= 0
    || !Array.isArray(frames) || frames.length < 2
    || !frames.every((frame): frame is [number, number, number] =>
      Array.isArray(frame) && frame.length === 3 && frame.every((value) => typeof value === 'number' && Number.isFinite(value)))
  ) throw new Error(`Invalid motion frames for ${node.dataset.canvaNodeId}.`);
  return { duration, interval, frames };
}

function installCanvaMotion(): () => void {
  const root = document.documentElement;
  const abort = new AbortController();
  const { signal } = abort;
  const desktop = matchMedia('(min-width: 601px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const pages = [...document.querySelectorAll<HTMLElement>('[data-canva-page]')];
  const headings = [...document.querySelectorAll<HTMLElement>('[data-canva-typewriter]')];
  const lines = [...document.querySelectorAll<SVGSVGElement>('[data-line-reveal]')].map((node) => {
    const value: unknown = JSON.parse(node.dataset.lineReveal ?? '');
    if (!value || typeof value !== 'object' || !('distance' in value) || !('duration' in value) || !('frames' in value)) {
      throw new Error(`Missing observed line entrance for ${node.dataset.canvaNodeId}.`);
    }
    const { distance, duration, frames } = value;
    if (typeof distance !== 'number' || !Number.isFinite(distance)
      || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0
      || !Array.isArray(frames) || !frames.every((frame): frame is [number, number] =>
        Array.isArray(frame) && frame.length === 2 && frame.every((part) => typeof part === 'number' && Number.isFinite(part)))) {
      throw new Error(`Invalid observed line entrance for ${node.dataset.canvaNodeId}.`);
    }
    return { node, distance, duration, frames };
  });
  const activePages = new Set<HTMLElement>();
  const finite = new Set<Animation>();
  const loops = [...document.querySelectorAll<HTMLElement>('[data-continuous-motion]')].map((node) => {
    const shell = node.querySelector<HTMLElement>('[data-motion-shell]');
    const page = node.closest<HTMLElement>('[data-canva-page]');
    if (!shell || !page) throw new Error(`Missing motion shell for ${node.dataset.canvaNodeId}.`);
    return { shell, page, motion: readMotion(node), animation: undefined as Animation | undefined, time: 0 };
  });
  let focused = document.hasFocus();
  let suspended = false;
  const motionReduced = () => reduced.matches || forced.matches;
  const paused = () => suspended || document.hidden || !focused;

  function finishHeading(heading: HTMLElement) {
    heading.classList.remove('is-type-pending', 'is-type-revealing');
    heading.classList.add('is-type-complete');
    heading.dataset.sourceRevealed = '';
  }

  function revealHeading(heading: HTMLElement) {
    if (heading.hasAttribute('data-source-revealed')) return finishHeading(heading);
    heading.dataset.sourceRevealed = '';
    if (motionReduced()) return finishHeading(heading);
    heading.classList.remove('is-type-pending');
    heading.classList.add('is-type-revealing');
    const characters = heading.querySelectorAll<HTMLElement>(
      `.canva-text-content--${desktop.matches ? 'desktop' : 'mobile'} .canva-type-character`,
    );
    const last = characters.item(characters.length - 1);
    if (last) last.addEventListener('animationend', () => finishHeading(heading), { once: true, signal });
    else finishHeading(heading);
  }

  function synchronize() {
    root.toggleAttribute('data-source-motion-paused', paused() || motionReduced());
    for (const loop of loops) {
      if (!desktop.matches || motionReduced()) {
        if (loop.animation) {
          loop.time = Number(loop.animation.currentTime ?? 0);
          loop.animation.cancel();
          loop.animation = undefined;
        }
        continue;
      }
      if (!loop.animation) {
        const { motion } = loop;
        loop.animation = loop.shell.animate(motion.frames.map(([x, y, rotation], index) => ({
          transform: `translate(${x}%, ${y}%) rotate(${rotation}deg)`,
          offset: index === motion.frames.length - 1 ? 1 : index * motion.interval / motion.duration,
        })), { duration: motion.duration * 1000, iterations: Infinity, easing: 'linear' });
        loop.animation.currentTime = loop.time;
      }
      if (!paused() && activePages.has(loop.page)) loop.animation.play();
      else loop.animation.pause();
    }
    for (const animation of finite) {
      if (motionReduced()) animation.finish();
      else if (paused()) animation.pause();
      else animation.play();
    }
    if (motionReduced()) headings.forEach(finishHeading);
    if (motionReduced() || !desktop.matches) {
      lines.forEach(({ node }) => { node.classList.remove('is-line-pending'); node.dataset.sourceEntered = ''; });
    }
  }

  const pageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!(entry.target instanceof HTMLElement)) continue;
      const active = entry.isIntersecting && entry.intersectionRatio > .005;
      entry.target.classList.toggle('is-source-active', active);
      if (active) activePages.add(entry.target);
      else activePages.delete(entry.target);
    }
    synchronize();
  }, { threshold: .005 });
  pages.forEach((page) => pageObserver.observe(page));

  const headingObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target instanceof HTMLElement) {
        revealHeading(entry.target);
        headingObserver.unobserve(entry.target);
      }
    }
  }, { threshold: .01 });
  for (const heading of headings) {
    if (heading.hasAttribute('data-source-revealed') || motionReduced()) finishHeading(heading);
    else heading.classList.add('is-type-pending');
    headingObserver.observe(heading);
  }

  const entranceDelays: Record<string, number> = {
    LBpXlxrypPRVzGzW: 0,
    LBhw8F3CDkDvmqg1: 90,
    LBZXkFBD6GXKStPP: 180,
    LBkGhBgrSJ5bBV58: 270,
    LB2Gn4btfHQ4sKPN: 360,
  };
  const entryObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
      const node = entry.target;
      entryObserver.unobserve(node);
      if (node.hasAttribute('data-source-entered')) continue;
      node.dataset.sourceEntered = '';
      if (motionReduced()) continue;
      const shell = node.querySelector<HTMLElement>('.canva-entry-shell');
      if (!shell) throw new Error(`Missing entrance shell for ${node.dataset.canvaNodeId}.`);
      const animation = shell.animate([
        { transform: 'scale(0)' },
        { transform: 'scale(1.18)', offset: .52 },
        { transform: 'scale(.96)', offset: .72 },
        { transform: 'scale(1.035)', offset: .88 },
        { transform: 'scale(1)' },
      ], { duration: 640, delay: entranceDelays[node.dataset.canvaNodeId ?? ''] ?? 0, easing: 'ease-out', fill: 'backwards' });
      finite.add(animation);
      animation.addEventListener('finish', () => finite.delete(animation), { once: true, signal });
    }
    synchronize();
  }, { threshold: 0 });
  document.querySelectorAll<HTMLElement>('[data-hero-entry]').forEach((node) => entryObserver.observe(node));

  const lineObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !(entry.target instanceof SVGSVGElement)) continue;
      lineObserver.unobserve(entry.target);
      const line = lines.find(({ node }) => node === entry.target);
      if (!line || line.node.hasAttribute('data-source-entered')) continue;
      line.node.dataset.sourceEntered = '';
      line.node.classList.remove('is-line-pending');
      if (!desktop.matches || motionReduced()) continue;
      const animation = line.node.animate(line.frames.map(([time, opacity], index) => ({
        opacity,
        translate: `${-line.distance * (1 - opacity) / 1366 * 100}cqw 0`,
        offset: index === line.frames.length - 1 ? 1 : time / line.duration,
      })), { duration: line.duration * 1000, easing: 'linear', fill: 'backwards' });
      finite.add(animation);
      animation.addEventListener('finish', () => finite.delete(animation), { once: true, signal });
    }
    synchronize();
  }, { threshold: .01 });
  lines.forEach(({ node }) => {
    if (!node.hasAttribute('data-source-entered') && desktop.matches && !motionReduced()) node.classList.add('is-line-pending');
    lineObserver.observe(node);
  });

  document.addEventListener('visibilitychange', synchronize, { signal });
  window.addEventListener('blur', () => { focused = false; synchronize(); }, { signal });
  window.addEventListener('focus', () => { focused = true; synchronize(); }, { signal });
  window.addEventListener('pagehide', () => { suspended = true; synchronize(); }, { signal });
  window.addEventListener('pageshow', () => { suspended = false; focused = document.hasFocus(); synchronize(); }, { signal });
  for (const query of [desktop, reduced, forced]) query.addEventListener('change', synchronize, { signal });
  root.setAttribute('data-source-motion-ready', '');
  synchronize();

  return () => {
    abort.abort();
    pageObserver.disconnect();
    headingObserver.disconnect();
    entryObserver.disconnect();
    lineObserver.disconnect();
    loops.forEach(({ animation }) => animation?.cancel());
    finite.forEach((animation) => animation.cancel());
    headings.forEach(finishHeading);
    lines.forEach(({ node }) => node.classList.remove('is-line-pending'));
    root.removeAttribute('data-source-motion-paused');
  };
}

let dispose: (() => void) | undefined;
try {
  dispose = installCanvaMotion();
} catch (error) {
  document.documentElement.setAttribute('data-source-motion-ready', '');
  document.querySelectorAll('[data-canva-typewriter]').forEach((heading) => {
    heading.classList.remove('is-type-pending', 'is-type-revealing');
    heading.classList.add('is-type-complete');
  });
  console.error('Source motion could not start; the static portfolio remains available.', error);
}
window.addEventListener('error', () => { dispose?.(); dispose = undefined; });
