# PDFPilot pSEO implementation report

Implemented locally on 28 September 2026 in `/Users/apple/Documents/Claude/Projects/PDF Pilot/pseo-engine`, branch `codex/pseo-engine`, based on the available `origin/main` commit `fdad687`. The approved production manifest contains **zero pages**: no real keyword dataset was supplied, no metrics were invented, and no speculative URLs were published.

## 1. What existed before

Next.js 15.5.24 / React 19 with App Router, an explicit 26-tool launch catalog inside a 99-entry registry, working client tools and conversion engines, localized routes, metadata/schema helpers, document templates, conversion presets, six workflows, a workflow hub, search, sitemap, robots, GA analytics and an automated test suite. A separate, active `launch-catalog` checkout also contains unfinished pSEO work; it was inspected without changing it. See [the audit](AUDIT.md) for the KEEP / REUSE / IMPROVE decisions.

## 2. What was reused

The original 26 full tool clients, engines, workers, upload controls, processing states, results and downloads. Also reused: the public launch catalog, Zod, the existing TypeScript script loader, design system, localized content, core canonicals, `ToolGrowthLinks`, workflow hub, search summaries and GA event sender. Document templates remain an independent product feature.

## 3. What changed

The localized optional catch-all was split into a root resolver and nested localized resolver, preserving existing URLs while allowing approved root intent slugs. Shared presentation context can supply task headings, descriptions and verified privacy text. Two clients needed a title expression change (HTML and Scan); their functional logic is unchanged. Core page wrappers gain related-task links only when approved pages exist. The hub, search, robots and analytics derive task data from the approved manifest. A keyed React fragment resolves the hydration issue observed during baseline browser checks without introducing a DOM wrapper. Builds now validate pSEO integrity before compiling.

## 4. What was created

A 26-tool capability registry; strict keyword/page/review schemas; immutable CSV import and provenance storage; normalization, classification, clustering, quality and editorial gates; deterministic content recipes; a single approved page manifest; a reusable server-rendered intent page using the original client; segmented sitemaps; per-row reports; local-only QA previews; regression/SEO/browser tests; and an operator guide. No processing engine was duplicated.

## 5. Exact current 26-tool scope

| Group | Eligible tools and existing routes |
|---|---|
| Convert to PDF | JPG to PDF (`/jpg-to-pdf`), Word to PDF (`/word-to-pdf`), PowerPoint to PDF (`/powerpoint-to-pdf`), Excel to PDF (`/excel-to-pdf`), HTML to PDF (`/html-to-pdf`) |
| Convert from PDF | PDF to JPG (`/pdf-to-jpg`), PDF to Word (`/pdf-to-word`), PDF to PowerPoint (`/pdf-to-powerpoint`), PDF to Excel (`/pdf-to-excel`), PDF to PDF/A (`/pdf-to-pdfa`) |
| Organize | Merge PDF (`/merge-pdf`), Split PDF (`/split-pdf`), Remove PDF Pages (`/delete-pages`), Extract Pages (`/extract-pages`), Organize PDF (`/organize-pdf`), Rotate PDF (`/rotate-pdf`) |
| Optimize and scan | Compress PDF (`/compress-pdf`), Repair PDF (`/repair-pdf`), OCR PDF (`/ocr-pdf`), Scan to PDF (`/scan-pdf`) |
| Edit | Add Page Numbers (`/add-page-numbers`), Watermark PDF (`/watermark-pdf`), Crop PDF (`/crop-pdf`), PDF Editor (`/edit-pdf`), PDF Forms (`/fill-pdf`) |
| Spreadsheets | Excel to XML (`/excel-to-xml`) |

The other 73 registry entries are ineligible for this generator. Registry existence does not confer public status.

## 6. Capability registry status

All 26 records are validated against the public catalog and contain source file hashes, component references, formats, operations, file multiplicity, preset eligibility, processing mode, privacy facts, requirements, limitations and factual steps. Changed source evidence blocks approval until reviewed.

Verified limits include: JPG/JPEG/PNG in the image picker; DOCX/PPTX/XLSX for the corresponding PDF converters; XLS/XLSX separately for Excel to XML; XLSX output for PDF to Excel. The current compressor exposes levels, not exact byte targets. HEIC/WebP/TIFF and exact-size intent pages are therefore rejected. Scan camera access is blocked by the existing site permissions policy; saved photos remain supported. PDF/A output has no bundled independent conformance certification. Physical-device certification is not inferred from source inspection or resized browser windows.

## 7. Keyword ingestion architecture

The importer preserves raw bytes and hashes, supports CSV header aliases and UTF-8/UTF-16LE BOM exports with comma/tab/semicolon delimiters, and retains quoted multiline fields and extra columns. Each row keeps its original file, physical row, market, language and metrics; missing or invalid metrics remain null with warnings. Reimports of identical source observations are idempotent. Distinct markets/providers/snapshots remain separate and are never summed into fabricated global volume. Source geography does not create locale URLs. Integrity checks, atomic writes and a data-directory lock protect repeated imports.

## 8. Intent classification architecture

Ten families: core, format, size, platform, device, use case, workflow, informational, unsupported and irrelevant. Rules combine normalized keywords with the 26-tool capability registry. All 26 canonical head terms map to their existing core owners. Unsupported conversions are not force-mapped. Informational/workflow terms and unknown useful-content recipes remain held for review. Non-English data is preserved but cannot publish untranslated pages.

## 9. Clustering and cannibalization

Normalized intent signatures combine tool, intent family and meaningful modifier. Size spacing and equivalent units collapse to the same signature; synonyms become secondary terms. Established slugs and primary keywords remain stable across incremental imports. Core-page ownership, reserved routes, duplicate signatures/titles/headings/fingerprints and near-identical task content are checked. Every import reports row outcomes, duplicates, core assignments, clusters, conflicts, unsupported requests, counts by tool/intent/market/language and final approved URLs.

## 10. Page generation architecture

Offline recipes combine verified facts with task-specific content, then require fingerprint-bound editorial review and actual QA evidence. The initial recipes cover PNG handling, compression for email/upload, application packets and platform file-selection/save guidance. A review cannot override unsupported product capabilities. Workflow and additional intent recipes can be extended later without another generator.

Only approved records enter `src/lib/content/pseo-pages.json`. One renderer supplies crawlable metadata, copy, steps, FAQs, privacy and links while loading the selected original client through a lazy client boundary with server rendering enabled. Unknown or unapproved slugs return 404. Structured data uses a factual `WebPage` referencing the core software entity; it invents no ratings and generates no blanket FAQ/HowTo markup. No runtime AI is used.

The final build reports 183 KB initial JavaScript for the root resolver, reduced from the earlier combined resolver's 458 KB; the preview route reports 116 KB before its selected tool bundle. These are build output figures, not measured Core Web Vitals. Raw keyword data and full page catalogs stay off the client.

## 11. Internal linking

Existing tool growth links lead to approved task siblings and the existing workflow hub. Every task links to its parent, relevant siblings and the hub. Server-rendered search/filter/pagination makes the complete catalog discoverable through ordinary anchors. Homepage search receives at most 24 task summaries. No new giant menu, footer list or visible breadcrumb system was added.

## 12. Sitemap and indexing

Existing `/sitemap.xml` remains intact. Approved tasks produce `/sitemaps/pseo.xml` and family chunks capped at 5,000 URLs; robots announces that index only when nonempty. Draft, rejected, fixture, alias and noindex records are excluded. Each distinct approved intent self-canonicalizes; country research does not create alternate routes. Filtered hub views are noindex/follow with the hub canonical. All three fixture previews require an explicit QA environment switch plus a localhost host and always use noindex/nofollow; with the switch absent they return 404.

## 13. Privacy claim validation

The registry distinguishes client/server/hybrid/unknown. HTML and Excel-to-XML URL imports are hybrid because they use server fetching; their wording explicitly reflects this. Other listed local processing flows use audited client-side facts. Unsupported local-only claims for hybrid pages fail validation. Analytics adds task/tool/intent/market dimensions through the existing sender and passes no filenames or document contents. Browser QA blocks external HTTPS requests to avoid sending synthetic analytics; its absence of requests is supplementary evidence, not the basis for privacy claims.

## 14. Tests and results

Build, typecheck, lint and all **111 unit/integration tests passed**, including 25 new engine tests. Catalog validation passed with 26 public capabilities, zero production intent pages and no source drift.

Browser verification covered all 26 core pages and all 26 actual file-upload transitions. Eight core processing/download checks cover the six tool categories (including page numbering), alongside three intent previews: **11 successful downloaded outputs**. Preview checks cover server-rendered copy, valid JSON-LD, one H1, noindex, desktop/tablet/mobile widths (1366/768/390), real light/dark toggles and no horizontal overflow. Invalid merge input, disabled processing and recovery/reset also pass. Final captures record no runtime errors or POST requests.

All **462 unique existing sitemap URLs return 200**. Another 28 checks cover 11 localized home/tool pairs and six unsupported/unknown routes returning 404. Three additional checks confirm previews return 404 without the QA switch. See [the compact verification results](verification-results.json); detailed local screenshots/downloads are retained in `docs/pseo/qa/` and intentionally ignored by Git.

## 15. Core tool regression status

All **26/26 before/after screenshots are byte-identical**, and captured input/button controls match. No engine, worker or editor processing code changed. Only the HTML/Scan title expressions changed in tool clients. Representative downloads verify valid PDF page counts, DOCX content and XML content; this is not an assertion that every format, damaged file or physical device has been exhaustively recertified. See [the protection results](protection-results.json) and [baseline source hashes](source-baseline.json).

## 16. Exact workflow for the next keyword CSV

From this checkout, substitute the supplied file and its actual source market/language:

```sh
cd '/Users/apple/Documents/Claude/Projects/PDF Pilot/pseo-engine'
npm run pseo -- import '/absolute/path/keywords.csv' --market IN --language en
npm run pseo -- report
```

Use `UNKNOWN` if the market is unspecified; optional `--provider semrush --snapshot 2026-09` distinguishes source observations. Inspect the row ledger and candidates, then create and complete a review for each eligible intent using its actual slug:

```sh
npm run pseo -- review-template png-to-pdf data/pseo/manifests/png-review.json
# Complete the review with the reviewer, distinct utility and existing QA evidence files.
npm run pseo -- review png-to-pdf data/pseo/manifests/png-review.json
npm run pseo -- build
npm run pseo -- validate
npm run lint
npm run typecheck
npm test
npm run build
npm run pseo -- report
```

`png-to-pdf` above is an example review command, not a currently published candidate. Review platform claims in the named platform, including picker, processing, save and layout. Reuse the browser scripts for final generated pages and inspect the full keyword-to-page ledger. Commands do not deploy. [The operator guide](README.md) documents storage, review evidence, isolated fixture runs and browser setup.

## 17. Blockers and limits

No framework implementation blocker remains. Publishing real pages awaits the user's keyword exports and candidate-specific review/QA. Unsupported exact byte targets and formats remain deliberately ineligible; future platform pages need actual platform evidence. Localization and new workflow recipes remain future extensions. Before merging, reconcile the separate active `launch-catalog` rollout and any changed tool capabilities; its uncommitted work was not overwritten or silently combined. This branch is based on the locally available production ref, not a new remote synchronization.

## 18. Files modified

- `.gitignore`
- `package.json`
- `scripts/load-pseo-modules.cjs`
- `src/app/crop-pdf/tool-page.tsx`
- `src/app/delete-pages/tool-page.tsx`
- `src/app/edit-pdf/tool-page.tsx`
- `src/app/excel-to-pdf/tool-page.tsx`
- `src/app/excel-to-xml/tool-page.tsx`
- `src/app/html-to-pdf/html-to-pdf-client.tsx`
- `src/app/html-to-pdf/tool-page.tsx`
- `src/app/layout.tsx`
- `src/app/ocr-pdf/tool-page.tsx`
- `src/app/organize-pdf/tool-page.tsx`
- `src/app/pdf-to-excel/tool-page.tsx`
- `src/app/pdf-to-jpg/tool-page.tsx`
- `src/app/pdf-to-pdfa/tool-page.tsx`
- `src/app/pdf-to-powerpoint/tool-page.tsx`
- `src/app/pdf-to-word/tool-page.tsx`
- `src/app/pdf-workflows/page.tsx`
- `src/app/repair-pdf/tool-page.tsx`
- `src/app/robots.ts`
- `src/app/rotate-pdf/tool-page.tsx`
- `src/app/scan-pdf/scan-pdf-client.tsx`
- `src/app/scan-pdf/tool-page.tsx`
- `src/app/split-pdf/tool-page.tsx`
- `src/components/i18n/UiText.tsx`
- `src/components/seo/ToolGrowthLinks.tsx`
- `src/components/tool/PdfToolChrome.tsx`
- `src/lib/analytics/events.ts`
- `src/lib/search-index.ts`

The old `src/app/[locale]/[[...slug]]/page.tsx` was replaced by the two resolver paths listed below. This is a route-file move/split, not removal of localized functionality.

## 19. Files created

- `data/pseo/manifests/candidates.json`
- `data/pseo/manifests/reviews.json`
- `data/pseo/manifests/state.json`
- `data/pseo/rejected/latest.json`
- `data/pseo/reports/latest.json`
- `docs/pseo/AUDIT.md`
- `docs/pseo/IMPLEMENTATION-REPORT.md`
- `docs/pseo/README.md`
- `docs/pseo/protection-results.json`
- `docs/pseo/source-baseline.json`
- `docs/pseo/verification-results.json`
- `scripts/check-pseo-core.cjs`
- `scripts/check-pseo-engine-http.cjs`
- `scripts/check-pseo-rendering.cjs`
- `scripts/check-pseo-upload.cjs`
- `scripts/pseo-import.cjs`
- `scripts/pseo.cjs`
- `src/app/[locale]/[...slug]/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/pseo-preview/[slug]/page.tsx`
- `src/app/sitemaps/pseo.xml/route.ts`
- `src/app/sitemaps/pseo/[id]/route.ts`
- `src/components/pseo/IntentDirectory.tsx`
- `src/components/pseo/IntentPage.tsx`
- `src/components/pseo/IntentPresentation.tsx`
- `src/components/pseo/TrackIntent.tsx`
- `src/lib/content/pseo-pages.json`
- `src/lib/pseo/capabilities.json`
- `src/lib/pseo/capabilities.ts`
- `src/lib/pseo/classify.ts`
- `src/lib/pseo/content.ts`
- `src/lib/pseo/metadata.ts`
- `src/lib/pseo/quality.ts`
- `src/lib/pseo/registry.ts`
- `src/lib/pseo/schema.ts`
- `src/lib/pseo/sitemap.ts`
- `src/lib/pseo/workspaces.tsx`
- `tests/fixtures/pseo/pages.json`
- `tests/pseo-engine.test.cjs`

Also created outside this checkout: `/Users/apple/Documents/Claude/Projects/PDF Pilot/PSEO-ENGINE.md`, an entry point for future keyword-import sessions. Ignored QA screenshots, synthetic input/output files and local logs are evidence artifacts rather than production assets. Installed dependencies were reused through a local `node_modules` symlink; no package dependency changes were required.

## 20. Push and deployment confirmation

**Nothing was committed, pushed or deployed.** Changes remain local in the isolated checkout. The other active checkout and production site were not changed by this implementation.
