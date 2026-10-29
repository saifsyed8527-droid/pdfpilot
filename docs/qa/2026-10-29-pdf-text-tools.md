# PDF to Markdown and Summary Generator — 29 October 2026

Adds a free PDF to Markdown route to the public catalog and desktop/mobile conversion navigation. The original 99 tools remain public; Redact PDF and PDF to Markdown bring the catalog to 101. Both text tools use the established upload → preview/options → process → result flow with automatic and repeat downloads.

PDF to Markdown extracts native text, infers headings and lists, detects simple aligned tables, retains safe annotation links and text/choice form values, and can include original page-number markers. Optional ZIP downloads contain document.md and whole-page PNG images. Optional English OCR reads pages without native text; it does not silently skip scans. Reading order and table reconstruction are heuristic, with explicit conversion notes and options to disable inference.

Summary Generator now segments Unicode sentences/words, preserves the final unpunctuated fragment, handles non-English native text without an empty result, reports real word counts including common words, deduplicates repeated sentences and attaches source page references. Short/Medium/Long selection is retained. Text, Markdown and PDF exports include references and conversion notes. Summaries remain extractive: no AI rewrite, inference or paid model is simulated.

Both tools offer page ranges, cancellable work, bounded document/text/image sizes, readable errors and retry. The selected File is copied once into a stable in-memory source so preview and processing continue from the same version if the source file changes on disk. Reset/replacement/unmount cancel pending work; late results cannot trigger downloads. Password-protected and XFA inputs receive explicit guidance.

Validation:
- Nine new engine tests exercise actual PDF headings, tables, lists, links, native rotations/crops, fields, image ZIP contents, source Markdown escaping, unsafe URL schemes, page selection, scans, malformed inputs, limits, cancellation and retry.
- Unicode sentence tests cover Hindi, Arabic, Chinese, trailing fragments, repeated-page references and common-word counts. Native Hindi PDF extraction is checked; Arabic extraction is subject to the source font's Unicode map. A shaped-font fixture reproduces missing-map characters, which extraction cannot reliably repair.
- All 279 tests pass. All nine protected Merge/Split flow files match the original baseline.
- The final production build and type checks pass. Lint reports the same three pre-existing warnings.
- The browser converted a three-page selection containing text, a table, a link, a rotated page and a scan into a ZIP. Independent ZIP inspection confirmed Markdown content, actual English OCR text and all three correctly sized page images.
- An invalid range returned to the workspace with guidance; a corrected range downloaded valid plain Markdown. A 40-page OCR conversion was cancelled, then a one-page retry successfully downloaded recognized text without stale output.
- A real scanned page produced a PDF summary citing source page 3. The downloaded PDF was reopened with pypdf and rendered with PDFium. Hindi TXT and Markdown downloads retained the selected sentence and page-1 reference.
- Damaged-file errors recover by selecting a valid replacement. Markdown and summary results remain within a 390px viewport; mobile navigation search finds PDF to Markdown.

Limits: OCR is English only and runs only on pages with no native text, so mixed native/scan content within one page can require prior OCR. Native font encodings and reading order can affect extracted text. Complex columns/tables, individual figure extraction and semantic AI summarization are not claimed. Images in ZIPs represent whole selected pages. Limits are 200 selected pages from a document of at most 1,000 pages, two million text characters and 80MB of page-image data; work exceeding limits stops explicitly. PDF summaries depend on the supported output fonts; text/Markdown preserve extracted Unicode without that PDF-font restriction.

A mobile result-position issue found during browser checks is fixed in the shared FileToolLayout: completed output scrolls to the top instead of leaving users near the footer. The protected Merge/Split components remain untouched.
