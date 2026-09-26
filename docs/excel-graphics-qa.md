# Browser-local Excel chart/image support — 2026-09-27

## Implemented

- Embedded PNG and JPEG retained as PDF images without screenshotting the entire worksheet. GIF (static first frame), BMP, WebP and self-contained static SVG are decoded locally. Office's raster preview is preferred when a newer SVG picture includes one.
- Saved one-cell, two-cell and absolute anchors; cell offsets; row/column dimensions; hidden rows/columns; image crop, rotation, flips and safe web links.
- Standard 2D column/bar, stacked/100%-stacked, line, area, pie, doughnut, scatter, bubble, radar and OHLC/HLC stock charts. Cartesian combinations retain separate secondary axes. Standalone chart sheets use a full-page chart.
- Saved series caches or in-workbook cell references, zeroes, blank positions, series/category labels, dates/number formats, explicit/theme colours, basic data labels and axis limits.
- Drawing bounds extend the printable area even on otherwise empty sheets. Pagination never splits a supported graphic. Connected oversized graphic blocks get a taller page within the PDF size limit. A drawing-placement mismatch stops conversion before download.
- Original/decrypted XLSX package bytes are passed through the alternate Excel PDF export path; no cell-only rewrite that loses drawing/media parts.
- Browser-local rendering via ECharts 6.1.0 (Apache-2.0), loaded only when a chart is converted. No chart service, document upload or LLM call.

## Verification

All 82 repository tests pass; the Next.js production build, lint and type checking pass. The 23 graphics tests cover chart values/caches, zeroes/gaps, hidden data, chart types, stacking, secondary axes, radar scale, scatter line/marker visibility, dates/formats/themes, standalone chart sheets, real image PDF output, alternate export, anchors, invalid/external data and image/SVG safety.

The synthetic workbook has **16 sheets, 14 charts and 9 pictures**. It includes genuine PNG/JPEG/GIF/BMP/WebP/SVG bytes, image-only sheets, a cropped/flipped/rotated image, multiple anchor modes, a chart-only sheet and a long table with drawings crossing potential page boundaries.

The real production-build UI produced a **22-page PDF containing all 23 graphics across all 16 sheets**. Independent pypdf content-stream inspection counted actual image paints, checked their transformed/clipped bounds against each page, and confirmed all 75 long-table row markers survived pagination. Every page was rendered with PDFium and visually reviewed, including scatter points, the secondary value axis and the full-page standalone chart. Local measured conversion time for this small synthetic sample was about 3.2 seconds; this is not a general performance guarantee.

Desktop/mobile, light/dark themes, top-right add-files placement, sheet selection, single-sheet export and duplicate-filename batch ZIP were tested. Runtime-error, upload and off-origin request monitoring was enabled throughout conversion. The existing private ANDROMEDA regression is tested separately; customer files are never added to this repository or public fixtures.

Production-browser failure checks also passed: an unsupported 3D chart and a linked image produce a visible error with no partial PDF or remote fetch; selecting a different supported sheet still converts. Cancelling during font preparation produces no stale download and leaves retry available. The final ANDROMEDA output remains **3 pages, all 48 populated values and all 30 original hyperlink targets**, independently compared with the original workbook; the original file is unchanged.

## Reproduce

Python needs openpyxl, Pillow, pypdf and pypdfium2. The provided desktop runtime contains these. Start a local production preview, then run:

```sh
python3 scripts/create-excel-graphics-fixtures.py /tmp/excel-graphics-qa
node --test tests/*.test.cjs tests/*.test.mjs
npm run build
npm run start -- --hostname 127.0.0.1 --port 3117
```

In another terminal, with Playwright/Chrome available (the browser scripts also accept `PDFPILOT_PLAYWRIGHT_MODULE` and `PDFPILOT_CHROME` paths):

```sh
node scripts/check-excel-pdf-browser.cjs http://127.0.0.1:3117 /tmp/excel-graphics-qa/excel-graphics-supported.xlsx
node scripts/check-excel-graphics-errors.cjs http://127.0.0.1:3117 /tmp/excel-graphics-qa/excel-graphics-supported.xlsx
```

Use `corrected.pdf` from the checker’s printed `QA_DIR`:

```sh
python3 scripts/check-excel-graphics-pdf.py /path/to/QA_DIR/corrected.pdf /tmp/excel-graphics-rendered /tmp/excel-graphics-qa/excel-graphics-supported.manifest.json
```

## Boundaries — do not advertise universal/native Excel fidelity

This is not Excel running in the browser. Supported charts are redrawn with saved data; exact Office chart style, rich-label typography, manual layout, date-axis spacing and every advanced formatting property are not replicated. Chart labels are part of a high-resolution image; worksheet cell text remains selectable. GIF animation is not part of a static PDF.

3D/modern chart families (for example waterfall, sunburst and treemap), trendlines/error bars, SmartArt/shapes/groups, OLE/form controls, legacy VML/header pictures, newer in-cell IMAGE/rich-data pictures and EMF/WMF/TIFF images without a supported preview are not implemented. Recognized unsupported content produces an actionable error instead of a partial PDF. Linked images are never fetched; embed them into the XLSX first. External chart data can use a saved cache but is never refreshed over the network. Missing saved formula/chart values require recalculating and saving in Excel.

Only XLSX is accepted by the dedicated tool. The general converter asks users to save old binary XLS as XLSX before PDF export, rather than silently discarding old-format drawings. No production release, automation restart or SEO work is included in this change.
