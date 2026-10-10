# Excel to XML alternate PDF export: browser dispatch repair

## Reproduced production defect

On 4 October 2026, a fresh Chrome 154.0.8037.97 browser at `https://pdfpilot.net/excel-to-xml` selected PDF for a synthetic two-row XLSX. Conversion displayed **DOMParser is not defined**, with no download and no uncaught page error. [Production evidence](2026-10-04-excel-pdf-dispatch/before/result.json) and [screenshot](2026-10-04-excel-pdf-dispatch/before/failure.png) retain the observed failure. No customer input was used.

`ExcelToXmlClient` calls `runExcelWorker` for every export. The PDF path correctly preserves original/decrypted OOXML bytes, but its renderer reads XML with DOMParser and uses DOM/canvas to paint charts and certain pictures. These APIs are absent from the dedicated conversion worker. Earlier engine tests installed DOMParser globally and therefore did not exercise this dispatch boundary.

## Change and ownership

Only PDF conversion now runs through the existing browser DOM renderer. Inspection and XML/CSV/ODS/XLS exports continue in their dedicated worker. The processing remains on the user's device; no new provider or upload path was added.

The dispatch listens to AbortSignal and retains the existing 180-second limit. Cancellation settles the caller immediately, removes listeners, suppresses stale progress/results, and forwards a cancellation predicate into the existing PDF engine. That engine checks between sheets/page blocks/graphics and after async preparation/save. Already-running synchronous parsing or a pending browser resource decode cannot be physically interrupted; processing stops at its next check. A cancelled attempt never produces a downloadable result.

The parent explicitly assigned C the narrow optional cancellation interface in `excel-conversion-engine.ts`; E confirmed no concurrent writes. This branch does not contain E's newer XML implementation. The parent must integrate these small hunks onto E's current engine, preserving its raw-value and saved-formula guards. No XML UI, registry, capability, dependency, shared-renderer or launch policy edits are included here.

## Executed verification

- `node --test tests/excel-pdf-dispatch.test.cjs tests/excel-to-xml.test.cjs tests/excel-graphics.test.cjs`: **37/37 passed**. Four new dispatch regressions cover actual PDF text/image/page order, pre-abort, cancellation while input is pending with listener cleanup and retry, and unchanged worker cancellation for data exports/inspection.
- `npm run typecheck`: passed.
- `npx next lint --file src/lib/engines/excel-worker-client.ts --file src/lib/engines/excel-conversion-engine.ts`: passed with no warnings/errors.
- Real local Chrome at `http://127.0.0.1:4403/excel-to-xml`, emulated desktop 1440 × 1000: cancellation during deliberately held font preparation restored the UI in **33 ms**, with no stale download. Retry downloaded exactly one PDF; Start over returned to the upload screen.
- Downloaded PDF independently opened with pdf-lib and PDF.js: **2 pages**, correct sheet order, selectable ALPHA/BRAVO markers and values **42/73**, and **2 image objects** (the embedded PNG plus the rendered chart). Both PDF pages were rendered and visually inspected: the green picture and Jan/Feb/Mar bars at **10/20/30** are present and unclipped.
- Zero uncaught browser page errors. The existing ECharts `grid.containLabel` migration notice is retained in the runtime log; it did not prevent this chart rendering.

An initial new test used an exact whitespace-sensitive PDF text match; text extraction split a wrapped word, so the assertion was changed to compare meaningful text without whitespace. Initial browser harness runs needed a unique hydration locator and the upload area's full accessible name for reset. These were harness corrections; the final recorded run passed.

The local browser command was:

```sh
PDFPILOT_PLAYWRIGHT_MODULE=/Users/apple/.npm/_npx/fd3bca3c548369c0/node_modules/playwright node tests/browser/excel-pdf-dispatch.cjs
```

The harness builds its synthetic XLSX using `tests/fixtures/excel-pdf-boundary.cjs`; no private workbook is referenced. Chrome and the isolated 4403 server were closed after verification. Full integrated build, E UI coverage, mobile/dark-mode checks and production repair verification remain with the parent/F release candidate. No deployment was performed by C.

## Output evidence

- [After-run results](2026-10-04-excel-pdf-dispatch/after/result.json)
- [Downloaded PDF](2026-10-04-excel-pdf-dispatch/after/graphics.pdf)
- [Rendered first page](2026-10-04-excel-pdf-dispatch/after/page-1.png) and [second page](2026-10-04-excel-pdf-dispatch/after/page-2.png)
- [Cancellation state](2026-10-04-excel-pdf-dispatch/after/cancelled.png) and [result screen](2026-10-04-excel-pdf-dispatch/after/result.png)

## Accurate capability boundary for parent metadata

The generic claim that charts/pictures are omitted is stale. After integration, suitable concise copy is:

> PDF export requires XLSX and includes supported embedded pictures and standard 2D charts using saved data. Unsupported Excel objects and chart features report an error; exact Excel appearance is not guaranteed.

Use “Local workbooks stay in your browser” rather than claiming all processing happens in a worker. Optional public URL import retains its existing server-fetch disclosure.

Existing engine support is detailed in `docs/excel-graphics-qa.md`: embedded PNG/JPEG, browser-decoded GIF/BMP/WebP/static self-contained SVG, and standard 2D bar/line/area/pie/doughnut/scatter/bubble/radar/stock charts. Charts are rasterized; cell text remains selectable. Linked pictures, 3D/newer chart families, trendlines/error bars, shapes/SmartArt/groups, OLE/form controls and in-cell IMAGE/rich-data or legacy/header pictures are unsupported. Legacy binary XLS must be saved as XLSX for this PDF path. This repair's new browser proof covers one PNG and one bar chart, not every historical graphical boundary.
