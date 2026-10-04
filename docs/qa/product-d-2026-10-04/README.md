# OCR PDF repair candidate — 4 October 2026

Owner D, branch `codex/product-d-2026-10-04`, original base `3c4b879`. Agent A's shared UI commit `5f8c937` was applied in this worktree as `07b32f7` for browser acceptance. The parent should integrate A separately; the following D commit does not re-own shared files.

## User task and bounded requirements

`ocr-pdf` (existing public): take a scanned PDF up to the existing 100 MB limit, recognize clear upright printed English using the already bundled model, retain original visible page content and geometry, add searchable text at its actual word locations, download, cancel/retry, recover from unreadable input, and reset. It must remain browser-local. No new language, provider, paid feature, or dependency was added.

`scan-pdf` (existing public): preserve existing image/camera input, rotations, orientation, page sizes/margins, separate/merged PDF output. Investigation found a decorative 9×9 fake QR and `Show QR` button that only shows a toast. This is a real unfinished mobile handoff feature, explicitly deferred by parent to a separate batch. It was not deleted or declared complete. The camera input is an HTML capture file picker; native device camera behavior has not been certified.

## Reproduced defect and change

The baseline browser OCR succeeded using local assets with no page errors: no current CSP defect was reproduced. But inspecting the downloaded PDF showed each original PNG image stream replaced by lossy JPEG, and all recognized text placed at x=18/y=332 in an arbitrary line instead of the scanned word location near x=45/y=270. The implementation also stripped Unicode before creating its text layer.

The repair keeps the original PDF page streams, images, geometry and native text. It adds fully invisible word-positioned text using Tesseract bounding boxes and the existing Noto font. Native words already at the same location are not duplicated. Only one rendered page canvas is retained at a time, with a 40-megapixel render guard. Active cancellation terminates the Tesseract worker and settles its promise; initialization cancellation disposes the worker once Tesseract exposes it. The worker API remains compatible with PDF-to-Word callers. A mobile toolbar action calls the same real OCR/cancel handler; the desktop action and approved visual style are preserved.

## Actual verification

- `node --test tests/ocr-engine.test.cjs`: 3/3 pass. Tests independently parse real produced PDFs, assert source compressed raster streams are byte-for-byte retained, two pages/geometry/native text remain, `Café` and `€42.75` survive at expected coordinates, active abort settles/terminates, retry works, and TXT/editable DOCX retain Unicode and line order.
- `npm run typecheck`: pass after engine changes. Parent combined checks cover the final mobile toolbar JSX change.
- `ESLINT_USE_FLAT_CONFIG=false npx eslint src/lib/engines/ocr-engine.ts src/app/ocr-pdf/ocr-pdf-client.tsx`: pass (ESLint's legacy-config deprecation warning). A direct default ESLint invocation could not find a flat config; no config was changed.
- Chrome/Playwright against `http://127.0.0.1:4404`: all four substantive checks in `browser-results.json` passed: two-page English OCR text/page order/word alignment; exact equality of every rendered source/output pixel; no duplicate native footer; result reset; cancel then retry; malformed-PDF disabled action then replacement recovery. Browser page errors: zero.
- Emulated widths 375, 768 and 1440, plus dark mode and initial/loaded/processing/result/error screenshots captured. The original shared `PdfAddButton` tooltip caused horizontal overflow at 768; applying A's `5f8c937` fixes it, and all three widths then pass. Mobile action is reachable above the preview. This is emulation, not native device certification.
- The full browser run reached its final network assertion and failed only because it counted Next.js dev's local `__nextjs_original-stack-frames` diagnostic POST during malformed-input testing as a processing upload. All substantive assertions above completed before that guard. The script now excludes only that exact local dev diagnostic URL. A final rerun was OS-killed with exit 137 before replacing the evidence. Do not describe that final rerun as passing. Parent F should rerun the corrected script against the integrated candidate.
- `git diff --check`: pass. No config, registry, gate, dependency, route or launch changes made by D. No push/deployment performed.

## Reproduce and evidence

Run `scripts/check-ocr-browser.cjs http://127.0.0.1:4400` from the integrated checkout with `PDFPILOT_PLAYWRIGHT_MODULE` pointing to the installed Playwright module and `PDFPILOT_CHROME` to the existing Chrome executable. The script generates synthetic source files and inspects actual downloaded output independently with PDF.js/canvas.

Local generated evidence lives in this worktree's `docs/qa/product-d-2026-10-04/`: `ocr-before.pdf`, `ocr-after.pdf`, `scans.pdf`, `browser-results.json`, `ocr-before-loaded.png`, `ocr-initial.png`, `ocr-loaded-375.png`, `ocr-loaded-768.png`, `ocr-loaded-1440.png`, `ocr-loaded-dark.png`, `ocr-processing.png`, `ocr-result.png`, `ocr-error.png`. Generated binaries are intentionally not included in the patch; the reproducible harness regenerates them. The previous assertion screenshot `failure.png` represents the corrected dev-network guard, not a user-facing processing failure.

## Remaining acceptance and queue

No D tool has production completion certification yet. OCR PDF is a local repair candidate pending the corrected integrated browser harness, combined build, release authorization and fresh production-domain verification. Model remains English-only; no multilingual accuracy, handwritten accuracy, native camera, encrypted PDF, or rotated/cropped-page browser certification is claimed in this batch. Unicode packaging is tested separately from OCR recognition accuracy. The embedded Unicode font increases output size (test file about 312 KB); no compression promise is made.

The other 13 assigned tool slugs remain in the central tracker; this candidate does not certify them: `pdf-to-jpg`, `jpg-to-pdf`, `scan-pdf`, `convert-image`, `resize-image`, `crop-image`, `rotate-image`, `compress-image`, `image-metadata`, `ocr-image`, `heic-to-jpg`, `heic-to-png`, `image-watermark`. Next D batch: finish scan mobile handoff and its output/UI acceptance under parent-coordinated dependency ownership, then gated OCR Image/Rotate Image after public blockers.

D local test server on port 4404 was stopped after the final resource-limited rerun. No D browser test or other background task is claimed active at this checkpoint.
