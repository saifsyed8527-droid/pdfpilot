# PDF to Word immediate-action stall investigation

Status: unresolved; no implementation fix proposed or made.
Branch `codex/product-word-early-action-2026-10-04` preserves the independent cancellation change `3fedd224c608b05637c0ecdac8db955469739b0e`.

## Reported observation
F's first fresh production `3e92891` Chrome 154.0.8037.97 run selected the synthetic mixed three-page PDF, selected No OCR and immediately converted after theme-mounted hydration readiness. The screen remained at “Reading selectable text…” / 0% for 60 seconds. The final screenshot shows No OCR selected and a completed thumbnail/three-page count. No processing console/worker trace was retained for that first attempt. F's fresh attempt waiting for thumbnail readiness passed the expected page-2 No OCR error and then Auto/editable DOCX output. This timing difference does not by itself establish a race or a fix.

The initial evidence is in the integration checkout's `docs/product-completion/qa-live-3e92891/mixed-word/`; the successful retry trace is under `mixed-word-retry/`. F reported no other coordinated browser/server jobs running at the original failure but cannot certify unrelated Mac load. Both runs blocked only Google Analytics, Google Tag Manager and Clarity requests.

## Source inspection
- `pdfjs.ts` and `pdf-text-extraction.ts` match the production `3e92891` Git objects byte for byte.
- Preview and extraction each independently call `File.arrayBuffer()` then PDF.js `getDocument`. No shared transferred ArrayBuffer is apparent.
- The project does not set `GlobalWorkerOptions.workerPort`. The installed PDF.js 6.1.200 creates a separate worker per document in this configuration.
- WebGPU initialization is opt-in in this PDF.js version and is not enabled by either path.
- Text extraction does not destroy its loading task after completion; this is a separate source-level cleanup gap, not a demonstrated cause of the first-run stall. No cleanup change was made.
- The shared render engine remains B-owned and unchanged.

## Reproducible diagnostic
`tests/browser/pdf-word-early-action.cjs` uses the checked-in synthetic mixed PDF, isolated fresh contexts, hydration readiness, and only the No OCR path. Default cases are two immediate actions and one explicit thumbnail-ready control. It captures the actual preview state at the conversion click, worker create/post/receive/error events (operation metadata only), script request/response/completion timing, console/request failures, headers and screenshots. A case that misses the expected No OCR error at 20 seconds is observed to 60 seconds. No OCR output or customer input is sent to a provider.

## Executed production cases

Executed on `https://pdfpilot.net/pdf-to-word` at 02:13:48–02:14:02 UTC, 4 October 2026, on the parent-confirmed first release `3e92891`. Chrome 154.0.8037.97 ran one fresh isolated browser context per case, emulating a 1440 × 1000 desktop viewport. A released its browser/server slot before these three cases; C closed Chrome afterwards and released the slot directly to E. No local server was started.

| Case | Thumbnail ready at actual Convert click | Expected page-2 No OCR error observed after click | PDF.js worker count | Page errors | Downloads |
| --- | --- | --- | --- | --- | --- |
| Immediate action 1 | No | 789 ms | 2 | 0 | 0 |
| Immediate action 2 | No | 787 ms | 2 | 0 | 0 |
| Preview-ready control | Yes | 786 ms | 2 | 0 | 0 |

The expected output of this No OCR diagnostic is the persistent page-2 error, not a Word document. All three screenshots were inspected: the page-2 error is visible, the selected No OCR mode and three-page preview remain, and the Convert action is available again. Earlier mixed-page Auto/DOCX evidence remains separate and was not repeated in this narrow investigation.

The worker traces show two independent PDF.js workers in every case. The preview worker receives rendering requests; the extraction worker receives `GetTextContent` for all three pages, and every stream closes. Both worker-script requests returned HTTP 200 for every case. There were no worker error or message-error events. Browser console resource errors correspond to intentionally blocked analytics; other failed requests were aborted Next.js prefetches.

One timing variation is recorded without asserting causality: the control case's preview worker took 7,214.2 ms from creation to its `ready` event, and the worker-script request took 7,194.6 ms to complete. The later extraction worker in that same context was ready in 504.2 ms. This demonstrates a slow worker-resource load during a successful case, but does **not** establish why F's original extraction stalled for 60 seconds.

Command actually run:

```sh
PDFPILOT_PLAYWRIGHT_MODULE=/Users/apple/.npm/_npx/fd3bca3c548369c0/node_modules/playwright node tests/browser/pdf-word-early-action.cjs
```

`node --check tests/browser/pdf-word-early-action.cjs` also passed. No application code changed, so no type/build rerun was needed for this diagnostics-only commit.

## Evidence and next checkpoint

- [Case summary](2026-10-04-pdf-word-early-action/summary.json)
- [Immediate case 1 trace](2026-10-04-pdf-word-early-action/1-early.json) and [screenshot](2026-10-04-pdf-word-early-action/1-early.png)
- [Immediate case 2 trace](2026-10-04-pdf-word-early-action/2-early.json) and [screenshot](2026-10-04-pdf-word-early-action/2-early.png)
- [Preview-ready control trace](2026-10-04-pdf-word-early-action/3-preview-ready.json) and [screenshot](2026-10-04-pdf-word-early-action/3-preview-ready.png)

The original stall is **unresolved and not reproduced in these three cases**. This is neither a fix nor full PDF to Word production certification. No speculative timeout, preview-dependent action gate, shared PDF.js change, or cleanup change was introduced. If the stall recurs, use the committed harness to capture whether the extraction worker is waiting for script loading, worker readiness, document loading, or a text stream. Avoid changing the processing path until a failing trace or a separately reproduced resource defect identifies the cause. The earlier OCR cancellation candidate remains preserved as independent commit `3fedd224c608b05637c0ecdac8db955469739b0e`.
