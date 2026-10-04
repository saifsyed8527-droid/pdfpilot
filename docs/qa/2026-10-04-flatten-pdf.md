# Flatten PDF product completion candidate — 4 October 2026

Owner: B. Branch: `codex/product-b-2026-10-04`. Base: `3c4b879` (runtime base `87a66ce`). No public gate or route metadata changes are included.

## User task and bounded contract

Flatten saved AcroForm field appearances into regular PDF page content, keeping sharp original page text, images, geometry and page order. Input: up to 20 local PDFs, 100 MB each, 200 MB per batch. Output: one named PDF per input, or a ZIP of completed results. Controls: add/remove, grid/list preview, explicit Flatten action, cancel remaining documents, retry unfinished documents, individual/ZIP download and reset. This is a form-flattening tool, not annotation flattening, encryption, redaction, or immutable document protection. Non-form comments/links/layers remain unchanged.

XFA, signatures/certification, password-protected/damaged files, empty documents, stale appearances explicitly marked `NeedAppearances`, orphan/unknown fields and unsafe conditional visibility fail without partial output. Files without form widgets return identical original bytes with an honest unchanged message. Missing Latin appearances are generated; missing unrenderable Unicode appearances fail safely instead of losing values.

## Provenance and UI

Selectively reused only `pdf-flatten-engine.ts`, `flatten-pdf-client.tsx`, and `flatten-pdf.test.mjs` from the preserved `.local-release-qa-20261001/checkout`. No historical checkout was changed or merged. Added independent rendered-output regression assertions. Restored visible FAQ content omitted by the recovered client, made the action panel first on small screens, retained a primary result download near the top, and added dark-mode/focus styling for removal controls.

Uses approved `PdfToolLanding`, `PdfWorkspaceBar`, `PdfAddButton`, neutral slate surfaces, existing orange PDF-operation accent, white/dark workspace cards. Batch results remain next to their source previews so users can identify partial successes and failures.

Reference inspected: [PDF24 Flatten PDF](https://tools.pdf24.org/en/flatten-pdf), retrieved 4 October. Public workflow describes selecting multiple PDFs, explicit processing, then downloading results. This establishes the useful batch flow only; no assets/branding or unsupported security guarantees were copied.

## Executed verification

- `FLATTEN_QA_DIR=/tmp/pdfpilot-flatten-b node --test tests/flatten-pdf.test.mjs`: 15/15 passed after current changes (including an added push-button appearance case).
- `npm run typecheck`: passed.
- `npm run build`: started, prebuild/runtime validation passed, then stopped during optimization at parent request because concurrent QA strained this Mac. No build failure was observed; a completed combined build remains required.
- `npm test`: 157/157 passed before the additional push-button test; the subsequent focused suite includes that new test and passes 15/15.
- `npm run lint`: passed with only two pre-existing `<img>` warnings in `pdf-to-jpg-client.tsx`.
- Independently rendered source and output through PDF.js 6.1.200 and native canvas at scale 1.5: zero differing pixels for 6 pages across multi-page common fields, repeated widgets, comments/links, rotated/cropped geometry, custom transformed appearance matrix, embedded Devanagari font plus JPEG, and the recognized Widget Invisible flag, and push-button label. These comparisons are now assertions in the committed tests.
- Extracted output text includes original selectable text and flattened form values in page order. The embedded Unicode fixture retains its original font bytes and exact rendered appearance. Its source font mapping itself extracts imperfect Unicode (`नमĀते`), so this fixture is not claimed as Unicode text-extraction certification.
- Parsed outputs have no AcroForm or remaining widget annotations; other annotations and embedded image/font bytes are preserved. ZIP contents independently unzip/parse, preserve duplicate/Unicode filenames via unique numeric prefixes, and disallow path separators.

## Pending release acceptance

Browser interaction/download, widths 375/768/1440, dark mode, retry/reset/cancel and browser errors are in progress. A disposable local route `qa-flatten` imported the exact client on port 4402 and has been removed. The route compiled successfully (199 seconds), but CUA navigation/snapshot repeatedly timed out even in a fresh browser tab; final attempt reset the CUA kernel. Browser acceptance is still unverified. Do not count this as production completion.

Parent must review launch capability/gate/metadata and correct the existing page FAQ's inaccurate guarantee that nobody can edit flattened values. Accurate wording: values stop being interactive form fields, but a PDF editor can still edit ordinary page content. Production deploy and live verification remain parent-owned.
