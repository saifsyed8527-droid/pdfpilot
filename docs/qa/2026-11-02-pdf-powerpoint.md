# PDF to PowerPoint: editable text, free OCR and bounded conversion

Supplied references: groups 6 and 30 show PDF upload, conversion and editable PPTX download. The existing PDF Pilot upload → preview/options → processing → automatic/repeat download flow is retained.

## Changes

- Keep page appearance creates PNG-backed slides with invisible searchable native/OCR text and source-page notes. Editable text creates visible text boxes on a plain background, without page-image replacements. This intentionally does not claim to reconstruct original pictures, fonts, colors, charts, tables or complex layout.
- No OCR, Auto for pages without selectable text, and Free OCR for every selected page. 41 bundled document languages, up to three selected with a primary language, 150/300 DPI. Captioned scan guidance; empty text, unrecognized image text, confidence and uncertain-word reports.
- Source-page selection, first-selected-page / 16:9 / 4:3 slide size; mixed page sizes fit without stretching. Native CropBox, inherited rotation and UserUnit now apply to both page images and text positions. All quarter-turn rotations retain searchable/visible text.
- Original multipage preview, stable in-memory upload, invalid-file replacement, cancel/retry, result scroll and download page report. Shared Merge/Split files unchanged.
- 100MB input; 200 selected pages out of 2,000; 16MP/8192-side render; 10,000 boxes per page, 50,000 overall and two million text characters; 200MB image budget, 128MB output, 180-second page watchdog. Cancellation terminates PDF.js rendering/documents and OCR workers; canvases are released after each page.

## Engine checks

Actual PDF.js, Tesseract models and PptxGenJS run in Node, with only platform paths/canvas transport adapted. Download-equivalent PPTX archives are unzipped and checked.

- Four native rotations and cropped pages with different UserUnit. Every PNG media image is pixel-identical to its independently rendered PDF.js page; hidden CropBox text is excluded; all four slides contain the correct searchable text and rotations.
- Selected pages 2 and 4, 16:9: visible editable text objects, correct native rotation, Unicode filename, no page media or picture replacements.
- Native cover plus Hindi/Arabic scans and blank page: exact Hindi/Arabic text in real slide XML, Arabic RTL flag, blank slide reported, no image replacements in Editable mode.
- No OCR on an editable scan produces actionable guidance; appearance mode keeps that page image. Strict options/languages/pages/raster limits and malformed PDF recovery. Cancellation and resource cleanup, then selected-page retry.

## Browser and output checks

- Actual desktop downloads: four-slide appearance deck and selected native pages 2/4 in a wide editable deck. Each final slide XML is identical to the independent engine output. Correct crop, rotation and UserUnit geometry; no media objects in editable mode.
- Three-language Auto OCR (Hindi primary, English and Arabic), 300 DPI: browser PPTX has exact Hindi and Arabic lines, four slides and zero images. The blank fourth slide is explicitly reported. No-OCR scan failure recovers by selecting OCR without re-uploading.
- Active OCR on a 60-page PDF cancelled; options re-enabled. Free OCR retry of pages 1–2 downloads two exact Hindi slides. Invalid 21-byte PDF reports a readable error; replacement with a valid scan succeeds.
- Mobile at 354 × 767 CSS pixels: no horizontal overflow; selected-page controls and result/download remain usable. One selected Hindi scan page produces a single editable slide with exact text. Saved and inspected mobile options/result screenshots.
- Browser PowerPoint→PDF round trip of both final decks: two native slides and four multilingual slides download in a ZIP. PDFium extracts exact Hindi and logical Arabic (including number 250), and rendered page contact sheets were visually inspected. This is PDF Pilot's renderer, not Microsoft PowerPoint certification.

## Related rendering fix

Round-trip verification exposed an existing PowerPoint→PDF bug: Arabic words were drawn in logical left-to-right order. DrawingML styled runs now use bidirectional visual ordering and font glyph positions, preserving embedded Latin digits. Unicode extraction keeps logical Hindi lines and readable Arabic word order. An actual PPTX/PDF regression fixture supplements the bidi-run tests. Two existing Latin/rotated pages remain pixel-identical after the fix.

## Release checks

All nine Merge/Split reference hashes remain unchanged. The complete suite passes 399 tests; type checking and the production build pass. The same three pre-existing lint warnings remain. PR #31 merged as cb69706f761baa780473e50440d69c7167ac07cc; the production deployment succeeded. A live four-slide editable Hindi/Arabic deck downloaded successfully; all four slide XML parts match the final local browser deck exactly. Production result screenshot saved and inspected.

## Limits

Editable text is approximate positioned text on a plain background, not a complete reconstruction of the source design. Font substitution and text metrics can differ in PowerPoint. Original vector objects, images, table semantics and charts are not rebuilt. Appearance mode's visible image text cannot be edited by changing its invisible search layer. OCR needs proofreading and clear upright pages; mixed-language accuracy depends on the chosen primary language. Native vertical writing/skew and complex text layouts need review. Actual Microsoft PowerPoint application rendering is not established by archive/XML checks.
