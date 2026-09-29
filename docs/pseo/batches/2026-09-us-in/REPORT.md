# PDFPilot — September 2026 US / India research batch

Completed locally in `pseo-engine` on `codex/pseo-engine` on September 28, before publication. All 60,000 source rows were processed. Ten pages passed the existing review gate and were prepared in the production manifest. The third export is deferred at the user’s request.

All demand figures below are source-reported research observations. A page or cluster’s displayed volume is the **largest reported volume of one keyword in that market**, never a sum across keywords, ranking URLs or countries. A dash means no observation, not zero demand. Conflicting values remain visible in the detailed records.

## 1. Datasets processed

| File | Market / language | Provider / snapshot | Parsed rows | Malformed rows |
| --- | --- | --- | --- | --- |
| ilovepdf.com-keywords-30000rows.csv | US / en | SEMrush / 2026-09 | 30,000 | 0 |
| ilovepdf.com-keywords-30000rows (1).csv | IN / en | SEMrush / 2026-09 | 30,000 | 0 |

Both files contain the expected 17 SEMrush headers, including separate Traffic and Traffic (%) fields. Strict CSV validation found no malformed or blank rows. Both final records are complete despite the files having no trailing newline. Raw bytes were copied unchanged; source and normalized hashes were verified again after reimport.

| Market | Dataset ID | Raw SHA-256 |
| --- | --- | --- |
| IN | 42304e096312cf1b7d0542ad | d456ecd8a92b5d6fedc525df92b40c71211facd05e8d3bb4adb9f139d8fff9e8 |
| US | cdec6eef0b9f419858d145b9 | dbfe5014ffe255f5be5cede8b8b3d695cd2b44852c81f9b6fa87868884571893 |

Evidence: [source validation](source-validation.json), [reimport and integrity check](reimport-verification.json). `ilovepdf.com-keywords-27152rows.csv` was not imported.

## 2. US dataset summary

| Measure | US |
| --- | --- |
| Source rows | 30,000 |
| Normalized unique keywords | 24,117 |
| Intent/query groups | 16,064 |
| Structured task/modifier groups | 526 |
| Observations related to the public tools | 12,323 |
| Core assignments | 7,018 |
| Core unique keywords | 5,563 |
| Candidate records, including rejected sizes | 31 |
| Approved pages with this market’s evidence | 7 |
| Held platform candidates | 11 |
| Capability-gap observations | 2,309 |
| Irrelevant observations | 3,493 |
| Repeat keyword observations within this market | 5,883 |
| Informational/review observations | 17,013 |
| Workflow observations | 73 |
| Existing workflow assignments | 5 |
| Localization review observations | 3,208 |

The export contains 463 distinct competitor ranking URLs. Ranking observations: positions 1–3: 23,617, positions 4–10: 5,661, positions 21–50: 239, positions 11–20: 479, positions 51+: 4. Page-type observations: tool or content: 23,250, homepage: 678, localized tool or content: 4,481, blog: 1,591. These describe this export’s coverage, not the entire search market.

## 3. India dataset summary

| Measure | IN |
| --- | --- |
| Source rows | 30,000 |
| Normalized unique keywords | 9,568 |
| Intent/query groups | 5,819 |
| Structured task/modifier groups | 460 |
| Observations related to the public tools | 14,672 |
| Core assignments | 7,906 |
| Core unique keywords | 1,810 |
| Candidate records, including rejected sizes | 95 |
| Approved pages with this market’s evidence | 7 |
| Held platform candidates | 4 |
| Capability-gap observations | 4,895 |
| Irrelevant observations | 4,392 |
| Repeat keyword observations within this market | 20,432 |
| Informational/review observations | 12,468 |
| Workflow observations | 109 |
| Existing workflow assignments | 17 |
| Localization review observations | 213 |

The export contains 560 distinct competitor ranking URLs. Ranking observations: positions 51+: 11,276, positions 21–50: 5,832, positions 1–3: 8,311, positions 4–10: 3,029, positions 11–20: 1,552. Page-type observations: localized tool or content: 4,387, blog: 10,033, tool or content: 14,663, homepage: 917. These describe this export’s coverage, not the entire search market.

India is a research market. It does not create Hindi copy, `/in/` paths or country-specific English duplicates.

## 4. Cross-market overlap

2,852 normalized keywords occur in both exports. There are 1,485 shared intent/query groups, including 145 structured task/modifier groups. Four approved pages have evidence in both markets; three are US-only in these files and three are India-only.

Repeated competitor URLs remain separate ranking observations supporting one canonical owner. No US/India volume or KD aggregation is used. Language decisions use the query, not the competitor URL or market.

## 5. Unique keywords and duplicates

30,833 normalized unique keywords across both files; 24,117 in US and 9,568 in India. US-only: 21,265; India-only: 6,716. The original exact source strings number 24,229 and 9,730 respectively, before normalization.

There are 29,167 observations beyond the combined unique-keyword count. This arithmetic includes independent cross-market observations and repeated ranking URLs; it is not a count of erroneous rows. Within-market repeat counts are 5,883 US and 20,432 India. Every observation is preserved in the ledger.

## 6. Total intent clusters

The engine produced 20,398 traceable groups: 841 structured tool/modifier signatures and 19,557 unresolved normalized-query groups. The structured count also includes rejected constraints and unknown modifier reviews. **Neither count represents a claim that thousands of publishable pages exist.**

US-only groups: 14,579; India-only groups: 4,334; shared: 1,485.

| Intent family | Groups | Source observations |
| --- | --- | --- |
| core | 25 | 14,924 |
| informational | 14,909 | 29,481 |
| unsupported | 66 | 4,667 |
| irrelevant | 5,278 | 7,885 |
| size | 84 | 2,537 |
| format | 1 | 71 |
| workflow | 13 | 182 |
| use-case | 5 | 185 |
| device | 9 | 48 |
| platform | 8 | 20 |

Grouping and all outcomes are in [opportunities.json.gz](../../../../data/pseo/reports/opportunities.json.gz) and [keyword-observations.csv](../../../../data/pseo/reports/keyword-observations.csv). The classifier combines known synonyms, formats, platform aliases and numeric-size variants; unfamiliar requirements remain visible for review.

## 7. Core-page keyword assignments

14,924 observations (6,289 unique normalized queries) retain existing core ownership: 7,018 US and 7,906 India. Broad terms and ordinary wording variants do not create child pages. All 26 tools remain in the registry; 25 receive source observations in these competitor files. Excel to XML receives none.

[core-tools.json](../../../../data/pseo/reports/core-tools.json) contains the complete core keyword lists, separate market measurements, long-tail families, child candidates and related unsupported demand.

## 8. pSEO candidates

107 deterministic candidate records were generated: 23 non-size task candidates plus 84 excluded numeric-size records. The 23 tasks produced 10 approvals and 13 platform holds. Unsupported conversions and operations are represented in the gap ledger, not disguised as working pages.

The ten approvals are the eligible distinct intents found in this batch and verified here; no page-count target was imposed. Additional unknown terms remain research review groups, not silently approved candidates. The combined US/India review preceded approvals. [prioritization.json](../../../../data/pseo/reports/prioritization.json) orders approved before held, then cross-market before single-market with a stable signature tie-break; this is an execution order, not an opaque SEO score.

## 9. Approved production-manifest pages

| Prepared route | Primary keyword | US volume* | IN volume* | Observations |
| --- | --- | --- | --- | --- |
| /compress-pdf-on-mac | mac reduce pdf size | 480 | — | 1 |
| /edit-pdf-on-mac | pdf editor mac | 90 | 1,600 | 2 |
| /edit-pdf-resume | resume pdf editor | 210 | 1,900 | 28 |
| /excel-to-pdf-landscape | excel to pdf landscape | — | 480 | 7 |
| /png-to-pdf | png to pdf | 110,000 | 135,000 | 71 |
| /jpg-to-pdf-whatsapp-images | whatsapp image to pdf | — | 2,900 | 23 |
| /pdf-to-excel-bank-statements | bank statement pdf to excel converter | — | 2,400 | 4 |
| /pdf-to-powerpoint-on-mac | change pdf to powerpoint on mac | 90 | — | 6 |
| /pdf-to-word-on-mac | convert pdf to word mac | 320 | — | 1 |
| /pdf-to-word-scanned | pdf to word ocr | 1,000 | 12,100 | 123 |

*Largest single-keyword value in that market. These are local production-ready records, not live deployments. All 266 supporting source observations remain linked. [page-research.json](../../../../data/pseo/reports/page-research.json) records primary/secondary queries, verified capability, content recipe, market values, source IDs, distinct utility, review evidence, canonical ownership, related pages and sitemap status. Reviews bind exact content and capability fingerprints.

## 10. Held / review-required candidates

| Candidate route | US volume* | IN volume* | Reason |
| --- | --- | --- | --- |
| /compress-pdf-on-iphone | 50 | — | Actual named-platform verification unavailable |
| /compress-pdf-on-windows | 90 | — | Actual named-platform verification unavailable |
| /delete-pages-on-android | 140 | — | Actual named-platform verification unavailable |
| /edit-pdf-on-android | 320 | 1,600 | Actual named-platform verification unavailable |
| /edit-pdf-on-iphone | — | 590 | Actual named-platform verification unavailable |
| /edit-pdf-on-chromebook | 110 | — | Actual named-platform verification unavailable |
| /edit-pdf-on-windows | — | 590 | Actual named-platform verification unavailable |
| /jpg-to-pdf-on-android | 140 | — | Actual named-platform verification unavailable |
| /jpg-to-pdf-on-iphone | 3,600 | 1,300 | Actual named-platform verification unavailable |
| /pdf-to-jpg-on-android | 110 | — | Actual named-platform verification unavailable |
| /pdf-to-jpg-on-iphone | 9,900 | — | Actual named-platform verification unavailable |
| /pdf-to-jpg-on-windows | 140 | — | Actual named-platform verification unavailable |
| /rotate-pdf-on-android | 90 | — | Actual named-platform verification unavailable |

All 13 remain nonindexable and return 404 as public pages. Viewport resizing was used for responsive QA only; it did not approve iPhone, Android, Windows or Chromebook claims. Unknown informational requirements are held separately in the complete ledger.

## 11. Unsupported keywords / clusters

7,204 observations fall into 150 capability-gap groups: 4,667 unsupported-operation/format observations plus 2,537 numeric-size observations. The 84 size groups cannot pass the capability gate.

Literal legacy DOC/PPT/XLS requests are held where the audited public workspace accepts or outputs only DOCX/PPTX/XLSX. HEIC/WebP/TIFF conversion, PDF-to-PNG, PDF rasterization through Scan, deleted-file recovery, n-up page layout, unsupported OCR languages and hidden-tool requests remain excluded. No missing product feature was implemented.

## 12. Irrelevant keywords

7,885 rows were classified outside the PDF/Excel scope or as license/crack intent: 3,493 US and 4,392 India. They remain in the row ledger with source IDs and reasons. No such rows enter the approved manifest or sitemap.

## 13. Top opportunities for all 26 tools

Observation counts include related held and unsupported demand. Top terms below are restricted to actual core-page assignments. The last two columns show approved/held children and gap groups, not extra core pages.

| Core route | US rows | IN rows | Unique queries | Top US core query (volume) | Top IN core query (volume) | Children A / H | Gap groups |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /jpg-to-pdf | 1,492 | 2,224 | 1,438 | jpg to pdf (450,000) | jpg to pdf (6,120,000) | 2 / 2 | 23 |
| /word-to-pdf | 733 | 1,138 | 728 | word to pdf (110,000) | word to pdf (3,350,000) | 0 / 0 | 3 |
| /powerpoint-to-pdf | 171 | 128 | 157 | pptx to pdf (18,100) | pptx to pdf (27,100) | 0 / 0 | 1 |
| /excel-to-pdf | 126 | 254 | 146 | excel to pdf (9,900) | excel to pdf (823,000) | 1 / 0 | 1 |
| /html-to-pdf | 91 | 124 | 105 | html to pdf (18,100) | html to pdf (74,000) | 0 / 0 | 1 |
| /pdf-to-jpg | 822 | 1,169 | 727 | pdf to jpg (301,000) | pdf to jpg (4,090,000) | 0 / 3 | 14 |
| /pdf-to-word | 1,313 | 1,176 | 1,225 | pdf to word (450,000) | pdf to word (5,000,000) | 2 / 0 | 3 |
| /pdf-to-powerpoint | 303 | 229 | 255 | pdf to powerpoint (12,100) | pdf to powerpoint (22,200) | 1 / 0 | 2 |
| /pdf-to-excel | 401 | 404 | 390 | pdf to excel (33,100) | pdf to excel (1,220,000) | 1 / 0 | 4 |
| /pdf-to-pdfa | 7 | 6 | 4 | convert pdf to pdfa (480) | pdf to pdfa (1,000) | 0 / 0 | 0 |
| /merge-pdf | 1,812 | 1,468 | 1,553 | merge pdf (135,000) | merge pdf (3,350,000) | 0 / 0 | 4 |
| /split-pdf | 618 | 238 | 465 | split pdf (40,500) | split pdf (550,000) | 0 / 0 | 0 |
| /delete-pages | 581 | 400 | 417 | delete pages from pdf (12,100) | pdf page remover (165,000) | 0 / 1 | 0 |
| /extract-pages | 70 | 45 | 63 | extract pages from pdf (3,600) | extract pages from pdf (40,500) | 0 / 0 | 0 |
| /organize-pdf | 100 | 83 | 85 | organize pdf (2,400) | organize pdf (74,000) | 0 / 0 | 0 |
| /rotate-pdf | 160 | 72 | 133 | rotate pdf (8,100) | rotate pdf (60,500) | 0 / 1 | 0 |
| /compress-pdf | 1,188 | 3,449 | 2,078 | compress pdf (135,000) | compress pdf (2,240,000) | 1 / 2 | 48 |
| /repair-pdf | 85 | 46 | 65 | pdf repair tool (1,300) | pdf repair online (2,900) | 0 / 0 | 2 |
| /ocr-pdf | 296 | 275 | 269 | ocr (33,100) | ocr (49,500) | 0 / 0 | 2 |
| /scan-pdf | 51 | 188 | 89 | scan to pdf (1,900) | scan pdf online (9,900) | 0 / 0 | 2 |
| /add-page-numbers | 93 | 48 | 64 | add page numbers to pdf (1,900) | pdf page number (12,100) | 0 / 0 | 0 |
| /watermark-pdf | 110 | 63 | 86 | add watermark to pdf (1,600) | add watermark to pdf (12,100) | 0 / 0 | 2 |
| /crop-pdf | 149 | 76 | 130 | crop pdf (8,100) | crop pdf (301,000) | 0 / 0 | 0 |
| /edit-pdf | 966 | 1,303 | 949 | pdf editor (246,000) | pdf editor (2,740,000) | 2 / 4 | 5 |
| /fill-pdf | 585 | 66 | 564 | fill pdf (14,800) | pdf form (5,400) | 0 / 0 | 3 |
| /excel-to-xml | 0 | 0 | 0 | — | — | 0 / 0 | 0 |

Main and long-tail keyword families, all values for KD/CPC, best competitor position, observed ranking traffic and URLs are retained in [core-tools.json](../../../../data/pseo/reports/core-tools.json) and [opportunities.csv](../../../../data/pseo/reports/opportunities.csv). Largest measured core surfaces include JPG-to-PDF, PDF-to-Word, merge, compression and PDF-to-JPG. They retain their existing routes. Zero Excel-to-XML observations describe these exports only.

## 14. Format opportunities

PNG-to-PDF is the one approved format child: verified PNG input, proportion/orientation checking and transparency guidance provide distinct utility. JPG/JPEG and generic photo/image synonyms retain the existing image-conversion owner. DOCX/PPTX/XLSX and supported PDF output families retain their core owners.

The PNG task does not duplicate the existing transparent-PNG conversion preset. Unsupported formats, exact-size image requests and legacy file-format constraints remain held in the gap report.

## 15. Use-case opportunities

| Task | Distinct utility |
| --- | --- |
| Edit a PDF Resume | Explains limited resume edits, source backup, typography and export inspection; the downloaded PDF contains the actual added text and original resume content. |
| Excel to PDF in Landscape | Explains saved XLSX sheet orientation and page-break checks; a workbook carrying landscape pageSetup generated a wider-than-tall PDF. |
| WhatsApp Images to PDF | Explains saving supported image attachments locally, ordering mixed JPG/PNG files and inspecting previously compressed pictures; no messaging integration is claimed. |
| Bank Statement PDF to Excel | Selectable bank-statement tables need transaction-specific checks for repeated headers, wrapped descriptions, date columns, debit/credit signs and balances. The real workspace produced XLSX with the synthetic statement dates and amounts preserved; this is distinct from merging statement PDFs and does not promise reconciliation or every bank layout. |
| Scanned PDF to Word with OCR | Explains image-only English OCR, Auto/Free OCR selection and proofreading; actual text recognized from a raster-only PDF was found inside the downloaded DOCX. |

These five tasks come from real imported queries. No email-compression or application-packet page was manufactured from the examples in the brief when these exports did not yield a qualifying candidate. Each page reuses the original tool component and contains task-specific steps, limits and checks.

## 16. Device / platform opportunities

Four Mac tasks passed on an actual Darwin 25.6.0 ARM64 host using Chrome 154.0.8037.57: compression, editing, PDF-to-Word and PDF-to-PowerPoint. The original upload button triggered Chrome’s filechooser event; the automation chooser API supplied the fixture. Processing ran and the original download action produced a parsed local artifact.

This is actual macOS Chrome evidence, not device emulation. Native Finder dialogs were not manually inspected, and Safari or other platforms are not certified by these results. Thirteen other platform candidates remain held. Page wording scopes Mac guidance to browser operation and does not promise native-app behavior.

## 17. Informational opportunities

| Review family | Observations |
| --- | --- |
| supporting_content_review | 4,509 |
| unreviewed_modifier | 2,488 |
| competitor_brand_review | 474 |
| desktop_or_app_review | 580 |
| localization_review | 3,421 |
| operation_or_content_review | 17,956 |
| developer_integration_review | 19 |
| pdf_definition_review | 34 |

The 29,481 informational rows are not an automatic blog backlog. Known-tool support questions can inform core help; task modifiers supported by a reviewed recipe map to that task; broad definitions, software/app/developer requirements and unknown operations stay in guide or product review. Language-marked queries stay in localization review. Queries such as the broad ‘pdf converter’ term remain hub/content review, not a clone of a single core converter. Market rows and competitor blog/tool evidence remain available in [opportunities.json.gz](../../../../data/pseo/reports/opportunities.json.gz).

## 18. Workflow opportunities

182 source observations form 13 multi-step signatures. Twenty-two observations reuse `/pdf-workflows/merge-and-compress-pdf` (5 US, 17 India). The other 160 remain held for workflow review. No new workflow was launched and no existing workflow owner was replaced.

## 19. Product capability gaps

| Intent / constraint | US volume* | IN volume* | Observations | Related public tool | Primary restriction |
| --- | --- | --- | --- | --- | --- |
| doc-to-pdf | 18,100 | 823,000 | 300 | word-to-pdf | unsupported_conversion:doc:pdf |
| unlock | 12,100 | 450,000 | 346 | Outside 26-tool scope | unsupported_or_out_of_scope_operation |
| ppt-to-pdf | 18,100 | 201,000 | 143 | powerpoint-to-pdf | unsupported_conversion:ppt:pdf |
| 200000bytes | 880 | 165,000 | 196 | compress-pdf | exact_target_not_supported_by_core_tool |
| pdf-to-ppt | 18,100 | 165,000 | 249 | pdf-to-powerpoint | unsupported_conversion:pdf:ppt |
| password | 9,900 | 165,000 | 1,073 | Outside 26-tool scope | unsupported_or_out_of_scope_operation |
| 100000bytes | 480 | 110,000 | 319 | compress-pdf | exact_target_not_supported_by_core_tool |
| unlocker | 3,600 | 110,000 | 26 | Outside 26-tool scope | unsupported_or_out_of_scope_operation |
| 500000bytes | 320 | 90,500 | 147 | compress-pdf | exact_target_not_supported_by_core_tool |
| pdf-to-doc | 12,100 | 90,500 | 167 | pdf-to-word | unsupported_conversion:pdf:doc |
| pdf-to-png | 74,000 | 480 | 11 | pdf-to-jpg | unsupported_conversion:pdf:png |
| text-to-pdf | 1,600 | 60,500 | 48 | Outside 26-tool scope | unsupported_conversion:text:pdf |
| 300000bytes | 170 | 40,500 | 84 | compress-pdf | exact_target_not_supported_by_core_tool |
| heic-to-pdf | 40,500 | 14,800 | 24 | jpg-to-pdf | unsupported_conversion:heic:pdf |
| 1000000bytes | 480 | 33,100 | 358 | compress-pdf | exact_target_not_supported_by_core_tool |
| xls-to-pdf | 2,900 | 33,100 | 68 | excel-to-pdf | unsupported_conversion:xls:pdf |
| 100000bytes | 50 | 27,100 | 48 | jpg-to-pdf | exact_target_not_supported_by_core_tool |
| 200000bytes | — | 27,100 | 37 | jpg-to-pdf | exact_target_not_supported_by_core_tool |

*Per-market maximum of one keyword, not an aggregated opportunity estimate. The table is sorted by the larger of the two displayed market-specific values for readability; the underlying values are never added. [capability-gaps.csv](../../../../data/pseo/reports/capability-gaps.csv) and [capability-gaps.json](../../../../data/pseo/reports/capability-gaps.json) contain every gap, example keywords, raw values, observations and reasons. Exact-size compression is substantial India demand, while PDF-to-PNG and HEIC input are prominent US gaps. These findings support later product decisions; no new feature was activated.

## 20. Cannibalization findings

The dedicated audit passed: ten approved intent owners, 26 protected core owners and 54 existing workflow/use-case/document/conversion-template records checked. It checks duplicate intent signatures, primary and secondary keyword ownership, slug/canonical collisions, duplicate or near-identical content fingerprints, country folders and existing-content title collisions.

Semantic review distinguishes resume editing from resume compression; selectable bank-table extraction from merging statement packets; XLSX landscape from existing JPG/DOCX presets; general PNG conversion from the transparency preset; saved chat images from photographed-paper instructions; OCR Word output from searchable-PDF OCR. Mac pages own file-selection/save guidance for their respective tool, with no separate synonym URLs. Evidence: [cannibalization report](cannibalization.json).

## 21. Final generated URL list

Prepared canonical URLs (local implementation; not deployed):

- `https://pdfpilot.net/compress-pdf-on-mac`
- `https://pdfpilot.net/edit-pdf-on-mac`
- `https://pdfpilot.net/edit-pdf-resume`
- `https://pdfpilot.net/excel-to-pdf-landscape`
- `https://pdfpilot.net/png-to-pdf`
- `https://pdfpilot.net/jpg-to-pdf-whatsapp-images`
- `https://pdfpilot.net/pdf-to-excel-bank-statements`
- `https://pdfpilot.net/pdf-to-powerpoint-on-mac`
- `https://pdfpilot.net/pdf-to-word-on-mac`
- `https://pdfpilot.net/pdf-to-word-scanned`

## 22. Internal linking status

All ten tasks have crawlable incoming links from their parent core page and the existing `/pdf-workflows` directory. Each links back to its core and the directory; same-tool siblings are included where available. All rendered related links returned 200 during QA. Search/filter views preserve the hub canonical and use noindex/follow. No unrelated footer links were added.

The new discovery links initially shortened the Excel core upload area. Its surrounding page wrapper now preserves the original viewport-height workspace before the related links. The processing component and controls remain unchanged.

## 23. Sitemap status

The existing sitemap retains 462 distinct destinations, all tested as 200 locally. The pSEO sitemap index and its family chunks contain exactly the ten approved canonical URLs. Robots announces both sitemap entry points. All approved pages respond 200, are indexable and self-canonical. Held/rejected candidate routes, unsupported examples, unknown chunks and locale-prefixed pSEO paths return 404. Preview routes return 404 without the local QA switch.

No raw keyword, draft, fixture, alias, held or rejected record was included. Evidence: [HTTP and sitemap results](qa/http-results.json).

## 24. QA / test results

Validation, lint, typecheck, all **128 unit/integration tests**, and the production build passed. Every approved page passed actual upload/process/download testing; this was not limited to one representative page. Each also passed 390px, 768px and 1366px checks in both light and dark modes: 60 page/layout combinations.

Checks covered response status, server-rendered copy, one H1, description, canonical, robots, structured data parsing, related links, capability-aware privacy text, no horizontal overflow, no runtime exceptions and no document-processing POST requests. Raw source filenames and research records were absent from delivered HTML. Downloaded outputs were parsed: PDF page counts, saved XLSX landscape orientation, actual editor-added text, editable DOCX text and OCR-recognized content, PowerPoint slide count, and bank-statement XLSX dates/amounts.

A real failure was found during OCR preview QA: the production content security policy blocked WebAssembly compilation. Only `/tesseract/worker.min.js` now permits `wasm-unsafe-eval`; general pages still exclude it and production JavaScript `unsafe-eval` remains blocked. No OCR engine was changed. This scope follows [MDN’s distinction between WebAssembly and JavaScript evaluation permissions](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution). The initial failure is preserved in [ocr-initial-failure.json](ocr-initial-failure.json); the successful rerun is in the final evidence.

Evidence: [preview approval checks](qa/candidate-results.json), [all ten public page checks](qa/production-results.json), [command verification](verification.json). Local synthetic tests block external HTTPS analytics. They do not prove every user document, browser or large-file edge case. Existing build diagnostics about the broader content graph and the legacy lint command are documented in the saved logs; they did not fail the checks.

## 25. Core 26-tool regression status

All 26 core routes retain their headings, canonical URLs and control definitions. All 26 accepted the original supported upload fixtures. Eight representative existing tool flows passed processing/download checks across the engine families; corrupt PDF rejection and reset recovery passed. Additional approved-page tests exercised editing, XLSX conversion, PDF-to-Excel, PowerPoint and OCR through the same components.

The before/after file audit verifies all 158 protected engine, client and capability-evidence files are byte-identical to the start of this batch. Changes are in the surrounding pSEO layer, research pipeline and the necessary OCR worker policy. The Excel page wrapper correction preserves its original upload presentation. Twenty-one full core screenshots, including the restored Excel page, are byte-identical to the baseline. New related links explain below-workspace screenshot differences on the other five parent pages; all 26 control comparisons match. Evidence: [core comparison](core-comparison.json), [26 uploads](qa/upload-results.json), [representative processing](qa/functional-results.json), [protected source hashes](protected-source-integrity.json).

## 26. Exact files modified / created

The inventory compares the checkout against `before-files.json`, captured before the first real import. It separates this data task from the already-uncommitted framework implementation. No deletions were required.

[Exact file inventory](files.json) lists every changed/new project, data, report, evidence and ignored local research file. [Readable inventory](FILES.md) lists the maintained files and points to raw/normalized datasets and complete ledgers. Screenshots and synthetic downloads remain in `docs/pseo/qa/`; `.next` and dependencies are build/runtime artifacts, excluded from the task inventory.

Publication preparation: a source-free `validate-runtime` check now validates the committed candidate/manifest match, reviews, QA evidence and capability hashes during Vercel builds; the full `validate` command still checks every local raw and normalized source. The 54 MB opportunity JSON is retained locally with an identical compressed archive for Git.

Principal repairs: SEMrush intent/SERP header aliases and Traffic-column collision handling; real-query classification and ownership corrections; five verified use-case recipes; explicit platform hold reasons; actual-candidate previews; derived market/opportunity reports; real batch QA; and scoped OCR worker permission. The 26-tool registry remains the eligibility source.

## 27. Next country import readiness

Both exact-source reimports were idempotent: two sources, 60,000 rows and unchanged approved-manifest hash. Established slugs and primary keywords remain stable. The next explicitly supplied market can use the same import → report → review → build → validate workflow. New observations join existing owners while retaining their own market, provider and snapshot; only new, useful, supported and verified intents can become new pages.

The third CSV is deferred. Future imports must use the user-supplied market/language mapping. No new architecture, country folders or automatic localization is needed. Back up the entire `data/pseo` directory with its source inventory and reviews; raw exports and large CSV/JSONL ledgers are intentionally ignored by Git.

## 28. Push / commit / deploy status

At the completion of this September 28 research batch, no commit, push, merge or deployment had been performed. This is a dated preparation record; subsequent Git and Vercel status should be checked in those services. Work remains in `/Users/apple/Documents/Claude/Projects/PDF Pilot/pseo-engine`, branch `codex/pseo-engine`, based on `fdad687`. The active `launch-catalog` checkout was not modified; its existing installed dependencies were reused read-only. No additional checkout was created.

The local server used for QA is stopped at completion. The prepared pages become live through a later publication action.
