# Page operations: batch 2 candidate

Owner B; branch `codex/product-pages-batch2-2026-10-04`; base `3e92891a1d15821cfab7a204f65c097ccd9fdb45`. Scope is the three existing public tools below. No registry, gates, metadata, dependencies, shared UI or release changes.

| Tool | User task / supported input / output | Existing controls retained | Required repair |
| --- | --- | --- | --- |
| rotate-pdf | Local PDF up to 100 MB; rotate chosen/all pages in quarter turns; one PDF with original page content, order and geometry plus requested rotation | Per-page left/right, rotate-all left/right, reset rotations, preview, download, start over | Do not publish a result after cancel; freeze per-page controls while processing; prevent cropped confirmation preview; primary action near top |
| delete-pages | Local PDF up to 100 MB; remove selected pages/ranges; one PDF retaining original order and page appearance | Thumbnail/Shift selection, range input, clear selection, remove all but last, change file, download/reset | Reset Shift anchor on replacement file; reject invalid/all-page removal; no cancelled output; freeze thumbnail controls; primary action near top |
| extract-pages | Local PDF up to 100 MB; all or selected pages; individual PDF/ZIP or merged subset in original document order | Thumbnail/Shift selection, ranges, select/clear all, merge selected, separate page filenames, download/reset | Reject empty/invalid groups instead of blank output; no partial cancelled output; freeze mode/selection controls; accessible mode toggles and range errors; primary action near top |

## Reproduced defects and changes

- Executed the unmodified extraction engine from base commit: `extractPageGroups(source, name, [], true)` returned a file advertised as zero pages that actually contained one blank page. Cancellation requested after first output still returned both files. Evidence: `/tmp/pdfpilot-pages-b/baseline-defects.json`.
- Delete and Extract tasks ignored the `isCancelled` callback from `useProcessingTask`; Rotate lacked a check after asynchronous serialization. The hook suppresses stale progress/toasts but cannot suppress a client's own `setResult`. New pure page operations and an optional extraction cancellation callback check the real asynchronous boundaries. Long rotate/delete loops and groups of ten extraction outputs yield periodically for UI cancellation, including tiny files whose saves may otherwise resolve entirely through microtasks. Cancelled extraction discards the partial output list.
- Delete's Shift anchor was not reset when replacing a file. Both selection handlers also mutated unrelated state inside React state-updater callbacks. Reset and bounded selection are now ordinary event-handler effects.
- Processing now disables thumbnails (native disabled fieldset), rotation buttons, mode controls and merge checkbox; handler guards prevent mutation during a run.
- The existing approved chrome, colors, controls and desktop preview/sidebar columns remain. The sidebar precedes previews in mobile/DOM order, and its primary action precedes long settings. This removes the former 620/680-pixel preview minimum before mobile actions. Rotate's first-page result preview uses a square contain box so 90/270-degree previews do not crop.
- Delete filenames reuse the existing safe filename function, retaining Unicode names instead of replacing all non-ASCII characters.
- A owns the separately reproduced shared zero-page preview spinner. `/tmp/pdfpilot-pages-b/empty.pdf` really resolves through PDF.js with `numPages=0`. No B edits to PageThumbnailGrid or rendering engine.

## Tests actually run

- `PAGES_QA_DIR=/tmp/pdfpilot-pages-b node --test tests/pdf-page-operations.test.mjs`: **8/8 pass**.
- `npm run typecheck`: pass.
- Targeted `npm run lint -- --file ...` for all five changed implementation files: pass, no warnings.
- `git diff --check`: pass.
- No full build here, per parent's resource-consolidation instruction. Parent combined build is required before release.

The synthetic four-page fixture contains selectable `PAGE n café Ω Привет`, a red/blue PNG, differing page sizes/crops and existing rotations 0/90/180/270. Tests parse actual outputs with PDF.js and compare all rendered pixels and extracted text against the selected source pages at expected rotations. They also verify retained metadata for rotation, page counts/order, delete-all rejection, last-page preservation, duplicate indices, source bytes unaffected, merged group ordering including duplicates, Unicode filenames, ZIP parse/extraction, invalid/malformed/empty input and valid retry.

Cancellation tests stop during progress, a real scheduled event-loop callback among many small extractions, and at the real PDFDocument.save async boundary, asserting that no output survives. A small encrypted fixture is generated from the existing synthetic alpha.pdf using pypdf RC4-128, password `pdfpilot-test-password`. PDF.js independently rejects it without password and reads it with password; all three operations reject the encrypted file rather than returning success. This fixture is for rejection testing, not a claim of production encryption strength.

Outputs retained at `/tmp/pdfpilot-pages-b`: source, rotated.pdf, removed.pdf, last-page.pdf, extracted.zip, extracted-merged.pdf, empty.pdf, malformed.pdf and baseline-defects.json. The generator/test is committed and reproducible; temporary outputs are not required by tests.

## Remaining release acceptance

Browser QA is queued with F/parent on the integrated candidate: actual route input/settings/download/reset, replacement-file Shift selection, malformed/protected/empty recovery, cancel/retry, keyboard and 375/768/1440 emulated viewport/dark-mode screenshots and console review. None of these pending browser checks or production verification is represented as complete. Shared grid empty-PDF recovery depends on A's separately owned fix.

No new production-complete tools are claimed by this candidate. Parent alone integrates, builds and releases. Existing page-copy behavior is preserved. Additional three-page/three-field diagnostics establish that saved widget appearance, selectable text, external URI links and Text comments survive rotation/removal/extraction. Rotation also retains all three native fields/values and a valid internal link to page 3. Delete/Extract retain pages 1 and 3 visually, but have **pre-existing unresolved semantics gaps**: output AcroForm catalog fields are 0 instead of 2; the internal link from retained page 1 to retained page 3 targets an off-tree page reference instead of the retained output page. These tools remain unfinished for full certification until those capabilities are repaired and verified. Reproducible diagnostics are in the test (not assertions freezing the old bug), with `semantics-source.pdf`, `semantics-removed.pdf`, `semantics-extracted.pdf`, `semantics-rotated.pdf` and `semantics-report.json` in the evidence directory. Tagged-PDF and digital-signature semantics are not certified by this repair batch.


## Separate semantics repair after a069409

Branch `codex/product-page-semantics-2026-10-04` changes only the two assigned engines, their regression test, and this note. The previously recorded retained-form/internal-link defects now have passing assertions locally.

Delete and unique-page extraction outputs that contain forms or local destinations retain original page references and catalog instead of copying page dictionaries into a blank PDF. Removed widgets and now-empty field ancestors are pruned; retained fields keep values and saved appearances. Local destinations to removed pages are removed (including link annotations, named destinations and open actions); retained direct/named destinations continue to point at real retained pages. Native page references, metadata and external URI actions remain. Inherited page dimensions/resources are materialized before reparenting pages.

The small reachable-object pass starts from **every PDF trailer root**, including catalog and Info, then follows PDF references, arrays, dictionaries and stream dictionaries. It deletes only unreachable loaded objects after pruning, preventing detached pages/widgets from being serialized. Standard encrypted input is still rejected by PDFDocument.load; there is no ignoreEncryption path. This is not a claim of secure redaction or sanitization. XFA forms get an explicit unsupported error rather than losing their native content.

Plain PDFs retain the existing single-parse extraction copy path to avoid repeatedly loading large documents for each output. Shared Split's intentional duplicate-page groups retain existing copy behavior and exact ordering. This repair's native-field preservation claim covers the unique-page outputs actually exposed by Delete/Extract; Split duplicate native-form preservation is not newly claimed.

`PAGES_QA_DIR=/tmp/pdfpilot-pages-b node --test tests/pdf-page-operations.test.mjs tests/processing-task.test.cjs`: **10/10 pass** (9 PDF tests plus the processing hook). Tests now assert native form/catalog retention and correct local-link resolution, actual edit/save/reopen, PDF.js field editability/value parsing, changed rendered field pixels after editing, metadata/URI/comment preservation, nested/shared field pruning, checked checkbox, radio choice and dropdown option preservation, dead direct/named links, removed OpenAction and no serialized detached Page objects. Existing duplicate/order, Unicode/image pixel comparisons, malformed/empty/protected, cancellation/retry tests also pass.

Typecheck and engine lint pass. Full combined build/browser production acceptance remains with parent/F. Page labels, tagged structure trees, signed-document validity and XFA conversion are not certified by these fixtures. No engine/UI source files beyond assigned scope changed.


### Review follow-up: inline annotations and explicit limits

Extraction now conservatively uses original-catalog retention whenever any source page has annotations, including direct Link dictionaries with inline GoTo actions. The regression creates both dictionaries inline, retains pages 1/3, verifies the retained link resolves to output page 2 in PDF.js, and verifies the removed-page link disappears. Focused PDF plus hook suite: **11/11 pass**.

This bounded repair does **not** certify tagged PDFs: `/StructTreeRoot`, parent-tree entries, MCIDs and `/Pg` references have not been rewritten or validated for page removal. It does not certify `/PageLabels` numbering after subset/reorder. Saving a modified signed PDF does not preserve cryptographic signature validity; signature validation/preservation is not implemented or claimed here. These limitations, plus XFA rejection and shared Split duplicate-form behavior noted above, remain explicit certification gaps. Browser and production evidence is still required; passing these targeted regressions does not mark either tool fully complete.
