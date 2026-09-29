# PDFPilot pSEO engine

Run commands from this checkout. The first real research batch contains **60,000 source rows from US and India and 10 reviewed pages in the production manifest**. The batch report records the pre-publication checks; use Git and Vercel for the current deployment status. The 26 existing public tools, document templates, conversion presets and six workflows retain their routes. See the [September US/India batch report](batches/2026-09-us-in/REPORT.md) for market counts, approved URLs, held opportunities and actual QA evidence.

See the [implementation report](IMPLEMENTATION-REPORT.md) for the audit, exact file inventory, measured regression results and deployment status.

## Import a keyword export

```sh
npm run pseo -- import '/absolute/path/keywords.csv' --market IN --language en
npm run pseo -- report
```

Use the supplied research market (`IN`, `US`, `GB`, etc.), `GLOBAL` for explicitly global research, or `UNKNOWN` when it is not supplied. Do not infer country from a filename or the language. Optional `--provider semrush --snapshot 2026-09` keeps observations from separate research snapshots distinct. Source markets never become URL prefixes. Non-English inputs are preserved but held for localization review.

Imports accept UTF-8/BOM or UTF-16LE/BOM CSVs, comma/tab/semicolon separators, quoted fields, escaped quotes and embedded newlines. Header aliases cover Keyword/Query/Search Term, Intent/Keyword Intents, Volume/Search Volume/SV, KD/KD %/Keyword Difficulty, CPC, Competition, SERP Features/SERP Features by Keyword, Results and Trend. Traffic and Traffic (%) remain distinct raw fields. Other columns remain in `raw`. Empty/invalid metrics are null with warnings, never invented zeroes. Ambiguous headers fail without overwriting the source. Malformed quotes fail clearly; unequal-width rows remain traceable and are held. The original export is copied byte-for-byte, hashed and never rewritten.

Reimporting the same bytes with the same market/language/provider/snapshot is idempotent. Different source observations remain independent; volumes are not added into a made-up global demand figure. Numeric size variants and ordinary synonyms cluster by normalized intent. An established page keeps its slug and primary keyword when later observations arrive.

## Review and generate

The report explains core-page assignments, unsupported operations, irrelevant rows, review-required informational/workflow terms, candidates and rejections. Every imported row has a source file, physical CSV row, market, language, outcome and reason in `data/pseo/reports/keyword-to-page.csv` and `.jsonl`.

```sh
npm run pseo -- review-template png-to-pdf data/pseo/manifests/png-review.json
```

Inspect the candidate in `data/pseo/manifests/candidates.json`. Complete the generated review JSON with the reviewer's name, a concrete explanation of distinct user utility, and repository-relative evidence files showing the actual tool operation and downloaded result. Device/platform evidence must cover file selection, processing, saving and layout in the named environment; viewport resizing alone is insufficient. `verifiedPlatform` must match the candidate. The template's hashes bind the review to the exact content and capability record. Do not approve an unsupported format or target-size request: review cannot bypass those checks.

```sh
npm run pseo -- review png-to-pdf data/pseo/manifests/png-review.json
npm run pseo -- build
npm run pseo -- validate
npm run lint
npm run typecheck
npm test
npm run build
```

`build` writes only approved pages to `src/lib/content/pseo-pages.json`. It does not deploy. A review with `status: "rejected"` and a reason records a deliberate rejection. Changed content or capabilities invalidates the old review. Missing QA evidence, duplicate ownership, collisions, unsupported functionality, thin recipes, misleading privacy claims and near-identical content prevent approval. Runtime metadata, related links, directory search, routing and pSEO sitemaps all read this single approved manifest.

The full `validate` command checks the preserved raw and normalized research exports and should run in this checkout before publication. The `prebuild` hook runs `validate-runtime` instead: it checks the approved manifest against the committed candidates, fingerprint-bound reviews, evidence files, catalog rules and capability source hashes without requiring the raw keyword exports. Those exports are intentionally excluded from Git and are not available in a Vercel Git build.

For future assistant sessions: use these commands when given CSVs; do not rebuild the architecture, expand the public tool scope, invent keyword metrics or treat source country as localization. Prepare and review real task content and executable QA evidence before recording approval. No runtime LLM is used.

## Storage and reproducibility

- `src/lib/pseo/capabilities.json`: 26 inspected tools and their evidence paths/hashes, formats, operations, privacy, limits and component references.
- `data/pseo/sources/{market}/{dataset-id}/`: preserved original exports.
- `data/pseo/normalized/{dataset-id}.jsonl`: normalized observations with every original column.
- `data/pseo/manifests/state.json`: source inventory and integrity hashes.
- `data/pseo/manifests/candidates.json`: deterministic draft/validated/rejected/approved candidates.
- `data/pseo/manifests/reviews.json`: fingerprint-bound editorial decisions.
- `data/pseo/reports/latest.json`: counts, conflicts, capability drift and final generated URLs.
- `data/pseo/reports/keyword-to-page.csv` and `.jsonl`: complete row ledger.
- `data/pseo/rejected/latest.json`: excluded/held rows and reasons.
- `src/lib/content/pseo-pages.json`: the only runtime indexable pSEO manifest.

The importer uses content identities, sorted source ordering and deterministic recipes. First-seen dates and existing primary ownership are persisted, not regenerated on every build. Data integrity checks catch modified raw or normalized files. Run only one command per data directory at a time; the CLI enforces a lock. After an interrupted process, inspect `data/pseo/.lock/owner.json` and confirm that process has exited before removing that lock directory. Raw source files survive a partially completed import; retry recovers them only if their bytes match.

For isolated testing use `--data /absolute/temp/directory`; `build` also accepts `--output /absolute/temp/pages.json`. Never point a fixture run at the production manifest. Keep real exports and large ledgers in controlled storage; they are not browser assets. Back up the entire data directory together with its reviews and source inventory.

## Scope and factual limits

Conversion to PDF: JPG/PNG, DOCX, PPTX, XLSX and HTML. Conversion from PDF: JPG, Word, PowerPoint, Excel and PDF/A. Organization: merge, split, remove pages, extract, organize and rotate. Optimization/scanning: compress, repair, OCR and scan. Editing: page numbers, watermark, crop, editor and forms. Spreadsheet: Excel to XML.

The registry identifies the user-facing names that differ from routes: Remove PDF Pages is `/delete-pages`, Scan to PDF is `/scan-pdf`, PDF Editor is `/edit-pdf`, PDF Forms is `/fill-pdf`. Registration of additional tools in `tools-data.json` is not pSEO eligibility.

Current compressor levels do not expose an exact byte target, so size-request candidates are rejected. JPG to PDF accepts JPG/JPEG/PNG; HEIC/WebP/TIFF are not enabled in this production workspace. Word/PPT/Excel PDF converters accept modern DOCX/PPTX/XLSX formats only; Excel to XML separately accepts XLS/XLSX. PDF-to-Excel currently outputs XLSX. HTML/Excel URL imports use server fetches; their privacy wording differs from local-only file operations. Scan camera access is blocked by the existing site policy, and PDF/A output has no bundled independent conformance certification. See the registry for remaining per-tool limits.

Content recipes cover PNG handling, compression for email/upload, application packets, saved WhatsApp JPG/PNG images, resume edits, saved XLSX landscape layout, selectable bank-statement tables, scanned English PDF-to-Word OCR and device-specific file/save guidance. Only recipes backed by actual imported demand can become pages. Unknown or unsupported modifiers remain held. Additional verified recipes can be added in `src/lib/pseo/content.ts`; code changes require the same capability, distinct-utility and regression checks. Matching known multi-tool signatures reuse existing workflow ownership; unresolved workflow terms remain held.

## Routing, discovery and indexing

The existing optional catch-all is split at its root boundary: `[locale]/page.tsx` recognizes only approved root slugs or existing localized homepages, and `[locale]/[...slug]/page.tsx` keeps localized tool paths. This preserves URLs while keeping localized tool bundles off intent routes. Static/core routes retain precedence. Unknown and unsupported pSEO paths return 404. Explicitly reviewed Portuguese pages can live under `/pt-br/`; only approved English/Portuguese equivalents receive reciprocal hreflang.

The `/pdf-workflows` directory gains a server-rendered search/filter/pagination section only when approved tasks exist. Filtered views use noindex/follow and the hub canonical. Normal anchors provide crawlable pagination and links to every task. Core tools link to related intents, and each intent links to its parent, siblings and the directory. Homepage search receives at most 24 featured task summaries; it never receives the raw keyword dataset or the full page catalog.

The root `/sitemap.xml` indexes reviewed canonical URL sets by core, language, resources and workflows/templates. Once tasks are approved, `robots.txt` also announces `/sitemaps/pseo.xml`, an index of family-specific sitemaps with at most 5,000 canonical URLs each. Both are derived, not independent URL lists. Unknown sitemap chunk IDs return 404. Rejected, draft, fixture and noindex records are excluded.

Metadata and useful copy are server-rendered. The interactive workspace is the exact original client component, loaded through a client-side lazy boundary with server rendering enabled. Presentation context supplies the task heading/description; generated FAQs and related content sit around the original controls. No conversion engine or upload/process/download controls are forked. The existing GA event sender records page/intent/tool identifiers and research markets; it receives no filenames or document content. Existing product conversion events remain unchanged and retain normal page-location attribution.

Structured data describes the visible page with `WebPage` and references the existing core software entity. No invented reviews, ratings, blanket FAQPage or deprecated HowTo markup are generated. Google's [software documentation](https://developers.google.com/search/docs/appearance/structured-data/software-app) requires genuine review/rating data for its software rich result; this implementation makes no rich-result promise.

## Browser QA and local previews

With Playwright available, configure `PDFPILOT_PLAYWRIGHT_MODULE` and optionally `PDFPILOT_CHROME` for the installed runtime. The scripts block external HTTPS requests to avoid production analytics during synthetic tests.

```sh
npm run build
PSEO_QA_PREVIEW=1 npm run start -- -H 127.0.0.1 -p 4368
# In another terminal:
node scripts/check-pseo-core.cjs http://127.0.0.1:4368 docs/pseo/qa/after
PSEO_QA_PREVIEW=1 node scripts/check-pseo-rendering.cjs http://127.0.0.1:4368 docs/pseo/qa/functional
node scripts/check-pseo-upload.cjs http://127.0.0.1:4368 docs/pseo/qa/uploads
node scripts/check-pseo-engine-http.cjs http://127.0.0.1:4368
```

Actual candidate previews and the original three synthetic fixtures live under `/pseo-preview/`, require both the explicit environment switch and a localhost host header, and always carry noindex/nofollow. They are never in the production manifest, directory or sitemap. Do not set `PSEO_QA_PREVIEW` in deployment settings. With the switch absent, preview routes return 404. Actual dataset candidates must pass the normal review/build gate; previews cannot publish them.

## Research reports for real batches

`npm run pseo -- report` derives these reports from the existing normalized sources, row ledger, reviews and approved manifest:

- `data/pseo/reports/research-summary.json`: complete counts by market, tool, intent and outcome; overlap and competitor ranking distributions.
- `opportunities.json` / `.csv`: every intent or unresolved query group, ownership, readiness and separate market metrics. Filter by tool, market, cross-market flag or status.
- `opportunities.json.gz`: a compressed copy for Git. The full JSON and sortable CSV remain in this checkout's research directory and are excluded from deployment commits.
- `capability-gaps.json` / `.csv`: unsupported formats, operations and exact-size constraints with source observations.
- `core-tools.json`: all 26 owners, matching and related demand, core keywords, children and gaps.
- `page-research.json`: approved page primary/secondary keywords, source observation IDs, market metrics, verified capability, review evidence, related pages and sitemap status.
- `prioritization.json`: approved before held, cross-market before single-market, with stable signature tie-break. It is an execution order, not an SEO score or forecast.
- `keyword-observations.csv`: all source rows with original keyword, market, metrics, competitor URL/position/traffic and traceable outcome.

`largestKeywordVolume` is the largest reported value for **one keyword in one market**, never a cluster total. All observed values, including conflicting metrics for a keyword, are retained. Repeated competitor ranking URLs do not multiply volume. Null means absent data, not zero demand. Broad unresolved query groups are not asserted to be publishable page intents.

After a production build, run `node scripts/check-pseo-batch.cjs http://127.0.0.1:4368 production` to verify every approved task, and `node scripts/check-pseo-ownership.cjs` for the ownership audit. Preview mode uses the same checker before approval. `PSEO_QA_SLUGS` can narrow a focused diagnostic run; final batch QA must cover the approved set.

The OCR worker response alone permits WebAssembly compilation through `wasm-unsafe-eval`; general page JavaScript evaluation stays restricted. This fixes an observed local production OCR failure without changing processing engines or upload/download controls. The capability evidence binds the relevant tools to this policy file.

## Brazil and indexation recovery batch

See [Brazil report](batches/2026-09-br/REPORT.md) and [indexation report](indexation/2026-09-29/REPORT.md). Import mixed-language research with `--market BR --language auto --provider semrush --snapshot 2026-09`; country and language remain separate. The lexical detector leaves ambiguous observations as `und`. `npm run pseo -- refresh-languages` re-derives language only for auto-language sources after verifying raw and normalized hashes; it never changes raw source bytes or row IDs. Rebuild and re-review affected candidates after a language-rule change.

The curated locale indexability policy and content holds govern both robots and sitemaps. Do not extend them merely because a dynamic route renders. Portuguese candidate previews use `/pt-br/pseo-preview/`, under the same localhost/environment/noindex boundary as English previews. `check-pseo-portuguese.cjs` validates reviewed core main-copy localization; advanced UI translation remains partial.

Use `check-pseo-engine-http.cjs` for sitemap-index traversal, public URLs, exact locale aliases, noindex holds, parent links and scoped OCR headers. Use `check-pseo-ownership.cjs OUTPUT_JSON` to avoid overwriting earlier batch evidence. The audit and report scripts preserve the September 29 GSC baseline and never infer Google indexing from HTTP eligibility or sample churn.
