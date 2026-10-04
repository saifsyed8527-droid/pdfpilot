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

`node --test tests/data-batch2-json.test.cjs tests/data-batch2-excel.test.cjs tests/excel-to-xml.test.cjs`: 20/20 pass. Covers unsafe integers, extreme numbers, duplicate members, exact escaped/Unicode strings, root scalars/empty collections, parser diagnostics, 10,000 records; XML multi-sheet/ZIP order, headers/Unicode/escaping, raw versus formatted values, error and formula cells, malformed XML characters; legacy Excel exports and encrypted password retry remain passing. This was the initial engine checkpoint. The completed local browser evidence and final targeted rerun are recorded below; combined build and production verification remain parent-owned and pending.

Typecheck and lint passed (only two pre-existing pdf-to-jpg `<img>` warnings). Full `npm test`: 199 tests, 197 passed, 2 failed solely because the parent-owned reviewed source fingerprints still describe the previous Excel client/engine. Failing checks: `product-launch.test.cjs` reviewed-source assertion, and `pseo-engine.test.cjs` runtime capability drift. Parent must review and refresh these two fingerprints; the implementation worker does not bypass them. No build has been claimed while this parent-owned check is intentionally unresolved.

Parent-owned FAQ changes required before JSON launch: Formatter currently says JSON.stringify/2-space-only; replace with token-preserving formatting and 2(default)/4-space/tab choice. Validator currently says no downloads; it now copies/downloads a validity report (not reformatted JSON). Existing Minifier exact-preservation promise is now met. Excel registry's blanket local/no-upload wording should distinguish the existing, explicitly disclosed server URL import from local-file conversion.


## Final local acceptance — 2026-10-04

The follow-up catches missing cached members inside declared array-formula ranges, including an anchor A2 with saved `2` and omitted A3. A3 now produces an actionable error; a genuine cached zero in A3 remains `0`. Unique array ranges are inspected within the existing 250,000-cell safety bound. Targeted command above now passes **21/21** tests. Final `npm run typecheck` and `npm run lint` pass after removing the temporary harness and its generated Next types (the same two pre-existing pdf-to-jpg image warnings remain). Both selects now expose explicit accessible names (Indentation / Cell values).

Primary references actually observed: RFC8259 sections2/4/6 describe insignificant structural whitespace, duplicate-name interoperability and numeric-range interoperability. This informed whitespace-only transformation plus explicit consuming-application limitations. Installed SheetJS `node_modules/xlsx/types/index.d.ts:710–726` distinguishes raw value `v`, formatted text `w`, formula `f` and enclosing array range `F`; `xlsx.mjs:4618` returns formatted text/error labels, while `make_json_row` transforms date/error cells. Executable fixtures demonstrated these behaviors before the change. The public formula-documentation fetch failed, so the formula-cache behavior is grounded in the installed primary implementation and round-trip fixtures, not an assumed documentation result.

Browser command: `PDFPILOT_PLAYWRIGHT_MODULE=<installed Playwright module> PDFPILOT_JSON_ROUTE_PREFIX=/__qa-json node scripts/check-data-batch2-browser.cjs` against isolated localhost4405. The temporary harness only loaded the three gated clients and has been removed; no gates changed. The script defaults to real routes when no harness prefix is supplied, for parent combined/production verification.

- JSON Formatter/Minifier actual downloads and clipboard match exact tokens: `9007199254740993`, `1e1000`, `1e-400`, `-0`, duplicate members, escaped strings, Unicode and array order. Formatter tab choice invalidates the old output and changes indentation. Validator copies/downloads a valid or invalid syntax report.
- All three JSON clients: malformed trailing comma reports line3/column1; Go to error focuses/selects that character; corrected retry works; reset clears both editors; invalid UTF-8 file fails and a BOM-prefixed replacement recovers with disclosure. Real keyboard Tab from Reset reaches the primary action and Enter executes it.
- Large-file boundary: 1,100,030 input characters exceeds the editable limit. Input and output each show a disclosed 100,000-character preview; the complete 1,100,053-byte formatted download parses equal to the original including its Unicode tail. This is a tested sample, not a claim that every 100MB file was exercised.
- Excel actual ZIPs contain Data then Other. Parsed XML preserves Hindi field/value, escaped ampersands/angle brackets, numeric raw `0.123456`, text `00123`, error `#DIV/0!`; reconversion with displayed values/headerless mode retains the first row and `12%`. Missing formula-cache A2 shows an explicit recoverable error. Array-member cache behavior is covered by the engine regression.
- 37 screenshots capture JSON initial/error/result and Excel configured/result/error states. All result/configured states use settled real dark/light theme toggles at emulated375/768/1440 widths and pass horizontal-overflow assertions. The final Excel configured captures explicitly wait for worker readiness. No native-device certification is claimed. Visually inspected examples include JSON result375 dark, Excel configured375 dark/1440 light, and Excel result768 dark. Zero uncaught browser page errors.

Local artifacts retained in `reports/data-batch2-browser/`: `evidence.json`, 37 PNGs, downloaded JSON/reports and parsed ZIPs. Browser and localhost4405 server were stopped after the passing run. Earlier reading-state screenshots were superseded by final ready-state captures; no production deployment was performed by E.

Downloaded artifact fingerprints from the passing final run:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| json-formatter.json | 210 | `f32794462970b271c51227ed7345eaa3ec4d815c3a34119494b997f5159fefd9` |
| json-minifier.json | 155 | `6a3fc719267b56c74c2853814a3562ef7a1cad397d99cda68c4ab29ebbe16d58` |
| json-validator.txt | 168 | `2e5b38044a4d68e6f707dd4534627051597296fbd9248dc4e98bcac671d9df94` |
| invalid-report.txt | 117 | `bdbcd0a73438135b7fdc6f54591f0eb625fcc05feca0f3473b1ebd0f2fda8e65` |
| large-formatted.json | 1100053 | `f148544c4422bcf541a3e17e9a25e66a9317f12171d55460426d8ff21679be88` |
| excel-raw.zip | 524 | `d49de68d203d799a8444713182f2aca835762d6a66d9842d59aa9da033c7b578` |
| excel-formatted-headerless.zip | 550 | `e943b3bf3615522d57da325fa3b3b4de4e833ab8b85aab5b7336864ebac2d71f` |

Remaining integration work: parent-owned FAQ/registry corrections and reviewed-source fingerprints, combined tests/build, English-only launch gates for the three JSON tools, and fresh production acceptance. Original-public Excel and the three gated JSON tools remain **not production-complete** in this worker record until that verification occurs. No new services, dependencies, unrelated routes or release configuration were changed.
