# Empty PDF thumbnail regression — 2026-10-04

Agent A, branch `codex/product-a-grid-2026-10-04`, base `7cc551cd294b16b0338140cdd7b2595e692f19b3`.
Local development candidate: `http://127.0.0.1:4401`. Isolated desktop Chrome with emulated viewports, not native-device certification. No deployment performed.

## Reproduced defect and fix

A genuine PDF produced by `PDFDocument.create().save({ addDefaultPage: false })` is accepted by installed PDF.js 6.1.200 and reports `numPages=0`. The render engine resolves an empty array without page callbacks or an exception. `PageThumbnailGrid` previously cleared loading only from those callbacks or its catch handler, leaving Rotate PDF and Extract Pages indefinitely at “Rendering page previews…”.

The grid now handles successful completion with zero rendered pages as an explicit error: “This PDF has no pages. Choose a different PDF.” It clears loading and invokes the existing `onError` callback. Normal progressive rendering, page-count notification, thumbnail completion, selection and page-action behavior are unchanged. No engine, client, configuration or styling was modified.

Before: [Rotate](before/rotate-pdf-empty.png), [Extract](before/extract-pages-empty.png), [results](before/results.json).

After: [Rotate](after/rotate-pdf-empty.png), [Extract](after/extract-pages-empty.png), [375px recovery](after/rotate-pdf-recovered-375.png), [768px dark recovery](after/extract-pages-recovered-768.png), [results](after/results.json).

## Executed verification

- Browser regression first reproduced the existing stuck state on both public consumers, then passed after the fix.
- Both consumers: zero-page error, malformed PDF error, replacement with a real three-page document, three thumbnails, no lingering loading/error, and no horizontal overflow at 375, 768 or 1440 pixels. The 768px recovery screenshots use dark mode after CSS transitions settle.
- Extract Pages replaces the File prop while the grid remains mounted; selection of page 2 correctly changes its pressed state and retains the other two selected pages.
- Rotate PDF uses its existing Change file flow; the real downloaded [rotated.pdf](after/rotated.pdf) has three pages, rotations `[0,90,0]`, and text `FIRST PAGE`, `SECOND PAGE`, `THIRD PAGE` in that order. A result preview and reset also passed.
- No uncaught browser page errors in the grid tests. Next.js development issue indicators in screenshots reflect the existing clients logging the deliberately supplied invalid/empty inputs.
- `npm run typecheck` — passed.
- `npm run lint -- --file src/components/pdf/PageThumbnailGrid.tsx` — passed, no lint warnings/errors; Next printed its existing command-deprecation notice.
- `git diff --check` — passed.

The first before-run stopped at a harness-only assertion because it counted Next.js's global route-announcer alert. Restricting the assertion to the tool's `main` region resolved that test issue; the full before-run then passed. Product code was not changed until that reproduction completed.

## Four reference regressions

The unchanged `scripts/qa-reference-production-20261004.cjs` and its independent output inspector passed all four workflows against this local candidate. [Full report](references/report.json).

| Tool | Inspected output |
| --- | --- |
| Merge PDF | Three pages in Alpha 1, Alpha 2, Beta 1 order; Beta rotated 90 degrees. |
| Split PDF | ZIP with two one-page PDFs, preserving the corresponding Alpha text and order. |
| Compress PDF | Two-page output byte-identical to the already small fixture; UI reports unchanged size, without fabricated savings. |
| PowerPoint to PDF | Two PDF pages containing the expected slide-one and slide-two text. |

All four downloaded outputs, reset checks, empty uncaught-error/HTTP-error lists, and 375/768/1440 DOM overflow assertions passed. Inspected screenshots: [Merge](references/merge-pdf-result-1440.png), [Split](references/split-pdf-result-1440.png), [Compress mobile](references/compress-pdf-result-375.png), [PowerPoint](references/powerpoint-to-pdf-result-1440.png).

Screenshot limitation: the harness's raw 375px full-page captures for Merge, Split and PowerPoint repeat viewport tiles; they are retained locally but not accepted as full-page visual evidence or committed. Their normal 1440px captures and actual output assertions are recorded above. The changed grid is imported only by Rotate PDF, Extract Pages and gated Delete Pages, not by the four primary references. Delete Pages still needs the parent/B combined-candidate check. No complete production acceptance is claimed by this local patch.

## Reproduce

Start the existing app on port 4401, then run from the repository root (set `PDFPILOT_PLAYWRIGHT_MODULE` to the installed Playwright module if it is not on normal module resolution):

```sh
PDFPILOT_QA_OUTPUT=/tmp/pdfpilot-grid-after node tests/browser/page-thumbnail-empty.cjs
node scripts/qa-reference-production-20261004.cjs http://127.0.0.1:4401 /tmp/pdfpilot-grid-references
npm run typecheck
npm run lint -- --file src/components/pdf/PageThumbnailGrid.tsx
```

To reproduce the old behavior on the recorded base commit, set `PDFPILOT_QA_EXPECT_EMPTY_PENDING=1` with the browser harness. All test browsers and the A server were closed after verification.
