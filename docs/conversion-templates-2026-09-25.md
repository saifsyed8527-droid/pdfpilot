# Usable conversion templates — 25 September 2026

This release replaces the rejected informational `/workflows` pages. It does not restart automatic SEO, agent jobs, the local scheduler, or paid external LLM calls. The owner authorized publication of the corrected templates after tests.

## What is implemented

- `/templates/conversions`: searchable, server-rendered template directory.
- Three tool-specific collections, with crawlable links to their templates.
- Seventeen detail pages: **8 JPG, 5 Word, 4 PowerPoint**.
- Each detail has a real sample output, downloadable original inputs, input/result facts, relevant checks and limitations, and the **existing converter on the same page**.
- JPG options are executable presets and remain editable. DOCX/PPTX use the source document's own layout; no imaginary Office layout options are advertised.
- Nine public input files are original PDFPilot demonstrations, not customer files. Seventeen preview images are generated from actual browser-converter results, not design mockups. Batch previews deliberately show only the first page of the first file.
- The twelve former workflow articles and their hub permanently redirect. They are removed from the sitemap, not retained as duplicate indexable pages. Their old contents remain recoverable in Git history.
- The existing three converters still share their implementation across twelve languages (36 tool/language URLs). New templates are English-only pending actual translation review; there are no unreviewed locale clones.

Counts: **17 templates + 4 directory pages = 21 template-system URLs**. They replace 13 workflow URLs, a net increase of eight sitemap URLs. The site sitemap contains **434 URLs**, not thousands. Sitemap membership is not evidence of Google indexing or traffic.

## Research and adaptation

Sources read:

- https://practicalprogrammatic.com/examples/zapier
- https://practicalprogrammatic.com/blog/what-is-programmatic-seo
- https://zapier.com/apps/google-sheets/integrations
- https://zapier.com/apps/notion/integrations/descript
- https://developers.google.com/search/docs/essentials/spam-policies

The useful Zapier pattern is a structured catalog, specific intent/combination pages, reusable page components and an immediate product action. PDFPilot adapts that pattern to supported file conversions. It does not copy Zapier's branding or claim app integrations, triggers or actions that PDFPilot does not have. The Google Sheets discussion on Practical Programmatic describes its example directory; it is not proof that Zapier uses Google Sheets as its backend.

## Data feed and manual expansion

The validated source is `src/lib/content/conversion-templates.json`. One reviewed data record produces a consistent page, gallery card, related links, metadata, structured data and sitemap entry. `conversion-templates.ts` validates the schema, unique paths, input extensions and executable preset types.

`docs/conversion-template-catalog.csv` is a Google Sheets/Excel-compatible review mirror. Generate it with `node scripts/export-template-catalog.cjs`. It is **not** connected to a live Google account and editing a Sheet does not automatically change the site.

For a new row:

1. Establish a distinct supported user task. Do not create keyword, city, device or language clones merely to increase counts. Search-volume demand has not been measured for these rows.
2. Use only options the shared converter really supports. Add a safe, original input sample and describe exactly what the user should inspect.
3. Add the record to the JSON catalog and update intentional count expectations in tests.
4. Test its converter in the browser, inspect all resulting pages, generate its real preview, and export the CSV mirror.
5. Run unit, build, HTTP, language-route and browser checks. Only then publish manually with owner authorization.

No spreadsheet import, row addition or sample generator is scheduled. Invalid route slugs return 404. Search/filter state is local UI state, not an infinite crawlable URL space.

## Verification

Pre-publication verification passed: production build (compile/lint/types), **39 unit tests**, **324 initial language/UI checks**, **57 scoped pages**, **13 redirects**, **26 assets**, and all **17 template conversions** plus three mobile own-file conversions. Search, editable JPG settings, sample-load failure recovery, mobile overflow and dark result links passed. All six Office sample files passed their XML validators. Sample PDFs were visually inspected; the demonstration table frame and a shared mobile tooltip overflow were corrected during QA.

Local browser evidence: `/var/folders/vr/g1nykwmj37x34zlvq5nb78340000gn/T/pdfpilot-template-qa-5KuzuU/results.json`. This is synthetic QA evidence, not a guarantee for arbitrary customer files. The initial language checks do not test every tool's conversion output.

Commands from the site directory:

```sh
node --test tests/*.test.cjs tests/*.test.mjs
npm run build
node scripts/check-conversion-growth.cjs http://127.0.0.1:4330
node scripts/check-locale-ui.cjs http://127.0.0.1:4330
```

Run `scripts/check-template-browser.cjs` with Playwright available (or set `PDFPILOT_PLAYWRIGHT_MODULE` to its installed module path). Set `PDFPILOT_CHROME` when using an existing Chrome executable. It requires `pdftoppm` for PDF rendering. `--write-previews` is allowed only against a localhost build.

The browser check converts all 17 template samples, validates PDF/ZIP page counts, image-page dimensions, source slide ratios, Word images and PDF links, then checks search, mobile layouts, user file selection, editable presets, dark result links, Start Over, and a failed sample request. Output evidence is placed in a temporary directory, not committed customer evidence. Office input samples also pass the DOCX/PPTX XML validators.

Passing these synthetic examples is not a claim that every customer document will convert perfectly. Existing Word image-based text, font/layout differences and unsupported PowerPoint elements remain disclosed. Unsupported Office content must not be silently marketed as supported.

## Publication and rollback

Publish only the tested branch state; do not resume either PDFPilot automation. Verify the deployed commit, all 57 scoped page responses, 13 redirects and 26 sample/preview assets against `https://pdfpilot.net` after Vercel reports Ready. Use a reviewed revert or the previous Vercel production deployment for rollback, not a destructive Git reset.
