# Compress PDF production-failure investigation — 4 October 2026

Owner B; base `c31ad8f`. Scope: current public `compress-pdf` failure reported by independent QA. No processor/UI change has been made without an established cause.

## Observed behavior

F's first actual production run with synthetic two-page Alpha text PDF displayed “Compression failed. Your original files are still safe.” No page exception or HTTP >=400 was recorded, but that run did not capture `console.error` arguments.

A later F production run using the same fixture completed and displayed the honest unchanged-original result. Its console capture contains no compression-engine exception. Evidence: `workers/f/docs/product-completion/runtime-production-compress.json` and the initial `workers/f/docs/product-completion/qa-production-2026-10-04/final/report.json`. The first failure remains intermittent and unresolved; this is not a claim that a defect has been repaired.

The current public JS bundle `https://pdfpilot.net/_next/static/chunks/app/compress-pdf/page-b2f2adc069c03806.js` was inspected. It already uses a copied input buffer and destroys the loading task, matching the current repository. Those historical issues are not assumed to be the cause.

B's CUA production page loaded, but its file-chooser upload requires an extension file-URL permission. Native fallback encountered user app changes and was stopped. No permission or browser settings were changed. F's isolated browser harness remains the working route for acceptance.

## Independent output regression coverage

`COMPRESS_QA_DIR=/tmp/pdfpilot-compress-b node --test tests/pdf-compress-engine.test.cjs` passes 3/3 tests against the unchanged production engine, with real PDF.js, native canvas/JPEG encoding and pdf-lib parsing. Only the browser canvas host and worker-loader environment are adapted for Node; processing and size-guard logic are executed as written.

- Each of the three quality presets preserves a tiny two-page text PDF byte-for-byte when rasterization would increase size. Real page progress is 1/2 then 2/2, and original content remains intact.
- A deterministic image-heavy two-page fixture compresses from 3,242,107 bytes to 21,588 bytes. Parsed output retains two pages, image-before-black-page order and the rotated page's physical dimensions. Actual output is independently rendered to verify visible page content. JPEG rounding is allowed; this does not promise lossless compression or preserved selectable text for rasterized results.
- Malformed bytes reject without output, and an immediately subsequent valid conversion succeeds.

Reproducible image fixtures are emitted by the command above to `/tmp/pdfpilot-compress-b/image-source.pdf` and `image-compressed.pdf`. The current F `alpha.pdf` also completed in B's engine harness with `keptOriginal: true`, preserving its 1,073 bytes.

## Next action

F has queued a bounded comparison of immediate action after selection versus action after thumbnail readiness, capturing `console.error` argument message/stack and failed requests. Run this after the higher-priority integrated acceptance checks to avoid concurrent browser resource pressure. If failure recurs, repair the actual exception and rerun these output regressions plus actual browser downloads, retry/reset and release verification. Until then, keep the original intermittent failure open and avoid blanket catch-and-return-original behavior that could disguise unsupported or corrupt input.
