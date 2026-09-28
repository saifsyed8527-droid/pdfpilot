# HTML-to-PDF rendering repair — 2026-09-28

## Root causes and changes

- The export previously used the full document height as html2canvas's viewport height. This changed vh/dvh units during capture: the customer PDF had a stretched hero and a 595 × 8569pt page. Export now retains the preview viewport independently of document height.
- Fixed-width preview choices previously used max-width:100%, silently collapsing desktop presets to the sidebar's available width. The iframe now has the requested viewport and a scaled visual preview.
- html2canvas does not implement object-fit. The clone now paints cover/contain crops into canvases, preserving image boxes and object-position. Responsive img density made replacing only src unreliable; canvas replacements avoid that issue.
- Export uses bounded tiles, constant paper dimensions for multipage output, uniform scaling, real zero margins, and clickable external links. Oversized single-page output errors with a multipage remedy, instead of squashing or dropping content. Fractional final-tile sizing is covered by the mobile export check.
- Proxy URLs are absolute to PDFPilot so an imported base URL cannot send proxy requests to the source website. Imported scripts and event handlers remain disabled. Embedded JSON template documents can be selected and rendered without running their wrapper scripts.
- Removed the silent text-only fallback. Missing visible images and unloaded previews do not produce a misleading successful download. Settings cannot change during conversion.

## Verification

- `node --test tests/*.test.cjs tests/*.test.mjs`: 86 passing tests.
- TypeScript, targeted ESLint, and the Next.js production build passed. The pre-existing content-graph warnings remain unrelated to this repair.
- `scripts/check-html-pdf-browser.cjs`: actual local app, public Phaelora URL, 39 loaded image elements, no broken visible images, hero through footer reviewed visually in the downloaded PDF, 47 PDF link annotations. Output at 1440 × 1000 viewport: 595 × 2999.79pt.
- Same browser script with the supplied local template HTML: library content renders, no empty JavaScript shell, one PDF page and 10 link annotations. Customer HTML/PDF files are not checked into the repository.
- `scripts/check-html-pdf-regressions.cjs`: synthetic viewport-height hero; object-fit cover/bottom; long-page and landscape small-margin multipage PDF; 1920px rendering from a 390px mobile window; no horizontal UI overflow; dark-mode screenshot; no execution of imported scripts; explicit missing-image and page-size errors without downloads.
- Independent PDFium raster check on the synthetic PDF confirmed green hero at y=250, blue cropped image at y=550 and 650, yellow lower content at y=1000 and black footer at y=3300, at source resolution. This verifies the downloaded pixels, not just the page count.

## Limits

This is a static browser-rendered visual PDF, with image-based text plus link annotations. It does not execute arbitrary website JavaScript, expand interactive carousels, or promise exact support for every browser CSS feature. Standalone HTML or saved rendered HTML is needed for script-only applications; the supplied JSON template bundle is supported through its embedded documents. Files remain local; public URL mode uses the existing public HTML/asset import routes.

No automatic jobs or production deployments were started by this repair.
