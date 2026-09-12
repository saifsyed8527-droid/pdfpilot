# PDF to Excel implementation note

PDF to Excel is now implemented as a browser-native tool at
`/pdf-to-excel`.

## What shipped

- `src/lib/engines/pdf-table-engine.ts` extracts positioned PDF text with
  `pdfjs-dist`, clusters text into visual rows and column anchors, and
  writes a real `.xlsx` workbook with SheetJS (`xlsx`).
- `src/app/pdf-to-excel/` provides the tool flow: upload, preview,
  NO OCR/OCR options, one-sheet vs multiple-sheets layout selection,
  processing, and Excel download.
- `src/lib/tools-data.json`, `src/lib/tools.ts`, cross-sell links, and
  document conversion category data register the tool across nav, home,
  SEO, schema, and related-tool surfaces.

## Scope

The implementation converts PDFs that already contain selectable table
text. PDF files do not contain native spreadsheet tables, so the engine
detects table-like structure from text coordinates. It works best for
reports, invoices, statements, exports, and other PDFs where columns are
visually aligned.

Scanned/image-only PDFs still need OCR before table extraction. The UI
shows OCR as a premium-disabled option so the flow matches the expected
PDF-to-Excel product path without pretending scanned-page OCR is already
available in this tool.
