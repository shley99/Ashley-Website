# Ashley Website

Ashley Naoko's portfolio: an independently hosted, source-controlled recreation of her Canva portfolio, merged with the **paw kit** (the `Paw changes` folder). It preserves the five original artboards, maker collage, writing, artwork, newsletter, eight videos, and measured source motion, and adds the kit's purple sticky header, purple footer, AshPixel font, and pixel paw cursor that leaves scroll rips.

**Source:** <https://github.com/shley99/Ashley-Website>  
**Live site:** <https://shley99.github.io/Ashley-Website/>

Every push to `main` checks, builds, and deploys the site to GitHub Pages (see [Deploy](#deploy)). The repository is public because GitHub Pages on a free plan requires it, so everything committed here, including the commercial Partita 1990 font file, is publicly downloadable.

The recording-led correction pass targets **desktop fidelity**; compact layouts keep their earlier presentation.

## Architecture

The homepage is a lightweight Astro static build, not a Canva embed or exported Canva runtime:

- `src\content\canva-home.json` contains five source artboards and 162 positioned nodes.
- `src\components\CanvaHome.astro` and `CanvaNode.astro` render text, images, animation, video, vectors, curved arrows, contact links, and the newsletter entry.
- `src\styles\canva-home.css` applies the measured desktop and 390px mobile geometry.
- `src\scripts\canva-motion.ts` implements the observed typewriter, collage translation/rotation, and finite entrances.
- `src\scripts\canva-interactions.ts` owns media playback and the inline newsletter, independently of the cursor.
- `src\layouts\Layout.astro` wraps every page with the kit's header, footer, static paw cursor, and scroll-rip canvas.
- `src\components\SiteHeader.astro`, `src\components\SiteFooter.astro`, and `src\styles\paw-kit.css` are the kit's purple header and footer.
- `src\scripts\paw-kit.ts` is a TypeScript port of the kit's paw cursor and scroll rips.
- `src\scripts\experience.ts` starts the paw and deferred image activation, and falls back to the static paw on any script error.

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

The browser suite uses an isolated headless Brave profile, never an everyday browser profile. On Windows, the installed per-user Brave path is used by default; set `BRAVE_PATH` to use another Chromium browser, such as `$env:BRAVE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'`. Stop manual previews on ports 4450 and 4451 before running Playwright.

The root artifact is `dist`. `dist-demo` is a local `noindex` rehearsal of the GitHub Pages build below `/Ashley-Website/`; the published build is made by GitHub Actions.

```powershell
npm run preview
npm run preview:demo
npm run capture -- --demo
```

Settled five-artboard desktop/mobile captures go to `test-results\captures`. Set `CAPTURE_DIR` to choose another ignored evidence directory. The capture hides the kit's header, footer, paw cursor, and scroll rips (they are not part of the Canva artboards), uses reduced motion for stable composition proof, and records viewport/DPR conditions in `capture.json`.

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
| Contact details, YouTube URL, Shop link (the header's Shop button stays hidden while it is empty), title, and description | `src\content\portfolio.ts` |
| Prepared legacy media roles and dimensions | `src\content\media.json` |
| Video sources, posters, dimensions, durations | `src\content\videos.json` |
| Newsletter pages, extracted text, and quality notices | `src\content\newsletter.json` |
| Page-specific newsletter animations | `src\content\newsletter-motion.json`, `scripts\prepare-newsletter-motion.mjs` |
| Homepage rendering | `src\components\CanvaHome.astro`, `src\components\CanvaNode.astro` |
| Responsive presentation and source motion | `src\styles\canva-home.css`, `src\scripts\canva-motion.ts` |
| Inline newsletter and media lifecycle | `src\scripts\canva-interactions.ts` |
| Header links, footer text, and the purple bars | `src\components\SiteHeader.astro`, `src\components\SiteFooter.astro`, `src\styles\paw-kit.css` |
| Paw cursor, scroll rips, and image activation | `src\scripts\paw-kit.ts`, `src\scripts\experience.ts`, `public\media\paw` |
| Public files | `public\fidelity`, `public\media`, `public\documents`, `public\fonts` |

`canva-home.json` is generated. For a durable composition change, update the authorized source inputs or generator and rerun:

```powershell
npm run fidelity:generate
```

That command requires the intentionally uncommitted `research\canva-design.json`, desktop/mobile layout measurements, `research\desktop-motion-evidence.json`, and authorized originals. The motion evidence contains measured translation/rotation samples and line-entrance timing, not just Canva effect identifiers. It rebuilds managed `public\fidelity` assets and provenance, including image-filled shapes, trimmed-video posters and the responsive newsletter cover.

Desktop text retains authored line boundaries and mixed-color runs. Media keeps inner crop rotation/offset separately from outer placement. The vector renderer distinguishes transparency from opacity, rounded rectangles from arbitrary paths, and image-filled shapes from solid paint. Compact-viewport geometry and legacy presentation are retained separately; they are not new fidelity work.

`npm run assets` is the original media migration/regeneration tool, not part of normal builds. It additionally requires ignored source downloads, newsletter captures, FFmpeg, and ffprobe. It preserves continuous source animation timing, prepares the eight MP4s and posters, builds the image-edition PDF, and copies the current licensed fonts. Do not rerun either generator blindly after manual changes to generated files.

Use `withBase()` for local URLs. The standalone build uses `/`; the Pages build uses `/Ashley-Website/` on github.io and `/` once a custom domain is set.

## Fonts and fidelity boundary

The exact freely licensed source families are self-hosted:

- Montserrat for the main portfolio copy.
- Roboto for the reconstructed YouTube/player presentation.
- DM Sans for source UI roles.

The commissioning user selected **Partita 1990 Regular**, designed by Stefano Giliberti (brumale), for the retro headings. Its prepared 15 KiB WOFF2 is self-hosted at `public\fonts\partita-1990.woff2`; all thirteen homepage headings are calibrated against the retained source ink bounds. Body fonts, artboard geometry and reveal timing are unchanged. Silkscreen remains a locally hosted fallback, not the selected display font, and is no longer preloaded.

The recovered Canva metadata names its face Retropix. That source identity is preserved separately from the user's Partita 1990 selection; the two names are not assumed to be interchangeable.

Partita 1990 is a **commercial font**, not an OFL font. The user confirmed the owner holds self-hosted web-use permission for the preview; the official font kit and license document are to be supplied before final launch. This is a user attestation, not independent license verification. The source archive and exploratory specimens remain in ignored research storage. The public attribution is `public\fonts\partita-1990-NOTICE.txt`; obtain any future kit from [the designer](https://www.brumale.xyz/partita/), retain its terms, and rerun font proof if the binary changes.

OFL notices for the other fonts are retained in `public\fonts`. No runtime font service is used. Normal builds use the prepared font; `npm run assets` preserves it rather than redownloading or replacing it.

**AshPixel** (`public\fonts\ash-pixel.woff`) came with the paw kit and sets the header and footer pixel text. The kit included no license file for it; keep its source terms with the project.

## Motion and media behavior

The recording-backed desktop motion inventory includes:

- Eleven hero and nine About collage pieces follow individual observed **translation and rotation** traces with a 6.6-second cycle. Their continuous motion does not add scaling.
- Five of the hero pieces also have independent spring entrances; static positioning, entrance scaling and continuous motion use separate layers.
- Two newsletter-frame masking lines slide from the left and fade in. They are not line-drawing animations.
- Source typewriter headings reveal individual characters over 1.6 seconds on first viewport entry and do not replay after scrolling away and back.
- The dancing cat, printed mug, and engraved cup keep their source frames, delays, and continuous loops.

Reduced motion and forced colors make these elements static. Hidden tabs, blur and offscreen state pause motion; returning resumes the existing cycle rather than resetting it. Heading reveals remain complete across preference changes. The paw cursor and its scroll rips never change the authored page animation.

The eight native videos retain real MP4 sources and controls:

- Poster/manual: March in Japan, February in Japan, and the family-film television.
- Ambient/in-view: portrait stamp, carving block, pulling a print, stamp workshop, and laser engraving.

Ambient clips play muted and loop only while visible and motion is allowed. They pause offscreen, on blur, in hidden tabs, and for reduced motion. An explicit user pause is not undone by focus or visibility events. Posters activate near the viewport. Poster/manual clips never start sound automatically.

Desktop players have real play/pause, seek, mute and fullscreen controls bound to the video state. The authored February segment starts at 28.51 seconds; the laser segment loops from 8.09 to 17.49 seconds. Their poster frames come from the source's declared timeline. The prepared full video files remain intact. Native controls remain available in fullscreen, without JavaScript, or after an enhancement/media failure; fullscreen clears crop offsets and preserves the complete frame.

The homepage uses a 640px responsive newsletter cover while retaining the full 1203px page for high-DPR displays and the reader. Source images beyond the hero and ambient posters activate only near the viewport, with native no-JavaScript image fallbacks. Together these keep the first settled 390px load within the existing 2 MiB gate without dropping source imagery.

## Newsletter

All **15 pages** are independently available, in order, with selectable original English/Japanese text, page navigation, direct page images, and a downloadable image-edition PDF. No Canva iframe or runtime is required.

On desktop, the homepage viewer changes pages in place and provides zoom with Fit, fullscreen and Hide/Show controls. The More menu also keeps the standalone reader, current page image and PDF available as self-hosted fallbacks. A page counter advances only after the requested image decodes; failed loads retain the last good page and expose Retry. Page and zoom state survive blur/focus. Compact viewports keep the standalone-reader entry.

The page itself also follows the recorded Canva interaction: its **left third goes back** and its remaining two thirds go forward. The native pointer changes to a small left/right arrow with the source's 16px hotspot; unavailable directions use the ordinary pointer. The toolbar remains the keyboard-accessible equivalent. Page-area navigation is disabled while zoomed, and drag/cancel does not turn a page. The paw steps aside over these page areas so the directional arrows stay visible.

Pages **1–3** have six decorative placements: page 1 has the orange butterfly and heart moth; page 2 has the star moth and luna moth; page 3 reuses the heart and star moths. The four original animated WebPs retain their exact frames, 70ms frame delays and loops. They sit over source-rendered backgrounds captured with those image nodes hidden, so there is no frozen duplicate underneath and no inferred painted patch. Pages **4–15 stay static**. Only the visible desktop reader activates the decorations; reduced motion, forced colors, blur, hidden tabs and leaving the viewport return to the complete static page. Returning restarts the original image animation. Loading failure leaves static content and page navigation intact.

Normal builds require no network access or Canva runtime. To regenerate the managed animation assets from retained, hash-checked inputs in ignored `research\newsletter-motion`, run `npm run newsletter:prepare-motion`. Standalone page images, selectable text, and the PDF remain the static image edition; they are not replaced by the animation layers.

The public Canva viewer denies a subset of full-size image resources on pages **13, 14, and 15**. Their intact 380 x 537 public previews are used without upscaling and are clearly labeled in the reader and PDF. They are not blank substitutes, and the PDF is not represented as an original Canva export.

The exact owner upgrade remains a current high-resolution PDF of the complete newsletter, or high-resolution PNG exports of pages 13-15. After receiving one, replace those images and dimensions, remove `previewQuality` only for genuinely upgraded pages, rebuild the image-edition PDF, and keep all text alternatives.

## Header, footer, paw cursor, and accessibility

The purple header (`#724aab`, white text at 6.4:1) stays at the top of every page: the portfolio, all fifteen newsletter pages, and the 404 page. Its links always point to the homepage sections, and anchors land just below the bar through `scroll-padding-top`. On narrow screens the link row scrolls sideways, as in the kit. The Shop button appears only after a `shop` URL is set in `src\content\portfolio.ts`. The footer carries the pixel sign-off, YouTube and Email links, and the build year. Keyboard focus shows a white outline on both bars.

The paw replaces the earlier Studio Cat. A static pixel paw is the CSS cursor everywhere (hotspot 21, 6), so it works without JavaScript. With a mouse or pen, `paw-kit.ts` swaps in the on-page paw: it follows the pointer, turns to its claws while you scroll down, and leaves thin rips that fade out within about 1.7 seconds. The frame loop runs only while rips are visible. Touch input never starts the paw, reduced-motion users keep the static paw without rips, and forced-colors mode restores the system cursor. The paw steps aside over the newsletter page areas and in full screen, and any script error removes it and leaves the static cursor.

The release suite compares desktop motion positions with independent observed source fixtures in `tests\fixtures\canva-desktop.json`, checks actual authored line strings, paints/crops, media segments, inline-reader state/failures, header/footer placement, and keyboard/pointer/paw lifecycle in root and Pages builds. The Partita check reads the browser's actual glyph font and measures heading ink against `tests\fixtures\desktop-heading-ink.json`, rather than treating a CSS family name as proof. Existing compact-layout smoke checks protect isolation; they do not constitute a new mobile fidelity audit.

The source's three gray channel statistics (`#a6a6a6` on white) have a measured 2.43:1 contrast ratio, below WCAG's normal-text requirement. Normal view preserves that recorded appearance; `prefers-contrast: more` darkens those labels. Automated checks retain the exact three source exceptions and require zero other violations, plus zero violations in the higher-contrast mode and standalone reader. This is not full accessibility certification or physical-device review.

## Deploy

`.github\workflows\deploy.yml` runs on every push to `main` (and on demand from the Actions tab). It installs with `npm ci`, runs `npm run check` and the unit tests, builds for the address GitHub Pages reports, runs the build verifier, and deploys. The base path follows that address: `/Ashley-Website/` on github.io, `/` once a custom domain is set, so adding a domain needs only a re-run of the workflow.

Run the full local release checks before pushing. After a deployment finishes, confirm the live site:

```powershell
npm run verify:live
```

`verify:live` needs the GitHub CLI signed in and a clean checkout of the deployed commit. It rebuilds that commit exactly as the workflow does, requires every public file to match it byte for byte, then exercises the live header, paw and rips, anchors, video playback, newsletter navigation and download, preview-quality notice, 404 recovery, and the touch layout in an isolated browser. Evidence goes to `test-results\live`.

Roll back with a normal revert commit and push. Do not rewrite `main`.

## Custom domain (Porkbun)

1. In GitHub, open **Settings > Pages**, enter the domain under **Custom domain** (for example `ashleynaoko.com`), and save. With Actions deployments no `CNAME` file is needed.
2. In Porkbun, open **Domain Management > DNS** for the domain. Delete any parking, `ALIAS`, URL-forwarding, or old website (Canva) `A`/`CNAME` records on the bare domain and `www`. Keep `MX` and `TXT` records used for email.
3. Add four `A` records for the bare domain (leave the host blank): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Optionally add `AAAA` records: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
4. Add a `CNAME` record with host `www` pointing to `shley99.github.io`.
5. Wait for GitHub's DNS check to pass (minutes to a few hours), then turn on **Enforce HTTPS**.
6. Re-run the deploy workflow (**Actions > Deploy to GitHub Pages > Run workflow**) so the site rebuilds for `/` on the new domain.

Optionally verify the domain under your GitHub account's **Settings > Pages** to stop anyone else from claiming it on GitHub.

## Rights and provenance

The commissioning user confirmed Ashley's permission to recreate the portfolio and reuse its assets. `src\content\provenance.json` and `src\content\canva-provenance.json` record prepared-source identities, transformations, palettes, and output hashes. Research captures, raw recovered files, signed temporary URLs, browser profiles, and test evidence are excluded from Git and the public artifact.

Portfolio artwork, photographs, films, newsletter content, and referenced characters retain their existing rights. This repository does not grant a blanket open-source or redistribution license to those assets.
