# Independent batch 2 QA preparation

F branch `codex/product-f-batch2-2026-10-04`, based on `1a3b9aacb76a6d949a52ec5b3751a6e595275419`. First-release live evidence remains preserved on `codex/product-f-live-2026-10-04` at `a6dcb50`. Only uniquely named QA scripts and this checkpoint are changed. No browser was started during preparation; the parent must supply the frozen combined build and GO.

## Prepared coverage

- `qa-batch2-pages-independent-20261004.cjs`: Rotate/Delete/Extract real downloads, source page indices, existing plus requested rotation, dimensions/crop/rendered pixels/Unicode text, ZIP members, range rejection, zero/protected/malformed replacement, Delete Shift-anchor reset, primary mobile actions, keyboard action/reset, real 300-page cancellation and frozen controls. Native form catalog/value/widget ownership, comments, external URI and retained internal destination assertions are included using B's semantic fixture. **These semantics currently block Delete/Extract full acceptance until B's separate repair is integrated.**
- `qa-batch2-word-cancel-independent-20261004.cjs`: native OCR worker creation/termination during startup and active recognition; no cancelled download; actual editable text/scan/text DOCX retry. Worker instrumentation records real events and does not fake recognition.
- `qa-batch2-scan-independent-20261004.cjs`: synthetic Chrome camera only, explicit opt-in, stopped tracks, denied-permission recovery, direct-route header and client-navigation recovery, actual camera PDF pixels, image ordering/rotation/page geometry, scan/JPG ZIPs containing three colliding filenames with actual red/blue/red content. No physical camera. Replaces networkidle with hydration readiness; captures/classifies POST evidence without changing network requests.
- `qa-batch2-data-independent-20261004.cjs`: original numeric tokens, negative zero, extreme exponents, escapes, duplicate members, clipboard/download/indentation/errors/reset, UTF-8/BOM recovery and a large JSON file. Excel XML checks sheets/ZIP order, raw versus display values, combining-mark Hindi headings, escaping/error cells and explicit uncached-formula failure.
- `qa-batch2-json-keyboard-20261004.cjs`: all three new JSON tools use keyboard-only app controls, actual theme toggle, indentation where relevant, text/file input, exact download/copy, error focus/location and reset at 1440/light and 375/dark. File payloads enter the chooser opened through the keyboard.
- `qa-batch2-routes-independent-20261004.cjs`: eight English-only additions (previous five plus three JSON tools), Spanish 404/noindex and hidden language control; unrelated gated route and original Merge locale controls retained.
- Existing four-reference, codec and Flatten output harnesses are reused for combined-state regressions. No HTTP-only completion claims.

## Commands after parent GO

Use one browser process at a time. Run from F's checkout; its node_modules points to the existing installed dependencies. Parent supplies the actual `BASE` and frozen source commit; below assumes the established combined production-mode server on 4400.

```sh
export PDFPILOT_PLAYWRIGHT_MODULE=/Users/apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
export PDFPILOT_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export PDFPILOT_QA_BASE=http://127.0.0.1:4400
export PDFPILOT_PAGES_FIXTURES=/tmp/pdfpilot-pages-b
export PDFPILOT_FLATTEN_FIXTURES=/tmp/pdfpilot-flatten-b
export PDFPILOT_BATCH2_EVIDENCE="$PWD/docs/product-completion/qa-batch2-built"
unset PDFPILOT_JSON_ROUTE_PREFIX PDFPILOT_CODEC_ROUTE_PREFIX PDFPILOT_QA_TOOLS PDFPILOT_QA_ERRORS_ONLY

node scripts/qa-batch2-pages-independent-20261004.cjs "$PDFPILOT_QA_BASE" "$PDFPILOT_BATCH2_EVIDENCE/pages"
PDFPILOT_QA_OUTPUT="$PDFPILOT_BATCH2_EVIDENCE/word-cancel" node scripts/qa-batch2-word-cancel-independent-20261004.cjs
PDFPILOT_QA_OUTPUT="$PDFPILOT_BATCH2_EVIDENCE/scan" node scripts/qa-batch2-scan-independent-20261004.cjs "$PDFPILOT_QA_BASE"
PDFPILOT_DATA_OUTPUT="$PDFPILOT_BATCH2_EVIDENCE/data" node scripts/qa-batch2-data-independent-20261004.cjs "$PDFPILOT_QA_BASE"
node scripts/qa-batch2-json-keyboard-20261004.cjs "$PDFPILOT_QA_BASE" "$PDFPILOT_BATCH2_EVIDENCE/json-keyboard"
node scripts/qa-batch2-routes-independent-20261004.cjs "$PDFPILOT_QA_BASE" "$PDFPILOT_BATCH2_EVIDENCE/routes"
node scripts/qa-reference-production-20261004.cjs "$PDFPILOT_QA_BASE" "$PDFPILOT_BATCH2_EVIDENCE/references"
PDFPILOT_CODEC_OUTPUT="$PDFPILOT_BATCH2_EVIDENCE/codecs" node scripts/check-encoding-browser.cjs "$PDFPILOT_QA_BASE"
node scripts/qa-flatten-independent-20261004.cjs "$PDFPILOT_QA_BASE" "$PDFPILOT_BATCH2_EVIDENCE/flatten"
```

PDF inspection/render comparisons run after browser closure where practical. Read the actual reports and screenshots, including POST URLs/bodies and uncaught errors. Specialized preservation claims depend on the inspected output, not a successful button or route. Do not promote the existing public tools to fully complete while known semantics gaps remain.

## Preparation checks

All seven new JavaScript files pass `node --check`. No browser, processing output, typecheck, lint, build or live result has been claimed for this new batch by F. Implementation-family engine tests remain their own evidence until independent combined acceptance runs.
