# Ashley Naoko

An independently hosted, source-controlled recreation of Ashley Naoko's Canva portfolio. It preserves the five original artboards, maker collage, writing, artwork, newsletter, eight videos, and measured source motion, with one declared addition: the animated **Studio Cat** cursor.

**Private source:** `Nicolassalazar-pro/ashley-naoko`  
**Public preview:** <https://nicolassalazar-pro.github.io/ashley-naoko/>

This project does **not** replace `ashleynaoko.com`. The existing domain, DNS, email, Canva hosting, and subscriptions remain untouched. A custom-domain cutover would be a separate decision. The Pages preview requests `noindex`; that is not access control. Deployed HTML, JavaScript, fonts, documents, and media are public even though the source repository is private.

The recording-led correction pass targets **desktop fidelity**. The commissioning user authorized a refreshed Pages preview with Partita 1990; this does not authorize an `ashleynaoko.com` cutover or constitute new mobile visual acceptance.

## Architecture

The homepage is a lightweight Astro static build, not a Canva embed or exported Canva runtime:

- `src\content\canva-home.json` contains five source artboards and 162 positioned nodes.
- `src\components\CanvaHome.astro` and `CanvaNode.astro` render text, images, animation, video, vectors, curved arrows, contact links, and the newsletter entry.
- `src\styles\canva-home.css` applies the measured desktop and 390px mobile geometry.
- `src\scripts\canva-motion.ts` implements the observed typewriter, collage translation/rotation, and finite entrances.
- `src\scripts\canva-interactions.ts` owns media playback and the inline newsletter, independently of the cursor preference.
- `src\scripts\experience.ts` manages Studio Cat and deferred image activation.

The committed model was generated from owner-authorized public design metadata with `scripts\generate-fidelity.mjs`. Normal builds use the committed JSON and prepared assets; they do not contact Canva.

The renderer preserves the authored normal-view composition, including small type and source contrast choices. Keyboard, reduced-motion, forced-colors, touch, no-JavaScript, and media-failure states are handled separately rather than redesigning the reference page.

## Work locally

Use Node 22.19+ or a newer supported release and npm:

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:4450/` in Brave or another browser. The Windows parent folder contains an ampersand, so `run.mjs` invokes Node entrypoints directly instead of relying on problematic command shims. The explicit `--ignore-lock` keeps the owned Astro server in the foreground and allows the two validation ports; occupied ports fail rather than silently moving.

Run the release checks:

```powershell
npm run check
npm run test:unit
npm run build
npm run verify
npm run build:demo
npm run verify:demo
npm test
```

The browser suite uses an isolated headless Brave profile, never an everyday browser profile. On Windows, the installed per-user Brave path is used by default; set `BRAVE_PATH` when needed. Stop manual previews on ports 4450 and 4451 before running Playwright.

The root artifact is `dist`. The GitHub Pages artifact is `dist-demo` and is built below `/ashley-naoko/`.

```powershell
npm run preview
npm run preview:demo
npm run capture -- --demo
```

Settled five-artboard desktop/mobile captures go to `test-results\captures`. Set `CAPTURE_DIR` to choose another ignored evidence directory. The capture hides only Studio Cat and its control, uses reduced motion for stable composition proof, and records viewport/DPR conditions in `capture.json`.

For actual desktop motion, start a local preview and run:

```powershell
npm run capture:motion -- http://127.0.0.1:4450/
```

This separate capture records a cold opening, the full desktop route, return visits, normal-motion viewport frames and a video at 1522 x 830, DPR 1. It does not disable page animations. Captures go to ignored `research\motion-captures`; an optional second argument selects a new output directory. A recorded frame or a passing structural test alone is not visual acceptance.

## Edit the portfolio

| What | Where |
| --- | --- |
| Source artboard text, positions, crops, layers, and node roles | `src\content\canva-home.json` |
| Deterministic source-model generation | `scripts\generate-fidelity.mjs` |
| Contact details, YouTube URL, title, and description | `src\content\portfolio.ts` |
| Prepared legacy media roles and dimensions | `src\content\media.json` |
| Video sources, posters, dimensions, durations | `src\content\videos.json` |
| Newsletter pages, extracted text, and quality notices | `src\content\newsletter.json` |
| Page-specific newsletter animations | `src\content\newsletter-motion.json`, `scripts\prepare-newsletter-motion.mjs` |
| Homepage rendering | `src\components\CanvaHome.astro`, `src\components\CanvaNode.astro` |
| Responsive presentation and source motion | `src\styles\canva-home.css`, `src\scripts\canva-motion.ts` |
| Inline newsletter and media lifecycle | `src\scripts\canva-interactions.ts` |
| Cursor and image activation | `src\scripts\experience.ts` |
| Cursor click sound and source hash | `src\content\cursor-audio.json`, `public\media\studio-cat-click.m4a` |
| Public files | `public\fidelity`, `public\media`, `public\documents`, `public\fonts` |

`canva-home.json` is generated. For a durable composition change, update the authorized source inputs or generator and rerun:

```powershell
npm run fidelity:generate
```

That command requires the intentionally uncommitted `research\canva-design.json`, desktop/mobile layout measurements, `research\desktop-motion-evidence.json`, and authorized originals. The motion evidence contains measured translation/rotation samples and line-entrance timing, not just Canva effect identifiers. It rebuilds managed `public\fidelity` assets and provenance, including image-filled shapes, trimmed-video posters and the responsive newsletter cover.

Desktop text retains authored line boundaries and mixed-color runs. Media keeps inner crop rotation/offset separately from outer placement. The vector renderer distinguishes transparency from opacity, rounded rectangles from arbitrary paths, and image-filled shapes from solid paint. Compact-viewport geometry and legacy presentation are retained separately; they are not new fidelity work.

`npm run assets` is the original media migration/regeneration tool, not part of normal builds. It additionally requires ignored source downloads, newsletter captures, FFmpeg, and ffprobe. It preserves continuous source animation timing, prepares the eight MP4s and posters, builds the image-edition PDF, and copies the current licensed fonts. Do not rerun either generator blindly after manual changes to generated files.

Use `withBase()` for local URLs. The standalone build uses `/`, while Pages uses `/ashley-naoko/`.

## Fonts and fidelity boundary

The exact freely licensed source families are self-hosted:

- Montserrat for the main portfolio copy.
- Roboto for the reconstructed YouTube/player presentation.
- DM Sans for source UI roles.

The commissioning user selected **Partita 1990 Regular**, designed by Stefano Giliberti (brumale), for the retro headings. Its prepared 15 KiB WOFF2 is self-hosted at `public\fonts\partita-1990.woff2`; all thirteen homepage headings are calibrated against the retained source ink bounds. Body fonts, artboard geometry and reveal timing are unchanged. Silkscreen remains a locally hosted fallback, not the selected display font, and is no longer preloaded.

The recovered Canva metadata names its face Retropix. That source identity is preserved separately from the user's Partita 1990 selection; the two names are not assumed to be interchangeable.

Partita 1990 is a **commercial font**, not an OFL font. The user confirmed the owner holds self-hosted web-use permission for the preview; the official font kit and license document are to be supplied before final launch. This is a user attestation, not independent license verification. The source archive and exploratory specimens remain in ignored research storage. The public attribution is `public\fonts\partita-1990-NOTICE.txt`; obtain any future kit from [the designer](https://www.brumale.xyz/partita/), retain its terms, and rerun font proof if the binary changes.

OFL notices for the other fonts are retained in `public\fonts`. No runtime font service is used. Normal builds use the prepared font; `npm run assets` preserves it rather than redownloading or replacing it.

## Motion and media behavior

The recording-backed desktop motion inventory includes:

- Eleven hero and nine About collage pieces follow individual observed **translation and rotation** traces with a 6.6-second cycle. Their continuous motion does not add scaling.
- Five of the hero pieces also have independent spring entrances; static positioning, entrance scaling and continuous motion use separate layers.
- Two newsletter-frame masking lines slide from the left and fade in. They are not line-drawing animations.
- Source typewriter headings reveal individual characters over 1.6 seconds on first viewport entry and do not replay after scrolling away and back.
- The dancing cat, printed mug, and engraved cup keep their source frames, delays, and continuous loops.

Reduced motion and forced colors make these elements static. Hidden tabs, blur and offscreen state pause motion; returning resumes the existing cycle rather than resetting it. Heading reveals remain complete across preference changes. Studio Cat's switch controls the cursor only, not the authored page animation.

The eight native videos retain real MP4 sources and controls:

- Poster/manual: March in Japan, February in Japan, and the family-film television.
- Ambient/in-view: portrait stamp, carving block, pulling a print, stamp workshop, and laser engraving.

Ambient clips play muted and loop only while visible and motion is allowed. They pause offscreen, on blur, in hidden tabs, and for reduced motion. An explicit user pause is not undone by focus or visibility events. Posters activate near the viewport. Poster/manual clips never start sound automatically.

Desktop players have real play/pause, seek, mute and fullscreen controls bound to the video state. The authored February segment starts at 28.51 seconds; the laser segment loops from 8.09 to 17.49 seconds. Their poster frames come from the source's declared timeline. The prepared full video files remain intact. Native controls remain available in fullscreen, without JavaScript, or after an enhancement/media failure; fullscreen clears crop offsets and preserves the complete frame.

The homepage uses a 640px responsive newsletter cover while retaining the full 1203px page for high-DPR displays and the reader. Source images beyond the hero and ambient posters activate only near the viewport, with native no-JavaScript image fallbacks. Together these keep the first settled 390px load within the existing 2 MiB gate without dropping source imagery.

## Newsletter

All **15 pages** are independently available, in order, with selectable original English/Japanese text, page navigation, direct page images, and a downloadable image-edition PDF. No Canva iframe or runtime is required.

On desktop, the homepage viewer changes pages in place and provides zoom with Fit, fullscreen and Hide/Show controls. The More menu also keeps the standalone reader, current page image and PDF available as self-hosted fallbacks. A page counter advances only after the requested image decodes; failed loads retain the last good page and expose Retry. Page and zoom state survive blur/focus. Compact viewports keep the standalone-reader entry.

The page itself also follows the recorded Canva interaction: its **left third goes back** and its remaining two thirds go forward. The native pointer changes to a small left/right arrow with the source's 16px hotspot; unavailable directions use the ordinary pointer. The toolbar remains the keyboard-accessible equivalent. Page-area navigation is disabled while zoomed, and drag/cancel does not turn a page. These reader interactions never trigger Studio Cat or its click sound.

Pages **1–3** have six decorative placements: page 1 has the orange butterfly and heart moth; page 2 has the star moth and luna moth; page 3 reuses the heart and star moths. The four original animated WebPs retain their exact frames, 70ms frame delays and loops. They sit over source-rendered backgrounds captured with those image nodes hidden, so there is no frozen duplicate underneath and no inferred painted patch. Pages **4–15 stay static**. Only the visible desktop reader activates the decorations; reduced motion, forced colors, blur, hidden tabs and leaving the viewport return to the complete static page. Returning restarts the original image animation. Loading failure leaves static content and page navigation intact.

Normal builds require no network access or Canva runtime. To regenerate the managed animation assets from retained, hash-checked inputs in ignored `research\newsletter-motion`, run `npm run newsletter:prepare-motion`. Standalone page images, selectable text, and the PDF remain the static image edition; they are not replaced by the animation layers.

The public Canva viewer denies a subset of full-size image resources on pages **13, 14, and 15**. Their intact 380 x 537 public previews are used without upscaling and are clearly labeled in the reader and PDF. They are not blank substitutes, and the PDF is not represented as an original Canva export.

The exact owner upgrade remains a current high-resolution PDF of the complete newsletter, or high-resolution PNG exports of pages 13-15. After receiving one, replace those images and dimensions, remove `previewQuality` only for genuinely upgraded pages, rebuild the image-edition PDF, and keep all text alternatives.

## Studio Cat and accessibility

Studio Cat uses a precise ear-tip hotspot, immediate pointer tracking, a small expression response, and a short offset paw acknowledgment. Its brown tabby stripes, cream muzzle and greenish eyes reference the cat Ashley is holding in the About photograph. Repainting does not change the cursor outline, size or click coordinate.

The supplied `Extract audio clip.mp4` contributes only its 0.37-second audio stream. The 7 KB M4A is copied without re-encoding and fetched on the first completed Studio Cat background click, never on initial load or mouse-down. Rapid clicks restart the single sound player instead of layering sounds. Drag/cancel, text/links, media/reader controls, touch/pen, reduced motion, cursor-off and existing audible playback do not trigger it. Mute, blur, hidden tabs and page teardown stop it; focus restoration does not replay it. A failed sound exposes an accessible status and disables only the sound, not the cursor or site.

The adjacent speaker control independently mutes click sounds. The two local preferences are `ashley-playful-effects=on|off` and `ashley-click-sound=on|off`; storage failure falls back to in-memory behavior. Links, text, native media, the reader, keyboard input and script failures retain the native pointer. Neither the cursor nor the sound uses an idle animation loop.

The user's original clip remains unchanged and ignored at the project root; only the audio-only derivative is published. `src\content\cursor-audio.json` records its source/output hashes. To prepare a replacement, extract the first audio stream with FFmpeg (`-map 0:a:0 -vn -c:a copy -map_metadata -1 -movflags +faststart`), inspect its length and level, and update that record. The general asset regenerator leaves this separately managed clip intact.

The release suite compares desktop motion positions with independent observed source fixtures in `tests\fixtures\canva-desktop.json`, checks actual authored line strings, paints/crops, media segments, inline-reader state/failures and keyboard/pointer lifecycle in root and Pages builds. The Partita check reads the browser's actual glyph font and measures heading ink against `tests\fixtures\desktop-heading-ink.json`, rather than treating a CSS family name as proof. Existing compact-layout smoke checks protect isolation; they do not constitute a new mobile fidelity audit.

The source's three gray channel statistics (`#a6a6a6` on white) have a measured 2.43:1 contrast ratio, below WCAG's normal-text requirement. Normal view preserves that recorded appearance; `prefers-contrast: more` darkens those labels. Automated checks retain the exact three source exceptions and require zero other violations, plus zero violations in the higher-contrast mode and standalone reader. This is not full accessibility certification or physical-device review.

## Publish a reviewed preview

Commit the reviewed source on the private repository before publishing. The publisher refuses a dirty source tree, wrong remote, public source repository, unexpected artifact, custom domain, or unmanaged publishing checkout.

```powershell
npm run publish:demo
npm run publish:demo -- --confirm
npm run verify:live
```

The dry run changes nothing. The confirmed publisher rebuilds committed source, requires the exact reviewed `dist-demo` bytes, copies only the artifact into the isolated `.pages-publish` checkout, creates a normal `gh-pages` commit, pushes without force, and verifies the anonymous artifact before reporting success. It does not alter the existing domain, DNS, email, Canva hosting, billing, or source visibility.

`verify:live` checks every anonymous public file hash, confirms the repository remains private and Pages remains public without a custom domain, and exercises the deployed five-artboard page, Studio Cat, native video playback, newsletter navigation/download, preview-quality notice, and mobile contact flow in isolated Brave.

Rollback uses a reviewed revert commit, rebuild, full exercise, and normal publication. Do not rewrite either branch.

## Rights and provenance

The commissioning user confirmed Ashley's permission to recreate the portfolio and reuse its assets. `src\content\provenance.json` and `src\content\canva-provenance.json` record prepared-source identities, transformations, palettes, and output hashes. Research captures, raw recovered files, signed temporary URLs, browser profiles, and test evidence are excluded from Git and the public artifact.

Portfolio artwork, photographs, films, newsletter content, and referenced characters retain their existing rights. This repository does not grant a blanket open-source or redistribution license to those assets.
