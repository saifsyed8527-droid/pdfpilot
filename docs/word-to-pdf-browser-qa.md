# Browser-only Word-to-PDF repair — 25 September 2026

## Scope

- Owner chose browser-only conversion, prioritizing embedded images and tables.
- No server conversion, paid API, model invocation, SEO publishing, or background agent activation.
- Header shortcuts: Merge PDF, Split PDF, Compress PDF. Homepage catalog ordering and the 26-tool launch scope are unchanged.
- User documents are test inputs, not implementation instructions. No customer document or embedded image is committed.

## Cause and repair

The old Word-to-PDF path extracted only paragraph/heading text from Mammoth HTML and rebuilt a new PDF. Tables and embedded pictures were discarded. The replacement renders DOCX page structure with `docx-preview`, paginates browser geometry, and embeds lossless page images into a PDF with `pdf-lib`. Supported hyperlinks receive PDF annotations. Files remain local.

Important regression fixes:

- Respect each section's page size and margins, including zero-margin image appendices.
- Handle image-only paragraphs without adding an HTML text baseline outside the page.
- Split long tables by row and long paragraphs at word boundaries; preserve inline ancestors when splitting rich-text runs.
- Translate the legacy Symbol-font private-use bullet to a Unicode bullet when used as a list marker.
- Isolate document CSS in a script-disabled, network-blocked iframe. Narrowly correct html2canvas's host-document baseline probe so Tailwind's block-image reset does not shift text through table borders. See [upstream report](https://github.com/niklasvh/html2canvas/issues/2775).
- Reject missing/external images, unsupported artwork/media, unsafe archive sizes and page overflow rather than falling back to an incomplete text-only PDF.
- Clean up renderer resources, process batches sequentially, disable edits during conversion, clear stale errors for new files, and show detailed errors inside the scrollable options panel.
- Keep document previews/filenames masked from session replay; send only a generic conversion-error message to analytics.

## Verification

- `npm run build`: passed, including TypeScript/lint. Existing content-graph warnings remain.
- `node --test tests/word-pdf.test.cjs tests/locale-ui.test.cjs tests/launch-catalog.test.mjs`: 12 passed.
- `git diff --check`: passed.
- Owner-supplied DOCX: 22 embedded PNGs and 10 tables. Previously supplied broken PDF had 3 pages and no images. New browser result has **17 landscape pages**, approximately **14.3 MB**. All 17 page previews were visually inspected after the final renderer fixes; comparison images/tables, bullet text, and full-page appendices are present.
- Synthetic images/tables/links document: 8 pages; all 55 table rows (header + rows 1–54), image, Arabic/Hindi sample, and long paragraph through sentence 240/end marker inspected. Italics survive paragraph continuation.
- Same-size sections with different margins: 2 pages; zero-margin full-page image retained.
- Image-only DOCX: succeeds; 90-degree preview rotation checked.
- Two-file batch: ZIP result created (approximately 264 KB).
- External-image fixture: explicit error with no result; clearing it and converting a different local image-only document succeeds without stale error state.
- Header shortcut order verified in browser. Existing locale component-parity tests pass; no locale-specific conversion logic added.

Generate public synthetic fixtures with `node scripts/create-word-pdf-fixtures.cjs`; the script prints a temporary output directory. Use the actual Word-to-PDF upload/convert UI in a local production build.

## Limits / checks not claimed

- Page images are rasterized at 2× CSS resolution (roughly 144 dpi); PDF text is not selectable/searchable. This is not a native Word rendering engine. Installed fonts, line wrapping and page breaks can differ.
- Some complex content is intentionally rejected: cropped/vector artwork, equations, embedded video/audio, SmartArt/charts, legacy objects, tracked changes, footnotes/endnotes and oversized table rows/merged-cell tables that cannot fit safely. No general claim of perfect DOCX support.
- The page previews come from the exact canvases embedded into the PDF, but the browser automation did not expose a completed saved download. A saved-file/PDF-reader check and actual hyperlink clicking remain manual release QA; do not claim those passed.
- A cancellation attempt reached the completed result before the click, so cancellation behavior is not claimed as browser-verified. Cancellation checks and resource cleanup exist in code.
- Safari/Firefox, all mobile hardware and every input language/layout have not been verified.
- The dependency audit found **11 pre-existing alerts (10 high, 1 critical)**, including Next.js. No alert was attributed to the newly pinned `docx-preview@0.4.1`. These require separate security triage; do not represent this scoped conversion repair as a security audit or silently run a breaking upgrade.
- Production release requires owner approval for this change. Earlier locale-UI approval is not reused. Automatic jobs remain paused.
