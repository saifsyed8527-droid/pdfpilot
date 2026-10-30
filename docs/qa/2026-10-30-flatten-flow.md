# Flatten PDF flow and cancellation — 30 October 2026

Flatten PDF now uses the shared Merge/Split-style upload → preview/options → process → result/automatic-download flow. The existing form-preserving flattening algorithm and its guards remain. Batch progress, per-file error recovery, grid/list views, individual downloads and ZIP remain available; full page preview and a clear partial-download summary are added.

## Changes

- Stable input copies and bounded batch loading (20 files, 100MB each, 200MB combined), with cancellation and persistent errors.
- Cancellation checkpoints inside document/page/widget processing, preserving completed batch results. Retrying processes only unfinished inputs.
- ZIP is prepared before showing success, with duplicate-safe entry names, a 200MB output limit and cancellation support. An incomplete batch never automatically downloads as if every file succeeded. The user may explicitly download successful files; the result states how many unfinished inputs are excluded.
- No-field PDFs still return their original bytes. Non-form annotations stay untouched; signatures, XFA, conditional visibility and unsafe appearances keep the existing refusal behavior. The nine protected Merge/Split files are unchanged.

## Verification

- Full suite: 320 passing tests. Type check and production build pass; lint has only the three existing crop/image warnings. After a lint-only ZIP terminator declaration adjustment, all 17 focused flatten tests and the production build passed again.

- Two new regression tests cover active cancellation followed by a clean retry, monotonic completed progress, readable duplicate-name ZIP contents, cancellation and output size bounds. Existing rendered form tests continue to pass.
- Browser mixed batch: standard form, Unicode form, no-field PDF and damaged PDF. Three completed while the damaged file remained actionable. Retry preserved completed results. An explicit partial ZIP excluded the broken file with a visible result warning. Removing the broken input kept the three ready outputs.
- All downloaded ZIP entries independently reopened. No interactive fields remained; original links/comments and selectable form text survived. The no-field entry matched original bytes exactly. Actual standard/Unicode downloads rendered pixel-identically to their sources under PDF.js. PDFium with forms initialized showed only minor widget-vs-content text rasterization differences (maximum full-page mean channel difference 0.554/255); images were also visually inspected. Do not claim exact equality across renderers.
- A real 400-page, 4,000-field browser run was cancelled while processing, then retried. The downloaded PDF contained all 400 pages and all 4,000 expected values, without interactive fields.
- At a verified 390px viewport, grid selection and automatic batch ZIP download worked with no horizontal overflow. The two output PDFs reopened independently, including a transformed form appearance fixture.

Flattening remains form-field flattening, not comment/layer flattening, encryption, content redaction or protection against a PDF editor. No physical mobile/Safari certification is claimed. Capability evidence hashes are refreshed only for the modified flattening files.
