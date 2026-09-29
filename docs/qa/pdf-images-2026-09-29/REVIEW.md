# PDF image export — implementation review

Scope: PDF-to-JPG, its shared localized workspace and three useful search intents. Existing Merge, Split and Compress clients are unchanged. Review is automated/editorial by Codex, not a native-speaker or exhaustive PDF conformance certification.

## Design and functionality

- Uses the existing PDFPilot landing shell and navigation. Selected-file cards, inline add/remove actions, navy export controls and an inset settings panel replace the red reference styling. No PDF-plugin iframe is used for thumbnails.
- Full-page rendering defaults to 300 DPI. 150 DPI is an explicit choice. PDF rotation/aspect ratio are respected. A single result downloads directly; multiple results use a collision-safe ZIP.
- Embedded-image mode extracts decoded raster assets at native dimensions, including tested soft-mask transparency in PNG. It does not silently substitute whole-page screenshots. Vector drawings, standalone stencil masks, page clipping and placement are not preserved as separate photographs.
- JPG is lossy (encoder quality 0.98 at 300 DPI/extraction, 0.92 at 150 DPI). PNG avoids further lossy pixel encoding; neither recovers missing source detail or preserves editable PDF text. Extraction does not promise original encoded stream bytes.
- Limits: 100 MB per PDF, 24 million pixels per image, 16,384 pixels per side, 256 MB aggregate encoded output. Browser/device memory can impose lower practical limits. Jobs stop rather than automatically reduce resolution.
- CMaps, standard fonts and decoders are copied from the installed PDF.js version during development/build and served locally. No document-processing upload is introduced.
- Shared controls, help, failures and result actions cover all 12 existing locales. No country-specific duplicate tool UI or new language architecture is introduced.

## Evidence

`results.json` records 21 passing real Chrome checks against the production build using generated synthetic PDFs: first-page thumbnail, rotation, 300/150 DPI dimensions, JPG pixel comparison, PNG alpha extraction, JPEG2000 native-size/colour decoding, repeated-image deduplication, duplicate filenames, text-only extraction, malformed and oversized input, and all 12 mobile layouts. `scripts/check-pdf-images.cjs` reproduces them. Generated PDFs, images and ZIPs are ignored by Git. The initial JPEG2000 fixture had a base64 transcription error; it was regenerated and the full suite rerun successfully.

`tests/pdf-image.test.cjs` covers dimensions, limits, naming, dictionaries, keyword ownership and the original JPEG bytes in JPG-to-PDF output (Fit and rotated A4); no JPG-to-PDF engine change was needed.

Final verification: `npm test` passes 143 tests; `npm run build` completes successfully; `npm run pseo -- validate` and `validate-runtime` pass with 26 public tools and 18 approved pSEO pages. All previous 12 pages remain. `seo-results.json` records another 21 passing production-browser checks, including all 12 localized core metadata sets and actual conversion/download on each of the six new intent pages. Root sitemap directly includes pSEO chunks (not a nested sitemap index), and the test verifies that actual architecture. No page errors were recorded, and the conversion suite recorded zero POST requests.

The synthetic 300-DPI JPEG render measured about 0.256 mean absolute channel error on a 0–255 scale relative to its PNG render; this is a fixture-specific comparison, not a universal fidelity score. Page dimensions were 1667 × 1250 and 1250 × 834 pixels including the rotated page. PNG extraction preserved tested RGB/alpha samples within one channel value and kept 120 × 80 / 96 × 64 native dimensions. JPEG2000 output retained 64 × 48 pixels and tested colour values.

Build warnings: two native `<img>` recommendations are expected for locally generated data/blob previews (these must not be sent to an image-optimization service). The existing content-graph warning lists 91 unrelated entries lacking incoming references; this broader site cleanup was not changed in this task.

## Keyword and editorial decisions

All source observations come from the existing imported US, IN and BR datasets. Repeated exports/ranking rows are not summed as demand. `keyword-evidence.json` records source-row samples, unique-query counts and the location of each page's complete provenance in the candidate manifest.

- PDF to PNG: lossless pixel encoding, white full-page background versus native image transparency, size trade-off and actual format control.
- Extract images from PDF: native raster extraction versus full-page rendering, explicit no-image failure and limitations of page layout/masks.
- PDF to JPG high quality: actual 300 DPI rendering, approximate A4 pixel dimensions, explicit lower resolution and honest lossy-JPG wording.

Each intent has an English page and Brazilian Portuguese counterpart. English serves relevant US and Indian English queries; Brazilian Portuguese has its own source-supported content and canonical URL. Existing Hindi and other localized core routes remain available. No unsupported file-size guarantees, 600-DPI pages, scraped competitor copy, fabricated search volumes or country-name-only doorway pages are approved.

Pages reuse the same workspace, with task-specific instructions; users choose the indicated PNG/extraction setting. No hidden URL preset changes processing. Core-help links, related intent links, self canonicals, reciprocal language alternatives, x-default and generated pSEO sitemap inclusion were checked before handoff.

Approved routes (local changes, not yet deployed):

- `/pdf-to-png` ↔ `/pt-br/pdf-para-png`
- `/extract-images-from-pdf` ↔ `/pt-br/extrair-imagens-pdf`
- `/pdf-to-jpg-high-quality` ↔ `/pt-br/pdf-para-jpg-alta-qualidade`

## Release boundary

Shared security-policy compatibility review: `next.config.ts` adds a WASM-only permission to the PDF.js worker response. Global page CSP, JavaScript-eval prohibition and the Tesseract worker rule are unchanged. Existing PDF-to-Word/OCR capabilities include this config file in their evidence, so those file hashes and the two unchanged English PDF-to-Word capability-review fingerprints were refreshed after comparing the exact diff and testing both worker policies. Their conversion code, content, inputs and capability claims were not changed. This is a scoped policy compatibility recheck, not a new blanket functional certification of those tools.

This is local implementation and verification, not a production deployment or a claim of Google indexing/ranking. Broader real-world PDFs (unusual colour spaces, fonts, malformed encodings and very large documents) can require additional compatibility work. Exact visual fidelity for every PDF and lossless JPG cannot be promised.
