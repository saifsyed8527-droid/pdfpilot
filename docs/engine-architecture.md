# Engine architecture reference — Phase 2C

Every engine lives at `src/lib/engines/*.ts`. This doc lists what each one
owns, who calls it, and what it deliberately does not do. Verified against
the actual source during the Phase 2C engine audit (2026-07-13), not
written from memory — export/consumer counts below came from grepping
`src/` for each function name.

## pdf-engine.ts

Wraps `pdf-lib` for page/metadata operations: `getPdfPageCount`,
`readPdfMetadata`/`writePdfMetadata`, `duplicatePdfPages`, `flattenPdfForm`,
`insertPdfPages`, `clearPdfMetadata`. Every export has at least one real
consumer (verified this sprint). `resavePdf` was removed this sprint — a
real, working, documented function with **zero** call sites anywhere in the
app; genuine dead code, not a stub for a planned tool, so it was deleted
rather than kept "for later."

## pdf-render-engine.ts

`renderPdfPages` — wraps pdfjs-dist's page-to-canvas rendering. Extracted
once OCR PDF became the second consumer of that pattern (pdf-to-jpg's
original inline implementation was deliberately left as-is — rewriting a
shipped, working tool for no functional gain is not this project's style).

## pdf-text-renderer.ts

`renderBlocksToPdf` (heading/paragraph layout) and `renderTableToPdf`
(ruled-grid table layout, header row repeated across page breaks). Both
lay out fresh US Letter PDFs from typed input — not layout-preserving,
disclosed as such in every tool that uses them. `renderTableToPdf` gained
its second real consumer this sprint (Excel to PDF, via office-engine.ts's
new table-segment handling) — previously CSV to PDF was its only caller.

## text-engine.ts

Parses TXT/Markdown/CSV into the block/table shapes `pdf-text-renderer.ts`
understands. `parseMarkdownToBlocks` (headings + paragraphs only, tables
intentionally dropped) is unchanged and still serves Markdown to PDF
directly. **New this sprint**: `parseMarkdownToSegments`, which does *not*
drop tables — it returns an ordered sequence of `{kind: "blocks"}` /
`{kind: "table"}` segments. This exists because office-engine.ts needed
tables preserved (see below); `parseMarkdownToBlocks` keeps its original,
narrower, correctly-documented scope for the tool that intentionally
wants it.

## office-engine.ts

`convertOfficeFileToPdf` — reads .pptx/.xlsx via `officeparser`, now via
`parseMarkdownToSegments` instead of `parseMarkdownToBlocks`.

**Bug found and fixed this sprint**: officeparser converts spreadsheet
content to Markdown *tables* almost universally. The original
implementation fed that Markdown through `parseMarkdownToBlocks`, which
silently discards table tokens — meaning Excel to PDF threw "No text
content could be extracted" for every real spreadsheet with actual data in
it, which is effectively all of them. Confirmed via a hand-rolled minimal
`.xlsx` fixture and a direct Node-side call to the real engine function
(not a UI click-test — see the QA methodology note in the final report).

Fix: segments are now rendered individually (tables via
`renderTableToPdf`, text via `renderBlocksToPdf`) and their resulting pages
merged into one output PDF via `pdf-lib`'s `copyPages` — the identical
page-combining primitive `insertPdfPages` in `pdf-engine.ts` already uses,
so this isn't a new merge implementation, it's the existing one reused a
second time. Verified post-fix: both the hand-rolled `.xlsx` and a
`pptxgenjs`-generated `.pptx` fixture now produce real, non-empty output
PDFs.

## word-engine.ts

`extractDocxBlocks` (mammoth `convertToHtml` + `DOMParser` traversal) and
`buildDocxFromBlocks` (the `docx` library). Verified this sprint:
`mammoth.convertToHtml` runs correctly in a direct Node test against a
real fixture, producing exactly the expected HTML. The `DOMParser` step
itself is browser-only and wasn't re-executed in Node this sprint (no
`jsdom` in this project — adding one solely to test a already-small,
already-reviewed function would be new-dependency scope creep for a QA
pass); verified instead by code review (a straightforward, deterministic
tag-name switch with no async or state complexity) plus the live UI
verification this exact code path received in an earlier phase.

## image-engine.ts

Pure Canvas API, zero new dependencies: `decodeToCanvas`/`canvasToBlob`
are the shared core every other function in this file builds on —
`convertImageFormat` and `resizeImage` were live-verified in an earlier
phase; `cropImage`, `rotateAndFlipImage`, and `removeImageExif` (added in
Phase 2B) reuse that same proven foundation and were verified this sprint
by code review against the documented Canvas `drawImage`/`translate`/
`rotate`/`scale` APIs, not a fresh live click-test (see the final report's
QA methodology note for why live UI testing wasn't available for this
family this sprint).

## ocr-engine.ts

`recognizeText` wraps tesseract.js; shared by OCR PDF (live-verified,
earlier phase) and OCR Image (Phase 2B, code-review-verified this sprint —
same underlying function, different input decode path). `exportOcrResult`
handles TXT/DOCX export.

## security-engine.ts / ai-engine.ts

Architecture-only by design, not an oversight. Every export throws a
typed `SecurityEngineUnavailableError` / `AiEngineUnavailableError` with a
message pointing at the real reason (no trustworthy client-side PDF
encryption library exists; LLM API keys can't be safely embedded
client-side). Zero consumers today — verified, and correct, since no tool
calls them yet. Full reasoning and the real server-side implementation
path: [phase-2-server-architecture.md](phase-2-server-architecture.md).
