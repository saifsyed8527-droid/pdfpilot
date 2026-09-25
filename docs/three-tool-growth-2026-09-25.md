# Three-tool growth release — 25 September 2026

> Historical release record. The owner's later instruction paused all automatic jobs and rejected the informational workflow layout. See `conversion-templates-2026-09-25.md` for the corrected usable-template release. The automation-resume statements below describe the earlier release, not current authorization.

## Owner-approved scope

JPG to PDF, Word to PDF and PowerPoint to PDF only. Existing 12 languages; browser-only conversion. The owner explicitly authorized production publishing after tests. Paid external LLM APIs remain disabled. No customer documents or extracted private content enter published pages.

This scoped authorization supersedes the earlier blanket pause only for these three tools. Other tools remain outside automatic SEO expansion. Read `control-plane/config/three-tool-growth.json` from the project root. Preserve existing UI and use shared engines; a locale must not alter document conversion behavior.

## What this batch implements

- Shared English/localized UI and converter fixes, including the pending PPTX vector/image/progress fixes and dark result-link surfaces.
- Server-rendered supported-capability, steps and limitation copy in all 12 locales for the three tools. Word output is image-based; native-font/layout equivalence is not promised. Unsupported PowerPoint content fails explicitly instead of silently generating an incomplete PDF.
- Word/PPT English reciprocal hreflang maps; localized names, canonical URLs and SoftwareApplication schema. JPG retains its translated paths. Conversion functions are not copied into separate locale implementations.
- Twelve distinct English conversion workflows: four per tool. A data-driven detail template plus a browse/grouping template. Every record has checked implementation sources, specific settings, steps, output checks, limitations and review date.
- Tool-to-workflow, hub-to-workflow and related-workflow links; canonical metadata, article/breadcrumb schema and sitemap entries. Nonexistent workflow slugs are not generated.
- Core action/result/status translations extended. Some advanced options, dynamic progress, previews and detailed parser errors still fall back to English; this is not a claim of complete native-language review.

## Counts (not Google indexing claims)

| Measure | Count |
| --- | ---: |
| New workflow detail URLs today | 12 |
| New workflow hub URLs today | 1 |
| New reusable page templates | 2 (detail + hub) |
| Existing tool/language URLs updated | 36 (3 × 12, including English) |
| URLs in this release cohort | 49 |
| Site-wide sitemap URLs in tested build | 426 |

The 36 tool routes already existed; do not count them as newly created pages. There are not thousands of published pages in this batch. New workflows are English-only and are explicitly labeled as English from localized pages. No translated or unreviewed permutations are added to the sitemap.

## Verification

- Production build passed compilation, lint and type checking.
- 37 automated tests passed, including geometry, archive safeguards, cancellation, Word policies, locale reuse and workflow content/metadata contracts.
- `node scripts/check-conversion-growth.cjs http://127.0.0.1:4330`: 49/49 passed. Validated HTTP status, document language, one H1, indexability, self-canonicals, reciprocal hreflang, localized application schema, sitemap inclusion and no duplicate sitemap URLs.
- `node scripts/check-locale-ui.cjs http://127.0.0.1:4330`: 324/324 initial-page structure/input parity checks passed. This is not conversion-output testing for all 26 tools.
- Chrome PPT checks passed: unsupported shape gives a persistent error and no partial output; three identically named inputs produce a ZIP; result links have contrast; 390px result layout has no horizontal overflow; no POST uploads or runtime errors.
- Chrome saved-download checks: Word synthetic images/tables/links fixture yields 8 pages with PDF link annotations; JPG/PNG input yields a readable one-page PDF. German Word, Portuguese PPT, Arabic JPG and selected workflow pages have no horizontal overflow at 1366px/390px. Dark result-link surfaces and workflow page were visually inspected. No runtime errors or document-upload requests occurred in these tests.
- Removed invisible FAQ markup on the scoped Word/JPG routes; structured data must describe visible content, not hidden questions.
- Dependency audit exposed a pre-existing critical Next.js advisory. Patched Next.js to 15.5.24 and sharp to 0.35.4 before release; the follow-up install audit reports zero critical findings, with 9 high and 1 moderate dependency findings still requiring separate compatibility/security work. Do not describe this release as vulnerability-free. No forced or blanket major upgrades were performed.
- Detailed prior real-file renderer evidence is in `powerpoint-browser-qa.md` and `word-to-pdf-browser-qa.md`. Those reports describe their historical local checkpoints; this release report records the later publishing authorization.

## Search baseline, not a traffic promise

Google Search Console property `sc-domain:pdfpilot.net` was accessible on 2026-09-25. Final Web data requested for 2026-08-26 through 2026-09-22 returned one row for the scoped tool URLs: `/jpg-to-pdf`, 3 impressions, 0 clicks, average position 13. No Word/PPT rows were returned. Missing rows do not prove zero activity or non-indexing. Google-indexed page count has not been established. A sitemap URL count is not an indexed-page count.

## Recurring work boundaries

Use the existing Codex product heartbeat every two hours for scoped bug fixes, localization refinement and small, verified workflow batches. Use the existing daily SEO heartbeat for final-date GSC monitoring, canonical/hreflang/sitemap health and qualified opportunity research. Do not run two implementation/build/release jobs concurrently. Daily monitoring is read-only except existing tracker/checkpoint maintenance; outreach still requires approval. Keep notifications quiet unless a meaningful verified change, release, failure or user decision occurs.

Do not enable the separate old broad local control-plane scheduler: it targets a wider backlog and could overlap the scoped heartbeat. This Mac must be awake and the app/runtime available; this is not an always-on hosted worker. Never call paid external LLM APIs or buy credits. No ranking, traffic, full translation or universal Office fidelity guarantee.

## Release verification

Production publishing is a separate final step after these checks. The project-root `RELEASE-THREE-TOOLS-2026-09-25.md` records the actual deployed commit, live checks, sitemap acknowledgement and automation status; do not infer publication from this local QA report alone.
