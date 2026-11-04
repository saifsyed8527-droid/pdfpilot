# Excel 97–2003 workbooks and PDF export

The Excel-to-PDF upload accepts XLSX and BIFF8 XLS. Both use the existing sheet picker, file order, batch recovery and download flow. The alternate Excel conversion workspace uses the same PDF renderer. Hidden and very hidden sheets start unchecked. An explicit selection can include either.

Old XLS files export as cell tables with their saved number formats, merged cells, supported web links, paper size and orientation. The original BIFF stream is inspected for non-cell objects before a selected sheet is exported. A workbook with an unsupported drawing can still export its other sheets. Encrypted, damaged and older binary workbook versions give an actionable error. Formulas use saved results. Legacy table styling, macros and chart rendering require a different export path.

The fixture in `tests/fixtures/excel-legacy-receipt.xls` was generated independently with xlwt 1.3.0. Its four synthetic worksheets include formatted currency, a leading-zero identifier, a date, a merged heading, hidden rows and columns, a very hidden sheet and an actual embedded bitmap.

The tests check sheet selection and order for both formats, exported text, page sizes, legacy drawing detection, an empty drawing container with a clickable link, malformed records, encryption, cancellation, retry and the alternate conversion route.

In Chrome, the built site opened the XLS fixture alongside an XLSX workbook. Choosing the legacy sheet with the bitmap produced a per-sheet error. The other workbook completed. Deselecting the drawing sheet and retrying just the unfinished file produced a 2,341,272-byte ZIP containing two PDFs with two pages each. PDFium recovered `0012`, `USD 125.00`, `2026-11-04` and the notes sheet. The legacy pages used landscape A4 and portrait Letter, respectively. The hidden rows, column and two unchecked sheets were absent. The rendered receipt was visually inspected.

The local reference review covered the supplied homepage group, the Office input groups and the Merge/Split examples. The original Merge/Split flow still matches its nine baseline file hashes. Downloaded outputs and screenshots are retained in the workspace outside the published repository.

All 463 tests passed. The production build generated 588 pages and passed type checking. The existing lint warnings in Compress PDF, Crop PDF and PDF to JPG remain. No production dependencies were added.
