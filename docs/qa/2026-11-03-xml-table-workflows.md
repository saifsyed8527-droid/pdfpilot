# XML and CSV table workflows — 3 November 2026

## Delivered behavior

XML to Excel, XML to CSV and CSV to XML now use the existing PDFPilot upload → source/preview and options → processing → automatic/repeat download flow. Merge/Split reference files are unchanged. Each tool accepts local files, pasted text and direct public URL imports, with source/output previews, cancellation and retry.

- XML tables include fields from every selected record, namespaces, attributes, nested children, optional ancestor values, indexed repeated fields or JSON arrays, and original/alphabetical column order. Four layouts: table, key/value, one row per element and nested path levels. An explicit epoch-date option converts eligible 10/13-digit values to UTC dates, with a warning about numeric IDs.
- XLSX and XLS exports contain string cells; leading zeros, long identifiers, whitespace and literal formula-like text are preserved. CSV offers comma, semicolon, tab or pipe, UTF-8 marker and default formula protection. Negative arithmetic expressions are protected while plain negative numbers remain intact.
- CSV to XML supports quoted delimiters, escaped quotes, multiline cells, Unicode, optional headers and custom root/row names. Duplicate/invalid headers become unique XML names; original names survive in `column` attributes. Wider rows receive generated columns, shorter rows receive empty fields. Preview, copy and download use the complete converted data.
- Malformed XML and CSV fail clearly without producing a success file. The browser parser-error namespace is detected instead of assuming Firefox's namespace; this fixes an actual Chromium/WebKit failure found in browser testing. Ordinary user elements named `parsererror` remain valid.
- XML DTDs/custom entities are rejected. Public URL imports use the existing public-address validation/redirect rules, bounded response handling and rate limits. Private network URLs and HTML pages fail. Local/pasted content stays on-device; the URL dialog explicitly explains the server fetch.

## Reference review

Reviewed all images in supplied extraction groups 39 (7), 40 (1), 42 (2), and 69 (6), plus the corresponding primary reference pages: <https://conversiontools.io/convert/xml-to-excel>, <https://data.page/xml/csv>, <https://www.site24x7.com/tools/csv-to-xml.html>. Extraction group IDs are not asserted to be original Docs tab IDs. Existing Excel to XML advanced controls were retained. No private reference files were uploaded to competitor services.

## Verification

- Full suite: **407 passing**, none failed/skipped. Final affected XML suite: **8 passing**, including final negative-formula and headerless-row-limit cases. Type checking and production build checked for this release; see local release29 logs.
- Actual browser XLSX and XLS downloads decoded with SheetJS, retaining `0012`, a 20-digit leading-zero identifier, Hindi/Arabic text, significant spaces, literal formulas, parent values, repeated child fields and a field present only in the second record. Key/value XLS contained 18 data rows. UTF-16 XML retried successfully as a nested-level XLSX with Hindi text.
- Public URL import of PDFPilot's sitemap succeeded: 10 sitemap URLs exported into a real XLSX. A loopback URL was rejected in the UI before retrying the public URL.
- Nested XML → semicolon CSV: actual output had 2 data rows/11 columns, two correct dates, associated repeated items as JSON, literal identifiers, multiline-safe quoting and protected formula cells. One-row-per-element/tab-delimited output had 18 data rows. Copy CSV succeeded.
- Malformed XML was rejected on load and conversion. Malformed quoted CSV showed a useful line-specific error, then a replacement CSV converted successfully. The downloaded XML was byte-identical to the expected fixture, including duplicate/invalid headers, Hindi fields, multiline values, extra columns and short rows. Copy XML exactly matched the downloaded file.
- Cancelled active conversion of 20,000 XML records; no result screen was produced. Retry downloaded a 20,000-row XLSX, independently decoded and checked at the first/last rows.
- Mobile CSV preview and download checked at 354 × 767 CSS pixels: document width remained 354px; wide tables scroll within their panel. Original 9 Merge/Split file hashes matched.

Local evidence: `audit-2026-10-29/fixtures/xml-table/` contains synthetic inputs and independently read browser downloads. Screenshots `release29-xml-options.png`, `release29-csv-mobile-options.png`, `release29-csv-mobile-result.png` were visually inspected. These local files are outside the published repository.

## Boundaries

Input is limited to 8MiB (public URL 4MiB), XML to 100,000 nodes/64 levels/1,000 candidate record paths, and output to 50,000 data rows/512 columns/one million cells/16Mi text characters/64MiB. XLS has a 256-column limit; Excel cells have a 32,767-character limit. Export work runs in a cancellable worker with a timeout; XML inspection yields cooperatively after the browser's bounded synchronous parse.

Malformed-document recovery is deliberately not an “ignore errors” export. This is generic row/field conversion, not arbitrary ERP schemas or lossless reconstruction of mixed-content formatting, comments or processing instructions. CSV readers can infer number/date types; XLSX/XLS should be used to retain text cell types. Epoch conversion is opt-in because numeric IDs cannot be distinguished reliably from timestamps. Cloud-account OAuth and QR transfer are not provided by these converters. These checks do not certify all XML/CSV dialects, Excel versions, devices or complete competitor parity.
