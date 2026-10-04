# Independent live release verification — 4 October 2026

Agent F ran fresh isolated Chromium sessions against **https://pdfpilot.net** after root's explicit production GO. Root verified Vercel deployment `5SaPq8nGe9BVtXadnijpEbputbtL` as Ready / Current Production, source `3e92891a1d15821cfab7a204f65c097ccd9fdb45`, with the production domain assigned. Deployment URL: https://pdfpilot-5cadx28bi-saifsyed8527-5966s-projects.vercel.app. The merged tree matches the reviewed `e8acf0e` tree; application source was frozen at `53b1429`. Root retains rollback authority and the prior `87a66ce` production checkpoint.

All files are synthetic. Browser runs were serialized. Only QA scripts and evidence changed on branch `codex/product-f-live-2026-10-04`, based on `3e92891`. No product changes or deployment were made by F. Viewports are emulated, not native-device certification.

## Live acceptance matrix

| Scope | Result | Evidence |
| --- | --- | --- |
| Base64 Encode | PASS: exact Unicode clipboard/download, all-256-byte file roundtrip, stale-output invalidation, reset and large filenames | [Codec report](codecs/evidence.json), [keyboard report](keyboard/report.json) |
| Base64 Decode | PASS: exact readable clipboard/download and original binary bytes, filename setting, malformed recovery and reset | [Codec report](codecs/evidence.json), [keyboard report](keyboard/report.json) |
| URL Encode | PASS: exact percent-encoded clipboard/download, UTF-8/BOM, editable file input, invalid UTF-8 recovery, 1.1m-character file with 100k preview and complete 2.2MB output | [Codec report](codecs/evidence.json), [keyboard report](keyboard/report.json) |
| URL Decode | PASS: exact decoded clipboard/download, literal-plus versus form-plus setting, malformed recovery, invalidation and reset | [Codec report](codecs/evidence.json), [keyboard report](keyboard/report.json) |
| Flatten PDF | PASS: downloaded two-page/six-field PDF has zero fields/widgets; preserves Link/Text annotations, values, original selectable text, crop/rotation and exact visible pixels. Custom matrix, Unicode/image and invisible-bit fixtures also match source pixels. Malformed retry/remove/replacement, reset, duplicate-name ZIP, cancel/retry and protected-input rejection pass. | [Full output report](flatten/report.json), [batch report](flatten-batch/report.json), [keyboard report](keyboard/report.json) |
| Four approved references | PASS: actual Merge order/rotation, Split ZIP contents, honest unchanged-size Compress output and PowerPoint content; responsive results/reset, zero page errors and HTTP errors | [Reference report](references/report.json) |
| Mixed PDF → Word repair | PASS on preview-ready retry: editable text cover → OCR scanned middle → editable ending; two page breaks, no page-image substitution; No-OCR explicitly rejects page 2; reset. Initial immediate-action stall remains an unresolved timing concern below. | [Results](mixed-word-retry/results.json), [DOCX XML](mixed-word-retry/document.xml), [runtime trace](mixed-word-retry/runtime-trace.json) |
| Office invalid → valid replacement | PASS for PDF→Word, PDF→PowerPoint, Word→PDF and PowerPoint→PDF: meaningful error, replacement clears error, actual outputs and reset. | [Combined results](office-errors/results.json), individual `*-results.json`, downloaded documents and rendered PNGs |
| OCR PDF | PASS: downloaded two-page searchable PDF has expected text/order/price, aligned word position, native footer once and zero changed visible pixels. Cancel/retry/reset and malformed replacement pass. | [OCR report](ocr/browser-results.json), [downloaded PDF](ocr/ocr-after.pdf) |
| Narrow route/localization policy | PASS: five English routes 200; matching Spanish routes 404/noindex; unrelated rotate-image 404/noindex; language control hidden for new five and retained on Merge and Spanish Merge | [Runtime route report](routes/report.json) |

Codec captures include settled light/dark views at 375/768/1440. Flatten initial/loaded/result/error captures include the same widths and dark results. All five have keyboard-only application control evidence: Tab/Shift+Tab, typing, Space/Enter, focus-visible state, computed outline/ring, exact clipboard/download checks and reset. File selection is supplied through the synthetic Playwright file chooser opened by the keyboard; this does not certify the macOS native chooser itself.

The first keyboard run passed both 1440 and 375 in the actual **light** theme. Screenshot review caught that browser color-scheme emulation did not override PDFPilot's default theme; the report explicitly corrects that label. The QA script now uses the real theme toggle via keyboard and asserts `html.dark`. The separate 375/dark rerun **passes all five tools**, with actual `html.dark` assertions, in [the dark keyboard report](keyboard-dark/report.json). Saved dark screenshots were visually inspected after the run.

**F acceptance:** the five newly launched tools satisfy their agreed bounded function, UI, required-feature and live-verification checks. Root may use this evidence for those five completion records. The original public cohort has only the specific regression/repair coverage stated here.

## Output inspection and remaining limits

- Word→PDF is image-based as explicitly disclosed in the product. Its rendered heading, both sentences and both table cells were visually inspected. The fixture uses narrow 100-twip table grid columns, explaining the wrapped cell text. No searchability claim is made for this conversion.
- PowerPoint→PDF preserves the two expected text pages, red rectangle and green ellipse. PDF→PowerPoint contains two page images and editable text layers; this is not a claim of native reconstruction of every slide object.
- Flatten's Unicode source has an imperfect original character map (`नमĀते` extraction); source and output appearance remain exactly equal. The tool preserves the appearance rather than repairing source font encoding.
- The first mixed-Word run remained at `Reading selectable text… 0% complete` for 60 seconds when conversion was clicked immediately after upload. Its UI/screenshot are retained in `mixed-word/`. A fresh diagnostic run waiting for the actual thumbnail passes. This timing concern is reported to root/C for investigation, not declared fixed. The successful retry captures no processing exception; its two resource errors are the harness's intentionally blocked analytics scripts, plus aborted navigation prefetches.
- Four Office error captures show a temporary toast container extending about 16px beyond the 375px viewport, while document scrollWidth remains 375. This is retained as an observation; no UI repair is claimed.
- The live OCR run leaves analytics enabled. Its sole recorded POST is an existing GA `page_view` at `www.google-analytics.com/g/collect`, with zero-byte body and ordinary page/browser metadata. The URL/body were manually inspected. The QA-only classifier allows only the exact collection endpoint with bounded, named metadata fields and no document markers; unclassified POSTs fail. The original overly broad no-POST assertion was not applied to production telemetry.
- Existing reference smoke and public-tool repair verification do not certify all features of all originally public tools. Root owns complete-tool counts and the wider 99-tool mission.

## Reproduction

Run from the checkout root with these installed paths:

```sh
export PDFPILOT_PLAYWRIGHT_MODULE=/Users/apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
export PDFPILOT_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export PDFPILOT_QA_BASE=https://pdfpilot.net
export PDFPILOT_QA_FIXTURES="/Users/apple/Documents/Codex/2026-10-01/task/qa-fixtures"
export PDFPILOT_FLATTEN_FIXTURES=/tmp/pdfpilot-flatten-b
```

Pass a fresh output directory for each run. Runtime/output scripts used: `qa-launch-routes-20261004.cjs`, `check-encoding-browser.cjs`, `qa-flatten-independent-20261004.cjs`, `qa-flatten-batch-20261004.cjs`, `qa-reference-production-20261004.cjs`, `qa-office-errors-independent-20261004.cjs`, `qa-live-mixed-debug-20261004.cjs`, `qa-live-ocr-20261004.cjs`, and `qa-live-keyboard-20261004.cjs`. Keyboard width filtering is `PDFPILOT_QA_KEYBOARD_WIDTHS=375`; the default is 1440,375. The OCR/Office scripts use `PDFPILOT_QA_OUTPUT`; codec uses `PDFPILOT_CODEC_OUTPUT`; other scripts take base URL and output directory arguments.

Isolated Chrome launch uses the normal sandbox approval mechanism. One diagnostic approval was initially rejected because review retained the superseded wait-for-GO instruction. Root's newer explicit GO and deployment evidence were supplied, and the normal resubmission was approved. No restriction was bypassed.
