# Batch2 independent release review — 10 October 2026

**Verdict: no newly introduced release-blocking regression found in the bounded candidate review.** The reviewed application is suitable for the parent's release decision. The parent reports that fresh release checks, including the optimized build, passed; post-deployment acceptance remains outstanding. This is not production certification, native-device certification, or a new count of completed tools.

## Exact candidate and scope

- Repository inspected read-only: `/Users/apple/Documents/Codex/2026-10-04/task/pdfpilot`.
- Branch: `codex/product-completion-batch2-2026-10-04`.
- Reviewed HEAD: `8b86357b4ed854ee57180588896e8d2fc4390d00`.
- Frozen application source: `2ba44383d60fd592843417bf47d6b8cfdfbf8a4c`.
- Comparison baseline: `3e92891a1d15821cfab7a204f65c097ccd9fdb45`.
- Read-only Git comparisons confirmed no differences between frozen source and HEAD in `src`, `next.config.ts`, `package.json`, or `package-lock.json`.
- Both `src/lib/engines/pdf-engine.ts` and `src/lib/engines/pdf-split-engine.ts` are byte-identical to `dc7a6fb52cd2c33582cc0a556e824cca30ded188`.
- Reverts remain present: `72aeabebf66ca7c5223f9b49797f448fdb7fdcd4` and `76bdc1afd32bc4e29bc81a17d06671e95dc72642`. The excluded native-form/internal-destination repair was not reintroduced.

Reviewed source changes for `json-formatter`, `json-minifier`, `json-validator`, `excel-to-xml`, `pdf-to-word`, `scan-pdf`, `rotate-pdf`, `delete-pages`, `extract-pages`; shared formatter, Excel dispatch, PDF page, JPG ZIP and thumbnail behavior; route exposure, permission policy, and changed capability/copy claims. Existing approved-reference acceptance was examined from saved evidence without starting another browser run.

## Findings

No actionable new code regression or new release blocker was established.

| Dimension | Bounded assessment | Supporting observations |
| --- | --- | --- |
| Correctness | No new blocker found | Token-preserving JSON formatting/minification avoids numeric rounding and duplicate-member loss. XML raw/display handling and explicit missing-formula-cache errors are represented in code and actual output evidence. OCR abort is forwarded to the real worker; stale canceled results are guarded. Page selections and ZIP filename collisions are bounded. |
| Security/privacy/cost | No new blocker found | No dependency, server-processing, upload endpoint, paid-service or authentication change was introduced by this diff. Camera permission is limited to the scanner document with explicit user action; microphone remains disabled. Existing optional workbook URL import is disclosed. JSON diagnostics use a fixed analytics error description, rather than passing parser snippets to the shared analytics hook. |
| Performance/resource lifecycle | No new blocker found within tested bounds | Browser-only PDF work is dispatched away from the Excel worker; abort and timeout guards suppress stale delivery. Native camera tracks are stopped on close, superseded request and unmount. Page loops yield for cancellation; JSON and workbook size/output checks are present. Saved cancellation evidence is limited to its fixtures and environment. |
| Maintainability | Acceptable for this batch | The JSON family shares one client; processing changes use existing engines and approved shared UI components. Deferred semantic work remains separated and disclosed. |

The original worker README was stale and said remaining acceptance was pending even though the final reports existed. This was reported to the parent. The imported parent README now correctly summarizes final historical acceptance, points to `data/evidence.json`, identifies source/date, and preserves the failed semantic checks. This evidence-index gap is resolved in the imported bundle.

## Independent work performed now

1. Read the exact source diff against the production baseline and relevant unchanged helpers to check cancellation, cleanup, bounds, output correctness and new privacy/cost behavior.
2. Read saved browser reports and their harnesses, separating final successful runs from failed harness attempts.
3. Ran `inspect-batch2-saved-outputs.py` with bundled Python and `pypdf` against the parent's recovered final artifacts. **21 independent checks across 28 saved files passed.** These are fresh inspections of historical output bytes, not fresh processing or UI tests.
4. Visually inspected saved Excel PDF page 1 (selectable data table, green image, Jan/Feb/Mar chart with 10/20/30 values), Scan dark 375px workspace, and JSON Formatter dark 375px result screenshots. These were saved screenshots, not a live browser session.

Direct output inspection established:

- Formatter/minifier preserve exact large integer, extreme exponent, negative zero, duplicate member and escaped-string source tokens. The large minifier file has all 18,000 records; the large formatter retains all 1,100,000 value characters plus Unicode tail. Valid and invalid downloadable reports contain the expected results.
- Excel XML ZIP members parse with an independent XML parser. Hindi combining-mark headings, escaped text, `00123`, error cells, raw `0.123456`, displayed `12%`, false/`FALSE`, sheet order and a subsequent worker XML export are retained.
- Excel PDF has two pages, selectable ALPHA/42 followed by BRAVO/73, and two embedded images on its first page. Saved rendering independently shows the picture/chart.
- Mixed DOCX ZIP passes CRC checks; its document XML contains three editable runs in order: `SELECTABLE COVER ALPHA`, `SCANNED ATTACHMENT BRAVO`, `SELECTABLE END CHARLIE`, separated by two explicit page breaks.
- Rotate/Delete/Extract PDFs retain expected selectable Unicode text, source order, media/crop boxes and rotation deltas for the normal-page fixture. Extract ZIP has four ordered single-page members. Saved cancellation retries have 300 rotated pages, 299 retained pages and 300 extracted single-page ZIP members.
- Scan PDF has two landscape Letter pages with the expected blue/red order. Scan and JPG collision ZIPs each contain three unique names and independently decoded red/blue/red images. The saved synthetic-camera PDF contains a green 640×480 capture. This does not establish physical-camera behavior.

## Evidence

- Final imported historical bundle: `/Users/apple/Documents/Codex/2026-10-04/task/pdfpilot/docs/product-completion/qa-batch2-built`.
- Source association and truthful final summary: that directory's `README.md`.
- Import file hashes: that directory's `recovery-manifest.json`.
- Historical evidence examined: `data/evidence.json`, `excel-pdf/result.json`, `word-cancel/results.json`, `scan/report.json`, `pages/report.json`, `json-keyboard/report.json`, `routes/report.json`, `references/report.json`, `codecs/evidence.json`, `flatten/report.json`, and the deliberately failing `page-semantics/report.json`.
- Original worker bundle preserved: `/Users/apple/Documents/Codex/2026-10-04/task/workers/f/docs/product-completion/qa-batch2-built`.
- Fresh independent inspection and hashes: `/Users/apple/Documents/Claude/Projects/PDF Pilot/.local-release-qa-20261010/saved-output-inspection.json`.
- Reproducible read-only inspection: `/Users/apple/Documents/Claude/Projects/PDF Pilot/.local-release-qa-20261010/inspect-batch2-saved-outputs.py`.

## Exclusions and release limits

- Delete/Extract native form catalog/widget ownership, retained internal destinations, tagged structure, page labels and hidden serialized page-object failures remain real, pre-existing unfinished work. The separate semantic report is failing by design. These defects are not newly caused regressions from this candidate, and this review does not certify their preservation.
- Historical reports ran on 4 October against the optimized local candidate at `http://127.0.0.1:4400`. They are not 10 October UI runs and not production evidence.
- No browser was launched or controlled for this review. No application source was edited; no commit, push, deployment or production mutation was performed.
- No broad suite, typecheck, lint or build was rerun by this reviewer. Before this review was returned, the parent reported fresh 219-test/typecheck/lint and optimized-build passes, with only the two historical PDF-to-JPG image lint warnings. Those checks and the eventual release receipt belong to the parent's evidence.
- Camera evidence is synthetic Chromium. Responsive screenshots are emulated viewports. Real hardware/mobile compatibility and true phone-to-desktop transfer are not established; no speculative transfer mode was added.
- No certification counter should advance on this review alone. Fresh production outputs and interactions remain the parent's release acceptance responsibility.
