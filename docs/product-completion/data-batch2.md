# Data batch 2 — Agent E

Base: 3e92891a1d15821cfab7a204f65c097ccd9fdb45. Branch: codex/product-data-batch2-2026-10-04. Scope: public excel-to-xml first; existing gated json-formatter, json-minifier, json-validator. Parent owns release, gates/pages/registry/capabilities/dependencies. A's existing TextToolWorkspace is reused read-only. No growth, new tools, services or spending.

## Bounded requirements before implementation

| Tool | Task and supported input/output | Retain | Investigate/complete |
|---|---|---|---|
| excel-to-xml | XLSX/XLS workbook → XML per selected sheet; existing CSV/ODS/XLS/PDF exports remain | Batch files, worksheet selection, header mode, password retry, URL import disclosure, ZIP, previews, cancellation, reset | Prove multi-sheet/Unicode/escaping/header/cell behavior. Reproduce missing formula-cache blank output and combining-mark header loss. Keep formatted values default; evaluate explicit raw saved numeric values option. Correct demonstrated processing/controls defects; keep top action reachable. |
| json-formatter | JSON text/file → pretty JSON | Browser-local JSON grammar validation, JSON download, 2-space default | Preserve exact numeric tokens, escapes, key order and duplicate members instead of parse/stringify data loss. Offer 2/4 spaces or tab; paste/edit, copy/download, inline error location, retry/reset, shared UI. |
| json-minifier | JSON text/file → compact JSON | Browser-local valid JSON and downloadable result | Remove only non-string whitespace; retain exact numbers/Unicode/escaped content/member order. Same useful input/output/recovery controls without irrelevant indentation. |
| json-validator | JSON text/file → validity and parser diagnostic | Genuine grammar validation and clear invalid state | Editable input, location when browser supplies it, report copy/download, stale-result invalidation/reset and robust file failure. No schema validation or numeric representability guarantee. |

Synthetic engine tests come first. Browser runs must coordinate with F/C due resource limits. Actual outputs and settled-theme emulated375/768/1440 screenshots are acceptance evidence; unit tests alone do not certify production. Public/gated cohort completion remains separate, and production launch stays with parent.

## Demonstrated defects and implementation

Reproduction at the base commit: JSON `{ "id":9007199254740993,"x":1,"x":2,"tiny":1e-400,"negative":-0 }` became `{ "id":9007199254740992,"x":2,"tiny":0,"negative":0 }`. Formatter/minifier now validate syntax but format the original source tokens; no numeric reserialization occurs. Indentation supports 2/4 spaces or tabs. JSON syntax reports include native line/column/offset where supplied; engines that omit locations retain their original diagnostic without inventing one. UTF-8 imports reject malformed byte sequences and disclose BOM removal. Literal lone surrogate input is rejected before a lossy UTF-8 download; escaped surrogate tokens stay unchanged. Native parser excerpts remain local; failure analytics receive a fixed description without input content.

Reproduction: public Excel XML converted an uncached formula `Data!A2` to an empty element and stripped vowel marks from Hindi heading `नाम` → `नम`. Exports now fail with the affected worksheet/cell references instead of invented/blank formula values, and combining marks survive in valid XML names. XML saved-value extraction also preserves Excel error labels such as `#DIV/0!`; the old row helper dropped them. Raw mode is explicit and keeps saved numeric values/booleans/date serials; formatted display values remain default. XML fields are text, not an Excel typed-cell schema. SheetJS normalizes worksheet CRLF text line endings to LF; visible line breaks and content remain present.

Existing sheet selection, header mode, batch sorting/removal, encrypted-workbook retry, alternate CSV/ODS/XLS/PDF outputs, server-disclosed URL import, ZIP bundling, cancellation and reconversion remain. Primary Convert files action moves into the top workspace bar for mobile reachability; state/settings remain tool-specific. Long XML/CSV result previews now disclose their 100,000-byte limit. PDF option help no longer falsely says all charts/images are discarded.

References inspected: [RFC8259 JSON grammar and interoperability](https://www.rfc-editor.org/rfc/rfc8259.html), [W3C XML1.0 name grammar](https://www.w3.org/TR/xml/#NT-Name), [SheetJS array extraction](https://docs.sheetjs.com/docs/api/utilities/array/). No unrelated content or growth work.

## Current verification

`node --test tests/data-batch2-json.test.cjs tests/data-batch2-excel.test.cjs tests/excel-to-xml.test.cjs`: 20/20 pass. Covers unsafe integers, extreme numbers, duplicate members, exact escaped/Unicode strings, root scalars/empty collections, parser diagnostics, 10,000 records; XML multi-sheet/ZIP order, headers/Unicode/escaping, raw versus formatted values, error and formula cells, malformed XML characters; legacy Excel exports and encrypted password retry remain passing. Browser verification, full suite/build, production and completion status are still pending.

Typecheck and lint passed (only two pre-existing pdf-to-jpg `<img>` warnings). Full `npm test`: 199 tests, 197 passed, 2 failed solely because the parent-owned reviewed source fingerprints still describe the previous Excel client/engine. Failing checks: `product-launch.test.cjs` reviewed-source assertion, and `pseo-engine.test.cjs` runtime capability drift. Parent must review and refresh these two fingerprints; the implementation worker does not bypass them. No build has been claimed while this parent-owned check is intentionally unresolved.

Parent-owned FAQ changes required before JSON launch: Formatter currently says JSON.stringify/2-space-only; replace with token-preserving formatting and 2(default)/4-space/tab choice. Validator currently says no downloads; it now copies/downloads a validity report (not reformatted JSON). Existing Minifier exact-preservation promise is now met. Excel registry's blanket local/no-upload wording should distinguish the existing, explicitly disclosed server URL import from local-file conversion.
