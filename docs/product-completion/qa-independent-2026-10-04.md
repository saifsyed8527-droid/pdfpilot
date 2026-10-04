# Independent QA checkpoint — 4 October 2026

F owns only these uniquely named QA scripts, fixtures and evidence. No implementation, launch gate or configuration files were changed. Browser runs use a fresh isolated Chromium profile with synthetic files; 375/768/1440 widths are emulated, not native-device certification.

## Production reference smoke (before the candidate release)

- Merge PDF: actual downloaded three-page PDF has `ALPHA PAGE ONE`, `ALPHA PAGE TWO`, `BETA PAGE ONE` in order; Beta's selected 90° rotation is retained. Result at all three widths has no horizontal overflow. Output and page renderings are in `qa-production-2026-10-04/final`.
- Split PDF: fixed groups of one yield two uniquely named PDFs in a ZIP. Both contain the correct respective Alpha page, verified by extracting text and rendering each download. Result at all three widths and Start Over pass.
- PowerPoint to PDF: two downloaded pages contain selectable Slide One then Slide Two text and the intended red rectangle / green ellipse. Result at all three widths has no horizontal overflow. Outputs and renderings saved.
- Merge and PowerPoint's first harness overall status is `failed` only because the test incorrectly required `Start Over` capitalization; actual controls say `Start over`. The harness now uses a case-insensitive locator; full reset rerun is pending. This is not a product defect.
- Compress PDF: the first run showed a real inline `Compression failed` and no output on the tiny Alpha PDF. A fresh retry on identical bytes reached an honest `already well optimized — size kept unchanged` result with no processor error. The cause of the intermittent first failure remains unresolved; no implementation repair is claimed. A bounded retry with download inspection and console capture remains pending. The debug run recorded pre-existing Clarity CSP failures, outside product-processing scope; CSP was not changed.

This is reference smoke evidence, not certification of every feature or a completed-tool count.

## Integrated Flatten candidate

The initial cold dev run returned HTML but failed hydration with `Invalid or unexpected token`. A fresh navigation and subsequent complete processor run succeeded. No implementation change was made based on the transient dev error; the production build must be checked separately.

`qa-flatten-independent-2026-10-04/retry/report.json` records:

- Real browser download of a two-page PDF with six source fields. Output contains zero fields/widgets, preserves page crop/rotation, and preserves Link and Text annotations.
- All expected saved values including Ada Lovelace and existing selectable text remain in the output.
- Source and downloaded output render pixel-identically across every page.
- Rotated/scaled appearance, embedded Unicode font + image, and invisible-bit fixtures also download and render pixel-identically.
- Initial, loaded and result layouts at 375/768/1440, plus dark result views, have no horizontal overflow. The primary result download appears near the top on mobile. Reset works.

The first malformed-input test accidentally selected Next's empty route-announcer alert before processing ended. The selector now targets the tool's article alert. The recovery-only rerun in `qa-flatten-independent-2026-10-04/recovery/report.json` passes malformed input → actionable error → retry → remove → replacement → successful six-field flatten.

Remaining: built-candidate smoke, batch ZIP/cancellation, protected/signed input browser coverage, final live verification after release. Engine rejection coverage is owned by B and is not substituted for this browser evidence.

## Office and codec checks

The mixed PDF-to-Word dev harness initially set a file before hydration and timed out before processing. A uniquely named F copy now waits for the theme mounted marker; no product failure is asserted from that test setup failure. Final combined-build runs are queued with the integrated shared OCR engine.

F source review of codec text/file modes, strict UTF-8/BOM handling, lossless raw-byte encoding, malformed recovery, plus-sign semantics and stale result invalidation found no blocking defect. Browser/large-output confirmation is queued on the built candidate. Source review alone is not acceptance.

## Reproduction

`PDFPILOT_PLAYWRIGHT_MODULE` points to an installed Playwright package; `PDFPILOT_CHROME` can select an installed browser. Isolated browser launch required the sandbox's existing escalation approval. No user Chrome credentials/profile or broadened extension file access was used.

- `node scripts/qa-reference-production-20261004.cjs https://pdfpilot.net <output-dir>`; optional `PDFPILOT_QA_TOOLS=merge-pdf,compress-pdf` narrows reruns. Synthetic normal fixtures are checked into `tests/fixtures/product-qa`.
- `node scripts/qa-flatten-independent-20261004.cjs http://127.0.0.1:4400 <output-dir>`; `PDFPILOT_FLATTEN_FIXTURES` supplies B's generated form fixture directory. `PDFPILOT_QA_ERRORS_ONLY=1` runs just recovery.
- `node scripts/qa-codecs-independent-20261004.cjs http://127.0.0.1:4400 <output-dir>` inspects raw binary, Unicode/BOM/whitespace, plus decoding and 1.1-million-character file output.
- `PDFPILOT_QA_BASE=http://127.0.0.1:4400 PDFPILOT_QA_OUTPUT=<output-dir> node <F-path>/scripts/qa-office-mixed-independent-20261004.cjs` from the integrated checkout uses the checked-in mixed document fixture.

No tool has been marked fully production-complete by F. Root owns integration, release and the central counts.
