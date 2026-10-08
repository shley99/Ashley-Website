export {};

const preferenceKey = 'ashley-playful-effects';
const soundPreferenceKey = 'ashley-click-sound';
const root = document.documentElement;

function readPreference(key: string): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null && stored !== 'on' && stored !== 'off') {
      console.warn(`Unrecognized Studio Cat preference ${key}; using the default.`);
    }
    return stored !== 'off';
  } catch (error) {
    console.warn('Effects preferences are unavailable; changes will apply to this page only.', error);
    return true;
  }
}

function savePreference(key: string, enabled: boolean) {
  try {
    localStorage.setItem(key, enabled ? 'on' : 'off');
  } catch (error) {
    console.warn('The Studio Cat preference could not be saved; it still applies to this page.', error);
  }
}

function installDeferredImages(): () => void {
  const images = [...document.querySelectorAll<HTMLImageElement>('img[data-image-src]')];
  const activate = (image: HTMLImageElement) => {
    const source = image.dataset.imageSrc;
    if (source && !image.hasAttribute('src')) image.src = source;
  };

  if (!('IntersectionObserver' in window)) {
    images.forEach(activate);
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!(entry.target instanceof HTMLImageElement) || !entry.isIntersecting) continue;
      activate(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '160px' });
  images.forEach((image) => observer.observe(image));
  return () => observer.disconnect();
}

function installExperience(): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  const cursor = document.querySelector<HTMLElement>('#studio-cat');
  const face = cursor?.querySelector<SVGGElement>('.cat-face');
  const eyes = cursor?.querySelector<SVGGElement>('.cat-eyes');
  const template = document.querySelector<HTMLTemplateElement>('#paw-template');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-effects-toggle]')];
  const soundButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-cat-sound-toggle]')];
  const clickAudio = document.querySelector<HTMLAudioElement>('#studio-cat-click-audio');
  const soundStatus = document.querySelector<HTMLElement>('[data-cat-sound-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const fine = matchMedia('(any-pointer: fine) and (any-hover: hover)');
  const stamps = new Map<SVGSVGElement, Animation>();
  const supportsGuard = CSS.supports('selector(:has(*))');
  let preferred = readPreference(preferenceKey);
  let soundPreferred = readPreference(soundPreferenceKey);
  let soundFailed = false;
  let soundGeneration = 0;
  let focused = document.hasFocus();
  let active = false;
  let down: { x: number; y: number; pointerId: number } | undefined;
  let faceAnimation: Animation | undefined;
  let blinkAnimation: Animation | undefined;

  const motionAllowed = () => !reduced.matches && !forced.matches;
  const effectsEnabled = () => preferred && motionAllowed();
  const soundEnabled = () => soundPreferred && effectsEnabled() && fine.matches && supportsGuard && !soundFailed;
  const visible = () => focused && !document.hidden;
  const nativeZone = (target: EventTarget | null) => !(target instanceof Element) || Boolean(target.closest('a, button, input, textarea, select, label, summary, video, audio, iframe, [contenteditable]:not([contenteditable="false"]), [role="button"], [data-native-cursor], h1, h2, h3, h4, p, span, li, dd, dt, blockquote, figcaption, address'));

  function stopClickSound() {
    soundGeneration++;
    clickAudio?.pause();
    if (clickAudio && clickAudio.readyState > 0) clickAudio.currentTime = 0;
  }

  function updateSoundControls() {
    for (const button of soundButtons) {
      button.hidden = !fine.matches || !supportsGuard;
      button.disabled = !effectsEnabled() || soundFailed;
      button.setAttribute('aria-pressed', String(soundEnabled()));
      button.title = soundFailed
        ? 'Click sound is unavailable. Reload to try again; the cursor still works.'
        : !effectsEnabled() ? 'Enable Studio Cat and motion to use click sounds.'
          : `${soundPreferred ? 'Mute' : 'Unmute'} Studio Cat click sound`;
    }
  }

  function reportSoundFailure(error: unknown) {
    if (soundFailed) return;
    soundFailed = true;
    stopClickSound();
    updateSoundControls();
    if (soundStatus) soundStatus.textContent = 'The click sound could not play. Studio Cat still works; reload to try the sound again.';
    console.warn('Studio Cat click sound is unavailable; cursor behavior is unchanged.', error);
  }

  function audibleMediaPlaying() {
    return [...document.querySelectorAll<HTMLMediaElement>('video, audio')].some((media) =>
      media !== clickAudio && !media.paused && !media.ended && !media.muted && media.volume > 0);
  }

  function playClickSound() {
    if (!soundEnabled() || !visible() || audibleMediaPlaying()) return;
    const source = clickAudio?.dataset.clickSoundSrc;
    if (!clickAudio || !source) {
      reportSoundFailure(new Error('The click sound source is missing.'));
      return;
    }
    stopClickSound();
    const generation = soundGeneration;
    if (!clickAudio.hasAttribute('src')) {
      clickAudio.src = source;
      clickAudio.volume = .8;
    }
    void clickAudio.play().then(() => {
      if (generation === soundGeneration && (!visible() || !soundEnabled())) stopClickSound();
    }).catch((error: unknown) => {
      if (signal.aborted || generation !== soundGeneration) return;
      reportSoundFailure(error);
    });
  }

  clickAudio?.addEventListener('error', () => reportSoundFailure(clickAudio.error), { signal });
  for (const button of soundButtons) {
    button.addEventListener('click', () => {
      soundPreferred = !soundPreferred;
      savePreference(soundPreferenceKey, soundPreferred);
      stopClickSound();
      updateSoundControls();
    }, { signal });
  }

  function clearStamps() {
    for (const [stamp, animation] of stamps) {
      animation.cancel();
      stamp.remove();
    }
    stamps.clear();
  }

  function hideCursor() {
    root.removeAttribute('data-cat-active');
    if (cursor) {
      cursor.hidden = true;
      cursor.removeAttribute('data-pressed');
    }
    active = false;
    down = undefined;
    faceAnimation?.cancel();
    blinkAnimation?.cancel();
    clearStamps();
  }

  function updateEffects() {
    const enabled = effectsEnabled();
    root.dataset.effects = enabled ? 'on' : 'off';
    for (const button of buttons) {
      button.hidden = false;
      button.disabled = reduced.matches || forced.matches;
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', 'Studio Cat cursor');
      button.title = button.disabled ? 'Your device preferences keep Studio Cat off.' : `${enabled ? 'Turn off' : 'Turn on'} Studio Cat`;
      const label = button.querySelector('[data-effects-label]');
      if (label) label.textContent = enabled ? 'on' : 'off';
    }
    if (!enabled || !fine.matches) {
      hideCursor();
      stopClickSound();
    }
    updateSoundControls();
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      preferred = !preferred;
      savePreference(preferenceKey, preferred);
      updateEffects();
    }, { signal });
  }

  function movePointer(event: PointerEvent) {
    const dragging = down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8;
    if (!cursor || !face || !supportsGuard || event.pointerType !== 'mouse' || !fine.matches || !effectsEnabled() || !visible() || nativeZone(event.target) || dragging || (event.buttons !== 0 && !down)) {
      hideCursor();
      return;
    }
    // The ear tip is the hotspot; only the expression moves, never the click coordinate.
    cursor.style.transform = `translate3d(${event.clientX - 3.6}px,${event.clientY - 2.7}px,0)`;
    face.style.translate = `${Math.max(-.7, Math.min(.7, event.movementX * .06))}px 0`;
    if (!active) {
      cursor.hidden = false;
      root.setAttribute('data-cat-active', '');
      active = true;
    }
  }

  function stampPaw(x: number, y: number) {
    const stamp = template?.content.firstElementChild?.cloneNode(true);
    if (!(stamp instanceof SVGSVGElement)) return;
    if (stamps.size >= 4) {
      const oldest = stamps.keys().next().value;
      if (oldest) {
        stamps.get(oldest)?.cancel();
        oldest.remove();
        stamps.delete(oldest);
      }
    }
    stamp.style.left = `${x + 34}px`;
    stamp.style.top = `${y + 30}px`;
    document.body.append(stamp);
    const animation = stamp.animate([
      { opacity: .65, transform: 'translateY(0) rotate(-12deg) scale(.8)' },
      { opacity: .7, transform: 'translateY(-2px) rotate(-12deg) scale(1)', offset: .2 },
      { opacity: 0, transform: 'translateY(-10px) rotate(-12deg) scale(.95)' },
    ], { duration: 480, easing: 'ease-out' });
    stamps.set(stamp, animation);
    animation.onfinish = () => { stamps.delete(stamp); stamp.remove(); };
  }

  document.addEventListener('pointermove', movePointer, { passive: true, signal });
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || nativeZone(event.target)) {
      hideCursor();
      stopClickSound();
      return;
    }
    if (active && cursor) {
      down = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      cursor.setAttribute('data-pressed', '');
    }
  }, { passive: true, signal });
  document.addEventListener('pointerup', (event) => {
    if (cursor) cursor.removeAttribute('data-pressed');
    if (down && active && effectsEnabled() && visible() && event.pointerType === 'mouse' && event.pointerId === down.pointerId && event.button === 0 && !nativeZone(event.target) && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 8) {
      faceAnimation?.cancel();
      faceAnimation = face?.animate([{ transform: 'scaleY(.8)' }, { transform: 'scaleY(1.04)', offset: .6 }, { transform: 'scaleY(1)' }], { duration: 230, easing: 'ease-out' });
      blinkAnimation?.cancel();
      blinkAnimation = eyes?.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)', offset: .4 }, { transform: 'scaleY(1)' }], { duration: 280, easing: 'ease-out' });
      stampPaw(event.clientX, event.clientY);
      playClickSound();
    }
    down = undefined;
  }, { passive: true, signal });
  document.addEventListener('pointercancel', () => { hideCursor(); stopClickSound(); }, { signal });
  document.documentElement.addEventListener('pointerleave', hideCursor, { signal });
  document.addEventListener('keydown', () => { hideCursor(); stopClickSound(); }, { signal });
  document.addEventListener('dragstart', () => { hideCursor(); stopClickSound(); }, { signal });
  document.addEventListener('play', (event) => {
    const media = event.target;
    if (media instanceof HTMLMediaElement && media !== clickAudio && !media.muted && media.volume > 0) stopClickSound();
  }, { signal, capture: true });
  window.addEventListener('blur', () => { focused = false; hideCursor(); stopClickSound(); }, { signal });
  window.addEventListener('focus', () => { focused = true; }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hideCursor(); stopClickSound(); }
  }, { signal });
  for (const query of [reduced, forced, fine]) {
    query.addEventListener('change', () => { hideCursor(); updateEffects(); }, { signal });
  }
  updateEffects();

  return () => {
    stopClickSound();
    hideCursor();
    abort.abort();
    if (clickAudio?.hasAttribute('src')) {
      clickAudio.removeAttribute('src');
      clickAudio.load();
    }
    for (const button of soundButtons) button.hidden = true;
    for (const button of buttons) button.hidden = true;
    root.dataset.effects = 'off';
  };
}

let dispose: (() => void) | undefined;
let disposeDeferredImages: (() => void) | undefined;
function mount() {
  dispose?.();
  disposeDeferredImages?.();
  disposeDeferredImages = installDeferredImages();
  try {
    dispose = installExperience();
  } catch (error) {
    root.removeAttribute('data-cat-active');
    root.dataset.effects = 'off';
    const cursor = document.querySelector<HTMLElement>('#studio-cat');
    if (cursor) cursor.hidden = true;
    console.error('Playful effects could not start. The native pointer and portfolio remain available.', error);
  }
}
window.addEventListener('pagehide', () => {
  dispose?.();
  dispose = undefined;
  disposeDeferredImages?.();
  disposeDeferredImages = undefined;
});
window.addEventListener('pageshow', (event) => { if (event.persisted) mount(); });
window.addEventListener('error', () => { dispose?.(); dispose = undefined; root.removeAttribute('data-cat-active'); });
mount();
