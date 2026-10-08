import { installPawKit } from './paw-kit';

const root = document.documentElement;

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

let dispose: (() => void) | undefined;
let disposeDeferredImages: (() => void) | undefined;
function mount() {
  dispose?.();
  disposeDeferredImages?.();
  disposeDeferredImages = installDeferredImages();
  try {
    dispose = installPawKit();
  } catch (error) {
    root.classList.remove('an-js-paw', 'an-paw-mid', 'an-paw-back');
    document.querySelector('#an-paw-cursor')?.remove();
    console.error('The paw cursor could not start. The static paw cursor and portfolio remain available.', error);
  }
}
window.addEventListener('pagehide', () => {
  dispose?.();
  dispose = undefined;
  disposeDeferredImages?.();
  disposeDeferredImages = undefined;
});
window.addEventListener('pageshow', (event) => { if (event.persisted) mount(); });
// Any runtime error falls back to the static paw cursor rather than risking a hidden pointer.
window.addEventListener('error', () => { dispose?.(); dispose = undefined; });
mount();
