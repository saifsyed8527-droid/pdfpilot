# PDF to Excel: free OCR and table worksheets

Reference: supplied DOCX group 12's one/multiple worksheet and OCR controls. Existing upload → original preview/options → conversion → automatic/repeat download flow is retained. Group numbers are extraction identifiers, not verified Google Docs tab numbers.

## Implemented

- Auto detects selectable tables first, then tries browser-local OCR on pages without a table, including scans with selectable captions. Free OCR recognizes every selected page; No OCR processes native text only.
- 41 already bundled languages, 1–3 selected; 150/300 DPI, strict page ranges, one sheet with source labels or separate sheets per detected table. English is the base model when explicitly selected, improving Latin digits in mixed-language scans. No new service or dependency.
- Crop-aware native text uses unrotated logical page coordinates and accounts for UserUnit. Aligned left/right edges preserve right-aligned numbers; vertically separated tables receive independent worksheets. Adjacent word fragments are joined with RTL/CJK-aware spacing.
- All cells remain strings, including dates, leading zeros, signs and formula-like text. No inferred formulas or automatic numeric coercion. Missing-table pages are explicitly listed in the result, preview and downloadable report. Word-level uncertainty is reported even when average page confidence is high.
- 100MB input, up to 200 selected pages out of 2,000; 16MP/8192-side OCR raster, 180-second page inactivity limit, 200 tables/50,000 rows/1M cells/128MB XLSX. Cancellable reading/render/OCR with worker and canvas cleanup; original retained for retry.

## Engine verification

`tests/pdf-table.test.cjs` uses actual PDF.js, native canvas, bundled Tesseract language models and reopens actual XLSX with SheetJS. The platform adapter changes paths/canvas transport only; recognition output is not stubbed.

- Cropped/native-90° PDF with two tables: exact strings, separate worksheets, leading `0012`/`0007`, `1,250.50`, negative `-8.00`, literal `=SUM(A1:A2)` without an Excel formula. Repeated with UserUnit 2.
- Mixed selectable/scanned/prose PDF: two native tables, one English OCR table despite selectable caption, no-table report for source page 3. Exact output rows verified.
- Hindi + English 300 DPI scan: exact `नाम/संख्या/मूल्य`, `किताब/12/250`, `पानी/24/100`. Hindi-only recognition exposed uncertain Latin digits; uncertainty is retained rather than claiming exact output. English-priority mixed mode corrected this checked fixture.
- Prior synthetic statement task: four rows, five columns, exact dates/descriptions/debit sign/credits/balances retained. No financial reconciliation claim.
- One/multiple sheet output, RTL/CJK cell joining, prose rejection, invalid file/size/language/pages/DPI, abort before and between pages, successful retry and worker cleanup.
- Shared OCR change only adds optional word confidence; existing consumers do not change recognition settings or text behavior.

## Browser and regression verification

- Local production build in the in-app Chromium browser: actual file chooser, automatic XLSX download and decoded workbook. Mixed 3-page PDF produced 3 sheets / 9 rows, identical cell-for-cell to engine output, and visibly reported source page 3 with no table. Preview showed leading zeros, signed amounts and literal formula text correctly.
- No OCR on the scanned page reported no aligned tables. Switching the same selected file to Free OCR / one sheet succeeded, with exact checked values.
- Cancelled OCR while a 60-page scan was processing. Source remained selected; retry of pages 1–2 downloaded the expected two tables and page labels. No partial workbook was reported as success.
- Mobile-sized test: requested 390×844; measured CSS viewport 354×767 because of the existing browser zoom. Actual upload, malformed-PDF rejection, replacement with Hindi scan, English+Hindi/300 DPI conversion and downloaded workbook all checked. Document width 354, result scroll position 0. All nine Hindi/Latin values matched. Temporary viewport override reset.
- Four downloaded workbooks reopened and compared, including cancellation retry. Saved local desktop/mobile proof and verification JSON under the private fixture directory.
- Full suite: 383 passed before the final bounded-allocation/error-wording refinement. Focused final regression: 51 passed, including the new sparse-wide-table allocation guard plus table, catalog and publishing checks. Type checking and optimized production build passed; three pre-existing unrelated lint warnings remain.
- Nine Merge/Split reference hashes match the baseline. Shared dependencies and original checkout unchanged.

Production: PR #29 merged as `5269949f77d3a176bbaa5777ed8baea2469b5e90`; Vercel deployment `CgJwpZVUaTTWHK3mZ4cCoJJbLh9H` succeeded. The actual live-site download is 10,308 bytes, with three worksheets and every cell identical to the verified local output. Source page 3's missing-table notice is visible. Downloaded workbook, decoded comparison and viewed live proof were saved privately.

## Limits

Whitespace/alignment inference is approximate. Merged cells, wrapped rows, irregular/side-by-side tables and skewed or rotated scans may need manual correction. Scanned values must be reviewed; a high confidence score does not prove correctness. Text outside detected tables is excluded and pages with no table are reported. Original formulas, styles, chart objects, macros and document layout are not reconstructed. No promise of every-language accuracy or every bank layout.
