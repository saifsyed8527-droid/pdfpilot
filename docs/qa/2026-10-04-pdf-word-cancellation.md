# PDF to Word: active OCR cancellation

Base: frozen release candidate `e8acf0edfb85c201d1ca0db08e086b98add0f489`.
Branch: `codex/product-word-cancel-2026-10-04`.
This is a separate next-batch change; the frozen candidate is unchanged.

## Change and scope
PDF to Word creates an AbortController per attempt and forwards its signal through `convertPdfToWord` to the existing shared `createOcrWorker(signal)` API. Cancel, replacement, reset and unmount abort that attempt. Progress/status callbacks and results check both the signal and the shared task cancellation token. Old attempts cannot clear a newer attempt's controller. An OCR abort returns no output and is not shown as a conversion failure.

The only implementation files changed are the PDF-to-Word client and its conversion engine. The shared OCR engine, privacy model, language model, dependencies, UI layout, conversion modes and release configuration are unchanged.

## Tests actually run
- `node --test tests/pdf-word.test.cjs`: 11/11 passed. Includes existing real PDF.js/Tesseract/DOCX mixed-page regression plus already-aborted input, abort during factory startup, abort during recognition, one physical termination, listener cleanup, late-progress suppression, no stale output and a fresh successful retry.
- `npm run typecheck`: passed.
- `next lint --file src/lib/engines/pdf-word-engine.ts --file src/app/pdf-to-word/pdf-to-word-client.tsx`: passed, no warnings/errors.
- `tests/browser/pdf-word-cancellation.cjs`: passed twice against local Next dev server `127.0.0.1:4403`, with real headless Chrome, same-origin bundled Tesseract and the checked-in synthetic three-page mixed PDF. The second run saved the attached evidence. The harness waits for a mounted theme control before uploading to avoid pre-hydration file-input races.

Browser instrumentation wraps the native Worker API only in the test page. It records real Tesseract worker creation, posted operation names, and native termination; it does not simulate OCR or alter processor output. Timings begin just before the Cancel click and include browser interaction overhead.

| Check | Second run evidence |
| --- | --- |
| Cancel during startup | Convert action available after 43.6 ms; native worker terminated after 258 ms; no recognition operation started |
| Cancel during active recognition | Native worker terminated after 34.5 ms, exactly once |
| Stale output | Neither cancelled attempt downloaded; only the final successful retry downloaded |
| Retry content | DOCX contains selectable cover, recognized scanned attachment and selectable ending in source order; two page breaks; no page screenshot media |
| Browser errors | Zero uncaught page errors |

The earlier cold run measured 61.9 ms to restore the UI, 678.2 ms to dispose the initializing worker, and 34.1 ms to terminate active recognition. These are fixture observations, not universal performance guarantees.

## Startup boundary and remaining verification
Tesseract 7 exposes its worker/terminate handle only after initialization. The existing shared signal API rejects the waiting caller promptly and disposes the initializing native worker once that handle becomes available. Consequently, cancellation during startup is **not** a guarantee of immediate CPU/network termination before initialization finishes; the measured delay above includes that boundary. D confirmed this shared API limitation, and the parent explicitly directed this slice to preserve that shared implementation and report it. Active recognition is terminated immediately through the exposed worker handle.

No production release or live cancellation verification is claimed. These are local desktop headless checks, not native-device certification. No broad build or capability-record changes were made in this isolated slice; parent owns combined release checks and fingerprint refresh.

## Reproduce

From this checkout, with existing Playwright/Chrome installed:

```sh
PDFPILOT_PLAYWRIGHT_MODULE=/Users/apple/.npm/_npx/fd3bca3c548369c0/node_modules/playwright node tests/browser/pdf-word-cancellation.cjs
```

Optional `PDFPILOT_QA_BASE` and `PDFPILOT_QA_OUTPUT` override the local URL/output directory. The synthetic source is `docs/qa/2026-10-04-mixed-pdf-word/mixed-input.pdf`. Captured timings/events, output DOCX/XML and cancelled/result screenshots are beside this note in `2026-10-04-pdf-word-cancellation/`.
