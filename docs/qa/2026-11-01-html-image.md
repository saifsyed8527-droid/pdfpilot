# HTML-to-Image release verification

## Delivered behavior

- Adds the 106th public tool, HTML to Image, to the existing catalog and image navigation. All previous 105 catalog entries are unchanged.
- Shares HTML-to-PDF's source → preview/options → conversion → automatic/manual download flow. Public URLs and local HTML files support PNG, JPG, WEBP and browser-viewable SVG, desktop/tablet/mobile widths, full page/first screen, 1×/2× raster resolution, quality, ad blocking and overlay removal.
- SVG contains styled HTML in `foreignObject`; it is not a bitmap wrapper or a promise of compatibility with every vector editor. Fonts and image resources are embedded; active content and external output links are removed.
- Adds persistent errors, source-load cancellation, preview refresh/recovery, bounded image rendering and image-conversion cancellation. Imported scripts and embedded frames do not execute. Existing public-fetch URL restrictions remain in place.
- Keeps the existing HTML-to-PDF renderer. Delays download-URL revocation by 30 seconds because immediate revocation interrupted download hand-off in the browser used for verification.
- Pins MIT-licensed html-to-image 1.11.13 source and provenance without changing shared dependencies. The one documented vendor patch yields during DOM cloning so Cancel can be handled; integrity checks cover the distributed files and patch provenance.

## Automated checks

- Full suite: 334 passing tests before the final preview-readiness and cooperative-SVG-cancellation changes.
- After those final changes: all 13 focused HTML-image, HTML-PDF and catalog tests pass; production build, TypeScript validation and lint complete. Three pre-existing lint warnings remain.
- All nine protected Merge/Split flow files still match the original reference hashes. `git diff --check` passes.

## Browser and downloaded-file checks

Actual downloads were copied outside the repository to the local release fixture directory and decoded or rendered, rather than inferring success from the result screen.

- Self-contained responsive HTML: full-page PNG 768×1220, matching full-page geometry, unchanged `100vh` layout, object-fit crop, pseudo-element text, inline SVG and multilingual content. Ad/popup removal checked.
- Browser SVG: valid XML, inlined image, multilingual text and pseudo-elements, no active content or external asset references; browser image preview decodes successfully.
- Responsive JPG: 640×3114 from 320-pixel layout at 2×. Mobile WEBP: 320×844 first-screen image at an actual 390×844 browser viewport; no horizontal application overflow.
- Empty HTML shows an error. A missing local relative image fails with recovery guidance. An oversized 20,000-pixel page is refused; changing to first screen produces a valid download.
- A 1,000-row SVG conversion was cancelled with no result, then retried successfully after the cooperative-cloning patch. The approximately 6.8MB SVG downloads and displays.
- Public URL `https://pdfpilot.net/about` imports through the existing service and produces a complete 768×1471 PNG, visually inspected including its footer. A private-network URL is rejected.
- HTML-to-PDF compatibility: the shared UI produces a three-page A4 landscape PDF with small margins and a clickable HTTPS link. Rendered output retains Hindi, Arabic, Japanese, an inline SVG, image crop, pseudo-element content and the full-page tail.

## Practical limits

Signed-in or script-built pages, embedded frames and live video are not supported. Some CSS effects and font metrics differ in captured output. SVG requires browser `foreignObject` support. Missing resources are reported rather than claimed as successfully reproduced. Capture is bounded to 6,000 DOM nodes, 32 megapixels, 16,384 pixels per side, 60MB output and a 90-second timeout. This verification does not establish exact reproduction of every website or complete competitor parity.
