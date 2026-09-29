# Brazil research and implementation report — 2026-09-29

This batch extends the existing engine and the same `pseo-engine` checkout. It preserves the US and India sources, the ten established English slugs and all 26 core processing flows. Changes are local and tested; they have not been pushed or deployed.

## Source integrity and language

Imported **27,182 of 27,182 rows** from `ilovepdf.com-keywords-27182rows.csv`, market BR, provider SEMrush, snapshot 2026-09. UTF-8; 17 expected columns; no malformed or blank rows. All 165 exact duplicate observations remain traceable by row ID. SHA-256: `c381bfb1a8007aa8765698174ddc7c57a68fd70ff66d3a96c65b5ac2375b02a7`. Raw bytes are preserved in the existing source store; normalized rows and the importer state verify their hashes. The earlier `27152rows.csv` remains deferred and was not imported.

US 30,000 + IN 30,000 + BR 27,182 = **87,182 source observations**. This is a row count, not a demand total. Country volumes are never summed. Duplicate ranking URLs and synonyms do not multiply demand. When an export reports conflicting values for one query, reports retain the full value set rather than averaging or silently choosing one.

Language comes from deterministic query wording, not market or ranking URL: 14,683 pt-BR; 4,547 English; 497 Spanish; 7,455 ambiguous/unresolved. The lexical detector is intentionally conservative, not a claim of perfect language identification; unresolved observations remain reviewable. All non-English signatures are namespaced to prevent accidental assignment to an English page.

## Brazil outcomes

| Measure | Count |
|---|---:|
| Source and parsed rows | 27,182 |
| Unique normalized queries | 8,794 |
| Intent/review groups | 6,977 |
| Known normalized task clusters | 348 |
| Observations mapped to a public tool | 6,173 |
| Supported core assignments | 3,014 |
| English core assignments | 1,181 |
| pt-BR core assignments | 1,833 |
| Candidate owners with BR evidence | 5 |
| Approved owners with BR evidence | 4 |
| New approved pages in this batch | 2 |
| New English pages | 0 |
| Capability-gap observations | 1,561 |
| Informational/review classifier observations | 11,639 |
| Workflow classifier observations | 16 |
| Localization observations still held for review | 5,717 |

Intent labels and final outcomes are different dimensions. In particular, the informational/review fallback is not a list of validated article ideas. The exhaustive final outcome counts below are mutually exclusive and sum to 27,182:

- `localized_core_page`: 1,833
- `query_language_review`: 7,952
- `core_page`: 1,181
- `held_review`: 1,931
- `irrelevant`: 6,879
- `capability_gap`: 1,561
- `approved`: 119
- `localization_review`: 5,717
- `held_workflow`: 8
- `held_platform`: 1

## Ownership and rollout

BR English evidence strengthens `/png-to-pdf` and `/pdf-to-word-scanned` (43 observations combined), plus existing core owners. There is no justification for another English canonical page. Genuine Portuguese synonyms such as juntar/unificar/mesclar share the existing localized merge owner. Country-specific folders are not created.

Two distinct pt-BR tasks passed the existing review gate:

- `/pt-br/png-para-pdf`: 32 source observations; PNG transparency, screenshot legibility, image ordering and page layout; a real parsed PDF download.
- `/pt-br/editar-curriculo-pdf`: 44 source observations; preserve originals, edit supported content, check dates/contact details/layout; inserted text verified in the downloaded PDF. No ATS or automated résumé-writing promise.

Main headings, explanations, steps, limits and FAQs are Portuguese. Both pages reuse the unchanged tools, have reciprocal English/Portuguese alternates, self-canonicals, visible language links and links from their Portuguese core parent. Some advanced tool controls and the image-picker accessible label remain English; this is not a claim of complete UI translation. Further UI localization is in the growth queue.

Twenty existing Portuguese core tool pages now have reviewed supporting copy and validated Portuguese demand. Keep these indexable:

- `/pt-br/jpg-para-pdf`
- `/pt-br/word-to-pdf`
- `/pt-br/powerpoint-to-pdf`
- `/pt-br/excel-to-pdf`
- `/pt-br/html-to-pdf`
- `/pt-br/pdf-para-jpg`
- `/pt-br/pdf-to-word`
- `/pt-br/pdf-to-powerpoint`
- `/pt-br/pdf-to-excel`
- `/pt-br/pdf-to-pdfa`
- `/pt-br/juntar-pdf`
- `/pt-br/dividir-pdf`
- `/pt-br/delete-pages`
- `/pt-br/organize-pdf`
- `/pt-br/rotate-pdf`
- `/pt-br/comprimir-pdf`
- `/pt-br/scan-pdf`
- `/pt-br/crop-pdf`
- `/pt-br/edit-pdf`
- `/pt-br/fill-pdf`

Keep `/pt-br` as the language hub. Hold the Portuguese extract-pages, repair-pdf, ocr-pdf, add-page-numbers, watermark-pdf and excel-to-xml routes with `noindex,follow`; this export did not establish both language-specific supported demand and the necessary content/capability gate for them. Portuguese OCR is specifically unsupported. These holds do not mean there is zero market demand.

The other ten locales retain their existing home and five core translated pages. Their 21 generic tool wrappers each are held until main-content localization is reviewed. No bulk translated pSEO expansion occurs.

The 13 held non-size platform/device candidates remain held. The 84 target-size candidates remain unsupported. Portuguese device/workflow observations stay in the ledger rather than becoming approved pages; Android/iPhone still need actual-device file-picker, conversion and save evidence. Portuguese Mac wording likewise needs its own complete review. The BR English `pdf-to-excel` iPhone candidate remains held.

## Cross-market overlap

Exact normalized query membership and language-aware intent signatures are reported below. They are research groups, not distinct publishable pages. A Portuguese equivalent and an English equivalent remain separate canonical owners even when their underlying product task is the same.

| Exclusive membership | Unique queries | Intent/review groups |
|---|---:|---:|
| US | 20,560 | 14,367 |
| IN | 6,595 | 4,295 |
| BR | 7,726 | 6,604 |
| US+IN | 2,610 | 1,363 |
| US+BR | 705 | 212 |
| IN+BR | 121 | 39 |
| US+IN+BR | 242 | 122 |

`/png-to-pdf` and `/pdf-to-word-scanned` now have approved English evidence across all three research markets. The core operating table also shows market evidence for each shared product task without turning a language difference into a competing English page.

## Largest supported opportunities

Prioritize the established core owners: PDF→Word (`converter pdf em word`, maximum reported single-query BR volume 823,000), Word→PDF (165,000), split PDF (135,000), photo→PDF (110,000), merge synonyms (90,500 for individual leading queries), PDF editing (90,500) and PDF→JPG (49,500). These are keyword observations, not sums or traffic predictions. The operating table retains alternate reported values, raw KD/CPC, competitor position, traffic and ranking URLs. Existing high-volume head terms need strong core pages more than additional slugs.

See [core operating table](CORE-TOOLS.md), [full CSV](core-tool-operating-table.csv), [product-gap decisions](PRODUCT-GAPS.md), [search-intent review](SERP-REVIEW.md), [authority plan](AUTHORITY.md) and [P0–P7 queue](GROWTH-QUEUE.md). Existing exhaustive row assignments are in `data/pseo/reports/keyword-to-page.jsonl` and `keyword-observations.csv`; compressed opportunity reports remain versionable without publishing raw keyword exports to the application.

## QA and exact publication boundary

- 135 automated tests pass; lint, typecheck, production build, runtime manifest and capability validation pass.
- All 26 English core routes have one H1, self-canonicals, metadata and existing upload controls. All 26 uploaded real synthetic fixtures.
- Eight representative core conversions produced parsed downloads; invalid-file recovery and reset passed.
- All 12 approved pSEO production routes passed actual chooser events, processing, downloads and output-content checks across 72 viewport/theme combinations. English OCR passed under the existing scoped WASM CSP.
- All 20 Portuguese core pages passed server-rendered copy, canonical/alternate and six viewport/theme checks each; 19 accepted the appropriate fixture through the file input, and HTML retained its separate entry controls. HTML upload was covered by the English 26-tool suite.
- 107 protected client/worker/converter source hashes are unchanged. No new JavaScript `unsafe-eval` permission or OCR regression was introduced.
- The final HTTP crawl checks wanted sitemap URLs, all language alternates, holds and aliases. Preview routes are 404 with the production environment. No false exact-size routes or cross-language aliases are published.

Browser QA is automated Chrome on macOS with real browser chooser events and synthetic fixture files. Native OS dialogs were not manually inspected; viewport emulation is not real Android/iPhone testing. Advanced English UI labels are disclosed above. No live GSC recovery or traffic increase is claimed.

## Final approved pSEO URLs

- https://pdfpilot.net/compress-pdf-on-mac
- https://pdfpilot.net/edit-pdf-on-mac
- https://pdfpilot.net/edit-pdf-resume
- https://pdfpilot.net/excel-to-pdf-landscape
- https://pdfpilot.net/png-to-pdf
- https://pdfpilot.net/jpg-to-pdf-whatsapp-images
- https://pdfpilot.net/pdf-to-excel-bank-statements
- https://pdfpilot.net/pdf-to-powerpoint-on-mac
- https://pdfpilot.net/pdf-to-word-on-mac
- https://pdfpilot.net/pdf-to-word-scanned
- https://pdfpilot.net/pt-br/editar-curriculo-pdf
- https://pdfpilot.net/pt-br/png-para-pdf
