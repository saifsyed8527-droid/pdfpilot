# SEO discovery and accuracy release — 5 October 2026

## Problem and change

The five main PDF tools had useful supporting content without a server-rendered path back to it. Several guides described older tool controls and output behavior. This release adds a bounded, varied reading list to Merge PDF, Split PDF, Compress PDF, PDF to JPG and JPG to PDF; reconnects relevant support pages through seven existing category hubs; and corrects instructions against the current processing code and UI.

Corrections cover the compression presets and rasterized output, custom/fixed/page/size splitting, PDF image export modes and resolutions, and image-to-PDF ordering and page sizing. Existing search-held content and unavailable tools are excluded from recommendations. No processing engine, route, dependency, locale policy or indexation rule changes.

## Validation

- Production baseline: `3e92891a1d15821cfab7a204f65c097ccd9fdb45` on main.
- Production build, TypeScript checks and lint passed. Lint reports two existing image-element warnings in the PDF image workspace.
- 70 focused tests passed across discovery, launch inventory, pSEO, Brazil quality gates, compression and PDF image behavior.
- All 253 sitemap URLs return 200 in the built release, have one H1 and remain indexable. Canonicals, robots directives, language and hreflang match the baseline. The homepage canonical's trailing-slash normalization is harmless.
- Within the sitemap-page crawl, pages without any incoming links decrease from 28 to 11; pages without incoming main-content links decrease from 32 to 14. This measures discovery paths, not Google indexing.
- Split PDF renders at 390px without horizontal overflow; its new range guide opens from the help section. No file-processing code changed. End-to-end upload/download checks were blocked by Chrome's file-URL extension permission; browser logs include extension message-channel errors, so the console is not claimed clean.

## Follow-through

Deploy through the existing GitHub/Vercel path, verify the live sitemap inventory and changed content, and record the deployed commit in the operator's release log. Revert this scoped release if navigation, rendering or processing regresses.

Measure recrawl and query/page visibility after Google has fetched the changes. Do not attribute traffic changes to this release before then. Remaining disconnected legacy topics need product-accuracy review before promotion; publishing more pages is not the next default action.
