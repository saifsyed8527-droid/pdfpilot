# Excel-to-PDF layout regression — 2026-09-27

## Changes

- Excel's add-files button is above the cards, at the right edge of the file area, matching the Merge PDF placement. Other Office tools keep their existing button position.
- The shared Office workspace uses a bounded single-column mobile grid; long filenames no longer push controls off-screen.
- Print bounds are derived from visible populated cells and populated merged cells, not stale worksheet dimensions or formatting-only tails.
- Saved column-width proportions, cell styles, custom table colours, merged cells and safe web/email links are rendered as PDF text and graphics. Long strings wrap; long rows continue across pages without the former eight-line/90-point truncation.
- Inspection and conversion reuse the parsed workbook. ZIP expansion limits, cancellation checks and page/size limits prevent unbounded work.
- Empty selection, missing formula results, actual drawings/embedded objects and impossible cell layouts return explicit errors instead of partial-success PDFs. Empty drawing containers from Google Sheets are allowed.

## Customer regression (private files, not in this repository)

The supplied workbook has three sheets, 48 populated cells and 30 hyperlink cells. The previous PDF had 245 pages, including 241 pages containing only headings/column labels, and no link annotations.

The corrected browser download has **3 pages**. Independent extraction with openpyxl + pypdf verified all 48 populated cell values and every original hyperlink target. There are 30 PDF link annotations, preserving all 30 original hyperlink cells. All three pages were rendered and visually inspected for clipping, colours, borders and wrapping. The original workbook is unchanged and was not uploaded or added to source control.

Browser checks use the real file-input/conversion/download UI:

- Desktop 1440px and mobile 390px, light and dark themes, no horizontal overflow.
- Exactly one add-files button, top-right, working native file chooser.
- Clear selection disables conversion; one chosen sheet exports separately.
- Two input files with identical names produce two separate PDFs in the ZIP.
- No browser exceptions or POST/PUT requests during local conversion.

## Reproduce

All 59 repository tests pass. The production build completes with lint/type checking and 558 generated pages. Its existing content-graph orphan warnings are unrelated to this conversion change and were not modified.

```sh
node --test tests/*.test.cjs tests/*.test.mjs
npm run build
```

Start a local build/preview, then supply a local workbook path:

```sh
PDFPILOT_PLAYWRIGHT_MODULE=/path/to/playwright \
PDFPILOT_CHROME=/path/to/chrome \
node scripts/check-excel-pdf-browser.cjs http://127.0.0.1:3117 /path/to/input.xlsx
```

The browser checker saves private downloads and screenshots in a new temporary directory. It refuses remote origins. The engine tests generate synthetic workbooks and check PDF text, page bounds, hyperlinks, styles, long-cell continuation, hidden cells, merges, selected sheets, invalid inputs and error paths.

## Known boundaries

This is a browser-local, cell-based converter, not Excel's native print engine. It uses bundled Noto fonts rather than arbitrary installed workbook fonts. It does not claim pixel-identical Office rendering, conditional-formatting evaluation, full built-in table-theme fidelity, rich-text run styling, internal-workbook link destinations, print areas/titles or formula recalculation. Actual charts, pictures and embedded objects are blocked with an export-from-Excel instruction. Very wide sheets may use a wider PDF canvas; a vertically merged block taller than a page must be simplified before export.

No automated jobs, SEO generation, production deployment or paid LLM calls are enabled by this change.
