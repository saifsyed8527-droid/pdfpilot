# Conversion input errors: 4 October 2026

Source branch `codex/product-c-2026-10-04`, base `3c4b879`. Selectively preserves the four-client input-error recovery work from the 1 October local repair checkout; no historical SEO review/capability records copied.

## Changes
- PDF to Word and PDF to PowerPoint: protected/corrupt input has persistent, stable inline guidance. Failed thumbnail inspection changes from “Reading PDF…” to “Preview unavailable.” Replacement/reset clears the old error.
- Word to PDF and PowerPoint to PDF: malformed archive errors identify the expected format without echoing parser text.
- Shared Office workspace: adding replacement input clears a stale conversion error.

## Evidence so far
- `npm run typecheck`: passed.
- `npm run lint`: passed; existing PDF-to-JPG image-element warnings only.
- `npm test`: 144/145 passed. Sole failure: expected capability drift for changed files, awaiting the integration owner's fingerprint review.
- `npm run build`: prebuild refuses the same drift; build not certified on this isolated branch.
- Real local Chrome: PDF to Word protected PDF fails with stable inline guidance; replacement with the synthetic two-page `alpha.pdf` clears it and downloads a DOCX. Inspected `word/document.xml` contains `ALPHA PAGE ONE`, then `ALPHA PAGE TWO`, and exactly one page break. Reset returns to file input; no uncaught page errors.
- Error-state screenshots at emulated 375, 768, 1440. Shared Add tooltip extends 16px beyond viewport at 768/1440; UI owner A has reproduced this and owns the fix. These widths are emulated, not native-device certification. OS dark preference alone did not establish dark-theme rendering.
- Remaining three recovery flows and complex output checks are still running. No production verification or completion count is claimed.

Reproducible browser harness: `tests/browser/conversion-input-errors.cjs`. Set `PDFPILOT_PLAYWRIGHT_MODULE`, `PDFPILOT_QA_FIXTURES` to synthetic fixtures, `PDFPILOT_QA_BASE` (default localhost:4403), `PDFPILOT_QA_OUTPUT` (default `/tmp/pdfpilot-c-input-errors`); optional `PDFPILOT_QA_SLUGS` runs selected comma-separated slugs. On this Mac, fixtures are `/Users/apple/Documents/Codex/2026-10-01/task/qa-fixtures`. All inputs are synthetic.

## Relevant public reference
[The iLovePDF PDF-to-Word interface](https://www.ilovepdf.com/pdf_to_word), inspected 4 October, separately identifies selectable-text conversion and OCR for scanned pages. That supports preserving PDFPilot's existing text/Auto/OCR modes and handling mixed scanned pages without omission. No premium service or language expansion is added. [Word-to-PDF](https://www.ilovepdf.com/word_to_pdf) exposes multiple document selection and conversion; PDFPilot's existing batch/rotation/download controls are retained.
