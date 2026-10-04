# Mixed selectable/scanned PDF to Word repair

Branch: `codex/product-c-2026-10-04`. First conversion input-error commit: `9553f8e`.

## Reproduced defect and repair
The existing Auto branch chose extraction for the entire document whenever any selectable text was present. A synthetic three-page PDF (selectable cover, scanned attachment, selectable ending) downloaded a DOCX without the attachment text. Selectively recovered the existing `pdf-word-engine.ts` work, integrated it with the current error-recovery client, and kept all three existing modes.

Auto now uses English OCR on pages without extracted text, retains selectable text on the other pages, and emits editable paragraphs in source page order. No OCR refuses a file with pages lacking selectable text rather than silently dropping them. Forced OCR still processes every page. Blank/unrecognized pages are reported; wholly unreadable output fails instead of downloading a placeholder. Sequential rendering releases each canvas and closes the OCR worker and PDF renderer on success, failure, or cancellation. Cancellation suppresses stale results; immediate termination of an already-active OCR recognition is not claimed.

The current user-facing error mapper preserves only the converter's known mixed-page/empty-text guidance; it still hides arbitrary parser text.

## Executed checks
`PDFPILOT_WORD_EVIDENCE_DIR=/tmp/pdfpilot-c-mixed-word-current node --test tests/pdf-word.test.cjs tests/conversion-input-errors.test.cjs` passed 11/11. Tests import the new engine from this checkout, not the historical recovery directory.

The real-library case generated a PDF with PDF-lib, extracted it with PDF.js, recognized only the second page with the existing local English Tesseract model, and inspected the DOCX archive. Download payload contains `SELECTABLE COVER ALPHA`, `SCANNED ATTACHMENT BRAVO`, `SELECTABLE END CHARLIE` in order, with two page breaks and no screenshot media. Files in `2026-10-04-mixed-pdf-word/` include the source fixture, reproduced old output, corrected output, and corrected `word/document.xml`.

Other tests cover selectable-only (no OCR allocation), forced OCR, mixed input under No OCR, empty/blank pages, cancellation cleanup, OCR failure without a partial DOCX, and fresh retry. PDF.js produced standard-font URL warnings in the real-library test; text and OCR output assertions passed.

`tests/browser/pdf-word-mixed.cjs` is the corresponding local/live browser check. It uses the checked-in synthetic input, verifies No OCR error → Auto recovery → download XML/order/editability → reset, and captures processing/results at 375/768/1440 with an actual theme toggle. This harness is pending execution on the combined candidate. This record does not certify production or mark this tool complete. Auto's per-page test does not detect scanned regions on a page that already contains selectable text; users retain forced OCR for that case.

## Integration checkpoint
The follow-up `npm run typecheck` passed (exit 0). It finished during the integration owner's resource-coordination shutdown; the attempted stop found that process had already exited. The first input-error commit had already passed typecheck and lint. Three repeated local browser runs established PDF→Word recovery and output, then hit cold compile/navigation timeouts on PDF→PowerPoint (30s and 120s); these were not labeled product defects. C stopped its :4403 server after typecheck completed so F can verify the combined :4400 candidate. Parent owns the full combined type/lint/build and capability-fingerprint validation. No C browser processes remain active.
