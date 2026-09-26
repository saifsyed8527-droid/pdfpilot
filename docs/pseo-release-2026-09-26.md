# PDF templates and executable workflows — 26 September 2026

## Release scope

- 17 original fillable document templates: 16 new pages and an upgraded invoice page. Each has a distinct form, table, sample PDF, actual preview, blank download and editable download in A4 or US Letter.
- Four template collections and a searchable template hub.
- Six executable PDF workflows plus a hub: merge/compress, merge/number, merge/watermark, extract/compress, Word/compress and combine Word documents into one PDF. Each step passes its output into the next, with one final download.
- The existing 17 conversion templates remain available and are linked from the new collections.
- Homepage, footer, search, relevant tools, comparisons and glossary entries expose the new pages through crawlable links.
- Unique titles/descriptions, self canonicals, breadcrumbs, page structured data, invalid-slug 404s and sitemap coverage. Original sample PDFs have `X-Robots-Tag: noindex`; the tool pages are indexable.

There are **28 new indexable URLs**, one upgraded URL and **462 sitemap URLs** in total. `pseo-page-manifest.csv` lists the release cohort. Page counts are not traffic or indexing results.

## Product constraints

Document templates use Latin characters and fit one page. The editor rejects unsupported characters or text that cannot fit rather than silently clipping it. Tables contain manually entered values; invoice amounts, expenses and timesheet hours are not calculated automatically. Entries stay in the tab and are excluded from analytics parameters.

Workflows accept up to 20 files, 50 MB per file, 100 MB total and 300 combined pages; extraction accepts one PDF. Word workflows support DOCX. Merged PDF forms are flattened to retain visible values. Password-protected files must be unlocked first. Existing browser Word conversion limitations still apply.

Compression requires an explicit acknowledgement that it rasterizes pages and may remove searchable text, links and editable fields. The result is retained only when smaller. The shared compression engine now preserves physical paper dimensions independently of raster resolution and fails on unavailable canvas contexts instead of omitting a page. Page numbering rejects rotated pages for this preset. Cancellation prevents a late result from appearing.

New pages are English. Existing tool pages retain their twelve-language workspaces; links to the new English resources are labelled accordingly.

## Catalog and expansion

The reviewed source catalogs are `src/lib/content/document-templates.ts` and `src/lib/content/pdf-workflows.ts`. A record supplies the page, collection, metadata, related links and sitemap entry. Workflow kinds map to implemented engines, not arbitrary combinations.

To expand:

1. Identify a distinct task supported by the tool and check search demand. Initial keyword volumes have not been validated for every page.
2. Add the catalog record, an original sample, specific guidance and a tested output.
3. Generate samples with `node scripts/create-pseo-samples.cjs` and the CSV with `node scripts/export-pseo-catalog.cjs`.
4. Run the relevant browser conversions with `--write-previews` against a local build to capture actual workflow output.
5. Check output readability, input validation, metadata, crawlable links and sitemap membership before publication.

Do not generate pages for unsupported settings or fill the catalog with synonymous keyword variants. Google guidance used for this release: [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) and [helpful, reliable content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## Verification commands

Pre-publication gates passed: production compilation/lint/types, 45 unit tests, 324 language/UI route checks, 29 release pages, 42 release assets, the existing 57-page conversion cohort, 13 legacy redirects and 26 existing assets. Browser checks passed all 17 template downloads, six workflows, a real compression reduction and 16 responsive/theme layouts. The final production UI run reported no runtime errors. Visual QA uses actual scrolling and theme controls, without mutating server-rendered image attributes.

```sh
node --test tests/*.test.cjs tests/*.test.mjs
npm run build
node scripts/check-pseo-http.cjs http://127.0.0.1:4340
node scripts/check-locale-ui.cjs http://127.0.0.1:4340
node scripts/check-conversion-growth.cjs http://127.0.0.1:4340
node scripts/check-pseo-browser.cjs http://127.0.0.1:4340
node scripts/check-pseo-ui.cjs http://127.0.0.1:4340
```

Browser scripts require Playwright and Chrome, configurable with `PDFPILOT_PLAYWRIGHT_MODULE` and `PDFPILOT_CHROME`. PDF inspection requires `pdftoppm` and Python with `pypdf`; set `PDFPILOT_PYTHON` if necessary. Analytics verification requires the existing GA measurement ID at build time. External analytics requests are blocked during browser QA. `--write-previews` is restricted to localhost.

Tests cover all 17 document downloads, all six workflow downloads, form values, page counts/order, A4/Letter sizing, actual compression, cancellation, invalid ranges, unsupported characters, sample-load recovery, search, 16 desktop/mobile light/dark layouts and analytics privacy. Language checks compare initial markup and inputs across 324 routes; they do not assert every tool's arbitrary document output.

## Measurement and publication

The project-level scripts outside this web repository read Search Console and GA4 with existing credentials. `scripts/pseo-growth-report.mjs` in the parent project compares consecutive 28-day periods, allowing for reporting delay, for template/workflow landing pages and completion/download events. Raw account reports are excluded from Git. No schedule is created by this release.

New events are `template_started`, `template_downloaded`, `template_failed`, `template_sample_loaded`, `tool_chain_started`, `tool_chain_completed`, `tool_chain_downloaded`, `tool_chain_failed` and `tool_chain_cancelled`. Parameters contain catalog identifiers and action types, never document entries or filenames. Emission in browser QA is not proof that GA4 has finished processing a live report, and event creation does not automatically configure GA4 key events.

After deployment, verify the live cohort and submit `https://pdfpilot.net/sitemap.xml` using the parent project's `scripts/submit-pseo-sitemap.mjs`. That script refuses submission unless the new release is present. Successful submission is not proof of indexing or growth. Roll back with a reviewed revert or the prior Vercel production deployment; do not use a destructive reset.
