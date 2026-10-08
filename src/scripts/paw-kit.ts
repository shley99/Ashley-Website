// TypeScript port of the kit's paw cursor + scroll rips ("Paw changes/4-paw-and-scroll-rips.html").
// The pixel paw follows a mouse or pen, flips to its back (claws out) while scrolling down, and leaves thin
// rips as long as the scroll that fade away. Touch input never activates it, so phones are left alone.

type Point = { x: number; y: number };
type Segment = { x0: number; y0: number; x1: number; y1: number; p: number };
type Stroke = { id: number; segs: Segment[]; end: number; last: Point | null; y0: number; p: number };
type Side = 'front' | 'back';
type FrameClass = '' | 'an-paw-mid' | 'an-paw-back';

// Claw tip positions relative to the cursor's click point (back-of-paw image).
const TIPS = [[-15.7, -0.9], [-2.9, -4.7], [10.8, -2.7]] as const;
const PX = 2; // one scratch "pixel" = 2 screen pixels (thin rips)
const IDLE = 200; // scroll counts as finished after this pause (ms)
const HOLD = 350; // scratch stays fully visible this long after scrolling stops
const FADE = 1300; // then fades out over this long
const TAPER = 6; // rows at each end that thin out
const FLIP = 70; // the in-between frame shows this long while the paw turns over
const PAW = { size: 44, hx: 21, hy: 6 };
// The newsletter's click-to-turn areas keep their directional cursors.
const NATIVE_CURSOR_ZONE = '.canva-newsletter-page-area:not(:disabled)';

// Stable pseudo-random numbers tied to page position, so a tear keeps its shape while the page moves.
function hash(n: number): number {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

// Smooth -1..1 drift along the tear.
function wobble(seed: number, row: number): number {
  const a = Math.floor(row / 5);
  const f = row / 5 - a;
  const h0 = hash(seed * 7919 + a) * 2 - 1;
  const h1 = hash(seed * 7919 + a + 1) * 2 - 1;
  return h0 + (h1 - h0) * f * f * (3 - 2 * f);
}

export function installPawKit(): () => void {
  const root = document.documentElement;
  const layer = document.querySelector<HTMLCanvasElement>('#an-scratch-layer');
  const front = layer?.dataset.pawFront;
  const mid = layer?.dataset.pawMid;
  const back = layer?.dataset.pawBack;
  if (!layer || !front || !mid || !back) {
    console.warn('The paw cursor layer is missing; the static paw cursor remains.');
    return () => {};
  }
  const canvas = layer;
  const frames = { front, mid, back };

  const abort = new AbortController();
  const { signal } = abort;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const allowed = () => !reduced.matches && !forced.matches;

  let ctx: CanvasRenderingContext2D | null = null;
  let paw: HTMLImageElement | null = null;
  let pawReady = false;
  let W = 0;
  let H = 0;
  let mouse: Point | null = null;
  let outside = false;
  let nativeZone = false;
  let side: Side = 'front';
  let flipTimer = 0;
  let idleTimer = 0;
  let frame = 0;
  let strokes: Stroke[] = [];
  let current: Stroke | null = null;
  let nextId = 1;
  let lastY = window.scrollY;
  let lastT = performance.now();

  // Full screen media sits in the browser's top layer, where the on-page paw cannot be drawn.
  const yielding = () => nativeZone || document.fullscreenElement !== null;

  function resize() {
    if (!ctx) return;
    W = Math.ceil(root.clientWidth / PX);
    H = Math.ceil(root.clientHeight / PX);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * PX}px`;
    canvas.style.height = `${H * PX}px`;
  }

  // Shows the on-page paw (and hides the system cursor) only once a mouse is in use and the paw image is ready.
  function sync() {
    const active = paw !== null && pawReady && mouse !== null && !yielding();
    root.classList.toggle('an-js-paw', active);
    if (paw) paw.style.opacity = active && !outside ? '1' : '0';
  }

  function activate(): boolean {
    if (paw) return true;
    if (!allowed()) return false;
    ctx = canvas.getContext('2d');
    resize();
    const image = document.createElement('img');
    image.id = 'an-paw-cursor';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.style.width = `${PAW.size}px`;
    image.style.height = `${PAW.size}px`;
    image.src = frames.front;
    document.body.append(image);
    paw = image;
    const probe = new Image();
    probe.src = frames.front;
    probe.decode().then(
      () => {
        if (paw !== image) return;
        pawReady = true;
        sync();
      },
      (error: unknown) => console.warn('The paw cursor image could not load; the static paw cursor remains.', error),
    );
    for (const source of [frames.mid, frames.back]) new Image().src = source; // preload the flip frames
    return true;
  }

  function deactivate() {
    clearTimeout(flipTimer);
    clearTimeout(idleTimer);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    strokes = [];
    current = null;
    mouse = null;
    side = 'front';
    pawReady = false;
    paw?.remove();
    paw = null;
    root.classList.remove('an-js-paw', 'an-paw-mid', 'an-paw-back');
    ctx?.clearRect(0, 0, W, H);
  }

  function place(x: number, y: number) {
    mouse = { x, y };
    outside = false;
    if (paw) paw.style.transform = `translate(${x - PAW.hx}px,${y - PAW.hy}px)`;
    sync();
  }

  // ---- paw flip: front (beans) <-> back (claws out) ----
  function setFrame(name: FrameClass) {
    root.classList.remove('an-paw-mid', 'an-paw-back');
    if (name) root.classList.add(name);
    if (paw) paw.src = name === 'an-paw-back' ? frames.back : name === 'an-paw-mid' ? frames.mid : frames.front;
  }

  function flipTo(target: Side) {
    if (side === target) return;
    side = target;
    clearTimeout(flipTimer);
    setFrame('an-paw-mid');
    flipTimer = window.setTimeout(() => setFrame(target === 'back' ? 'an-paw-back' : ''), FLIP);
  }

  function endStroke() {
    if (current) {
      current.end = performance.now();
      current = null;
    }
    flipTo('front');
  }

  // ---- drawing: thin, jagged rips in the page ----
  function tear(context: CanvasRenderingContext2D, stroke: Stroke, last: Point, k: number, alpha: number, sx: number, sy: number) {
    const seed = stroke.id * 4 + k;
    const [tx, ty] = TIPS[k];
    const top = stroke.y0 + ty;
    const bottom = last.y + ty;
    let prevCol: number | null = null;
    for (const s of stroke.segs) {
      const ya = s.y0 + ty;
      const yb = s.y1 + ty;
      const r0 = Math.ceil(ya / PX);
      const r1 = Math.floor(yb / PX);
      for (let r = r0; r <= r1; r++) {
        const screenRow = r - Math.floor(sy / PX);
        if (screenRow < -1 || screenRow > H + 1) continue;
        const t = yb > ya ? (r * PX - ya) / (yb - ya) : 0;
        const px = s.x0 + (s.x1 - s.x0) * t + tx;
        const col = Math.round((px - sx) / PX + wobble(seed, r) * 1.2);
        const fromTop = (r * PX - top) / PX;
        const fromBottom = (bottom - r * PX) / PX;
        const edge = Math.min(fromTop, fromBottom, TAPER) / TAPER; // 0 at the ends, 1 in the middle
        if (edge < 1 && hash(seed * 131 + r) > edge + 0.15) { // ragged, broken ends
          prevCol = col;
          continue;
        }
        const a = alpha * (0.55 + 0.45 * edge);
        // dark slit (the rip)
        context.fillStyle = `rgba(38,18,78,${a.toFixed(3)})`;
        context.fillRect(col, screenRow, 1, 1);
        // where the tear zig-zags, fill the step so it stays connected
        if (prevCol !== null && col !== prevCol) context.fillRect(Math.min(col, prevCol), screenRow, Math.abs(col - prevCol), 1);
        // light torn-paper lip on one side, broken up so it looks frayed
        if (hash(seed * 977 + r) > 0.22) {
          context.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
          context.fillRect(col + 1, screenRow, 1, 1);
        }
        // the odd fleck of torn fibre on the other side
        if (hash(seed * 313 + r) > 0.9) {
          context.fillStyle = `rgba(255,255,255,${(a * 0.7).toFixed(3)})`;
          context.fillRect(col - 1, screenRow, 1, 1);
        }
        prevCol = col;
      }
    }
  }

  // Runs only while rips are on screen; the loop stops once the last one has faded.
  function draw(now: number) {
    frame = 0;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const sx = window.scrollX;
    const sy = window.scrollY;
    const keep: Stroke[] = [];
    for (const stroke of strokes) {
      let a = 1;
      if (stroke.end) {
        const age = now - stroke.end - HOLD;
        if (age > FADE) continue;
        if (age > 0) a = 1 - age / FADE;
      }
      keep.push(stroke);
      if (!stroke.last) continue;
      const alpha = a * (0.75 + 0.25 * stroke.p);
      for (let k = 0; k < TIPS.length; k++) tear(ctx, stroke, stroke.last, k, alpha, sx, sy);
    }
    strokes = keep;
    if (strokes.length) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, W, H);
  }

  // ---- input ----
  const track = (event: MouseEvent) => {
    if (!activate()) return;
    nativeZone = event.target instanceof Element && event.target.closest(NATIVE_CURSOR_ZONE) !== null;
    place(event.clientX, event.clientY);
  };
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') track(event);
  }, { passive: true, signal });
  window.addEventListener('wheel', track, { passive: true, signal });
  window.addEventListener('resize', resize, { signal });
  document.addEventListener('mouseout', (event) => {
    if (event.relatedTarget) return;
    outside = true;
    sync();
  }, { signal });
  document.addEventListener('fullscreenchange', () => {
    // Wait for the next real pointer position after entering or leaving full screen.
    mouse = null;
    endStroke();
    sync();
  }, { signal });
  const preferenceChanged = () => {
    if (!allowed()) deactivate();
  };
  reduced.addEventListener('change', preferenceChanged, { signal });
  forced.addEventListener('change', preferenceChanged, { signal });

  // ---- scratches: one stroke per scroll, as long as the scroll ----
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const now = performance.now();
    const dy = y - lastY;
    const dt = Math.max(8, now - lastT);
    if (dy > 0 && mouse && paw && !yielding()) {
      flipTo('back');
      if (!current) {
        current = { id: nextId++, segs: [], end: 0, last: null, y0: mouse.y + lastY, p: 0 };
        strokes.push(current);
      }
      const raw = Math.min(1, dy / dt / 3); // faster scroll = deeper scratch
      const power = current.segs.length ? current.p * 0.75 + raw * 0.25 : raw; // smoothed so the line stays even
      current.p = power;
      const px = mouse.x + window.scrollX;
      const from = current.last ?? { x: px, y: mouse.y + lastY };
      const to = { x: px, y: mouse.y + y };
      current.segs.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, p: power });
      current.last = to;
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(endStroke, IDLE);
      if (!frame && ctx) frame = requestAnimationFrame(draw);
    } else if (dy < 0) {
      clearTimeout(idleTimer);
      if (current) {
        current.end = now;
        current = null;
      }
      flipTo('front'); // scrolling up: no scratches
    }
    lastY = y;
    lastT = now;
  }, { passive: true, signal });

  return () => {
    abort.abort();
    deactivate();
  };
}
