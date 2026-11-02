# PDF to Word: multilingual OCR and bounded conversion

Supplied DOCX references: groups 10 and 29 show selectable-text conversion versus premium scan OCR. PDF Pilot keeps free OCR and its upload → original preview/options → conversion → automatic/repeat download flow.

## Changes

- 41 bundled languages, 1–3 selected, selectable primary language, 150/300 DPI and strict page ranges. Primary language order is honored; English is not forcibly preferred for Arabic documents. Sparse OCR finds isolated captions/footers that automatic paragraph segmentation missed in the checked fixture.
- Editable DOCX text with basic headings/page breaks. Arabic/Hebrew paragraphs and runs receive Word bidi/RTL properties; logical Unicode and numbers are retained. No page screenshots are substituted for editable text.
- Auto recognizes pages without selectable text; No OCR rejects missing-text pages; Free OCR recognizes every selected page. Result lists source page numbers, characters, OCR confidence/uncertain words, blank pages and native pages whose image content was not transcribed. Captioned scans have explicit Free OCR guidance.
- Original multipage preview, disabled controls during work, stable in-memory file reads, cancel/retry, scroll-to-top results, back to options and downloadable page report. Merge/Split files untouched.
- 100MB input/output; 200 selected pages out of 2,000; 16MP/8192-side OCR raster; two million text characters/100,000 text items per page; native reading/render watchdogs; cancel closes PDF.js, workers and canvases. Native extraction now releases its document and respects selected CropBox/native rotation.
- Shared OCR sparse mode and primary-language picker are opt-in. Excel and other existing OCR consumers retain their prior settings.

## Engine checks

`tests/pdf-word-multilingual.test.cjs` runs actual PDF.js rendering and pinned Tesseract models; only platform paths/canvas transport are adapted for Node. Actual DOCX is unzipped and checked for editable XML, logical Unicode, bidi properties, page breaks and absence of page-image replacements.

- Five-page fixture: rotated/cropped native cover, Hindi scan, Arabic scan, captioned Hindi scan and blank page. Selected native pages exclude hidden CropBox text and release the document.
- Auto with Hindi/Arabic/English and Hindi primary: exact Hindi `नमस्ते दुनिया` / `कुल राशि 250`, Arabic `مرحبا بالعالم` / `المبلغ 250`, native page order and four page breaks. Page 4 image-text omission is reported; blank page 5 remains blank and is listed.
- Forced OCR of page 4 includes the Hindi text AND isolated selectable caption. Default automatic paragraph segmentation had omitted the caption; sparse text recognition corrected it. Word primary language avoids the checked English-first Arabic misrecognition.
- Native and OCR cancellation, retry, strict pages/languages/size/DPI, 201-page selection, oversized raster, malformed PDF, resource cleanup. Existing mixed-page/cancellation tests retained.
- Separate logical Hebrew/Arabic paragraph checks verify Word bidi/RTL flags and Latin LTR text. Optional sparse recognition and per-word confidence propagation have a shared-worker regression check.

## Browser checks

- Actual five-page Auto browser download: editable `word/document.xml` matches the engine fixture byte for byte, including exact Hindi and Arabic text. Uploaded that synthetic DOCX to the existing Word-to-PDF renderer; all five pages rendered and the Hindi/Arabic pages were visually inspected. This checks the browser DOCX renderer, not Microsoft Word.
- No OCR on scanned page 2 shows actionable guidance. Changing to Free OCR and selecting page 4 produces a one-page DOCX containing both exact Hindi lines and `SELECTABLE CAPTION`. Primary-language dropdown switches English/Hindi and retains the selected primary.
- A 60-page Hindi scan converts; cancellation during native reading and active page-1 OCR restores enabled controls. Retrying pages 1–2 downloads a DOCX with two exact Hindi text sets and one page break.
- A malformed 21-byte PDF reports a readable error. Replacing it with the valid source succeeds without a reload. At a requested 390×844 viewport (actual CSS 354×767), document width is 354 with no horizontal overflow; mobile conversion of Hindi page 2 downloads the exact expected text. Options/result screenshots inspected and viewport reset.
- Empty language selection produces clear guidance and a fourth language cannot be selected. Blank-page output is reported separately from uncertain recognized text.
- Full suite: 391 tests passed; typecheck passed. Final 38 focused Word/OCR/Excel checks and production build passed after copy adjustments; all nine Merge/Split baseline hashes remain unchanged. Three pre-existing lint warnings remain.

Production verified after PR #30, merge `5e274ebb0dafa85a9c3a60cc4cf1f9e6c1e080af`, Vercel `3uEPUR6ExHsGJdAFfkH9rQBVNsBw`: actual live five-page DOCX has editable document XML byte-identical to the checked local output. Blank-page and image-text warnings appear correctly; the redundant uncertain-text warning on an empty page is absent. Live screenshot saved and inspected.

## Limits

Text-based DOCX reconstructs neither pictures nor original tables, fonts, columns, positioning or complex layout. Auto does not transcribe text inside images on pages that already have selectable text; these pages are flagged and Free OCR is available. OCR remains approximate, language-order-sensitive and intended for upright clear scans. Scores do not prove correctness. A source PDF page break is retained, but long editable text may reflow into additional Word pages. Actual Microsoft Word application rendering has not been verified by these XML checks.
