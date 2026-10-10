# Independent combined acceptance — batch 2

Historical acceptance ran on 4 October 2026 against optimized application source `2ba44383d60fd592843417bf47d6b8cfdfbf8a4c` at http://127.0.0.1:4400. Recovered on 10 October without rerunning or relabeling those results. Original worker checkout and failed harness-attempt directories remain intact. This directory contains the final successful runs, plus the deliberately separate known-semantics report. Synthetic fixtures only; responsive views are emulated, not native-device certification. The recovery manifest records every imported file and hash.

## Final acceptance recovered

- `data/evidence.json`: all three JSON tools pass exact numeric/string/member preservation, actual copy/download, error locations, retry/reset, UTF-8/BOM and complete large output beyond preview limits. Excel XML passes sheets/ZIP, raw/display values, combining Unicode, escaping/error cells and explicit uncached-formula errors.
- `json-keyboard/report.json`: six passing cases across all three JSON tools at 1440/light and 375/dark, including file input, indentation, copy/download, error focus and reset.
- `excel-pdf/result.json`: browser PDF dispatch produces two pages with ALPHA/42 then BRAVO/73, embedded PNG and chart. Cancel/retry/reset and subsequent worker XML ZIP pass.
- `word-cancel/results.json`: real OCR worker termination during startup/recognition; no canceled output; retry produces editable text/scan/text DOCX in order.
- `scan/report.json`: synthetic camera capture and cleanup, permission failure recovery, order/rotation/geometry, ZIP filename collisions, actual PDF pixels and responsive controls pass. No physical-camera or phone-transfer certification.
- `pages/report.json`: Rotate/Delete/Extract selection, real outputs and pixel equality, invalid/protected/empty recovery, 300-page cancellation/retry and responsive/keyboard checks pass.
- `routes/report.json`: three new English JSON routes and prior five launches, translated 404/noindex gates, unrelated gated tool, and original language controls pass.
- `references/report.json`, `codecs/evidence.json`, `flatten/report.json`: actual-output regressions pass for four approved references and the five prior launches.

## Known unfinished semantics

`page-semantics/report.json` records existing Delete/Extract failures for native forms, retained destinations, tags, page labels and hidden serialized page objects. These are not passed checks. The failed catalog-preservation repair remains excluded; current engines equal reviewed baseline `dc7a6fb`. No public repair in this batch is counted as full tool certification. Production certification remains 5/99 until actual deployment and fresh live acceptance.
