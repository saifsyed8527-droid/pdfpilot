# Organize PDF — workspace and output verification

## Shipped scope

The existing upload → page board/options → process → auto/repeat-download flow is retained. The organizer now supports 30-step Undo/Redo, Shift-range/multiple selection, bulk quarter-turn rotation/removal, move selection to start/end, filename sorting, source-file movement/removal, and blank pages matching an adjacent page or A4/US Letter. Pointer and native keyboard drag reorder the page board; screen-reader messages use page positions. The desktop export action stays visible while its options scroll. Mobile cards expose their actions without hover.

Preview loading validates 20 files, 100MB/file, 200MB total and 1,000 source/output pages. Each thumbnail is rendered sequentially with its canvas released immediately. Cancel destroys the active renderer/loading task and retains completed files; invalid members of a batch do not discard valid files. Empty boards remain recoverable through Undo, new files or blank pages, including a valid blank-only export after the last source file is removed.

The new export engine preserves original page content, native crop/rotation and supported interactive AcroForms. It prunes widgets on removed pages, keeps shared fields on retained pages, adjusts radio option mappings, namespaces fields across multiple PDFs, and aliases font resources/default appearances so colliding field/font names remain independent. Form appearances are copied unchanged. It handles combined field/widget dictionaries and fonts found only in appearance resources. Internal named/direct links are resolved to retained output pages; actions to removed/unavailable pages are cleared. External links remain. Single-source Info/XMP metadata is retained.

XFA, signature fields/certification, unsupported widgets and malformed radio mappings fail with actionable errors. The operation does not rebuild document bookmarks or document-level attachment lists and is not secure redaction/deletion. The workspace and tool help disclose these limits. Shared node_modules and nine Merge/Split baseline files are unchanged.

## Verification performed

- Full suite: 369 tests passed. Production build, lint and TypeScript completed; the same three pre-existing lint warnings remain. Seven new output-based cases cover cropped rotations, fields shared across pages, duplicate field/font names across files, radio option pruning, direct/named/external links, fused field/widget dictionaries, limits/invalid inputs, cancellation and blank-only output.
- Independently rendered engine output with PDFium form initialization: both retained cropped pages, including the additional 90-degree rotation, are pixel-identical to the source rendered at the intended rotation. Reopened forms accept new text values independently after combining PDFs.
- Actual browser batch: `zeta.pdf`, malformed `invalid.pdf`, `alpha.pdf` retained both valid files and reported the invalid file. A–Z/Z–A grouping, page removal → Undo → Redo, Shift selection, bulk rotation, matching blank insertion and native keyboard drag were exercised.
- The resulting downloaded five-page PDF contained, in order: Zeta page 2 at native 90°, a 440×360 matching blank, Alpha page 1 at 90°, Alpha page 3 at 270°, and Zeta page 1. All four retained pages rendered pixel-identically to their intended source pages with form appearances enabled. Four terminal fields retained their values; the removed-page checkbox was absent. Both same-name text fields remained independent under their source prefixes. A link to a removed page was cleared.
- At a verified 390×844 viewport, page width stayed 390px. Removing the last file and removing all pages both retained Undo recovery. Adding a US Letter page and exporting produced a valid four-page PDF: the three original pages rendered pixel-identically, all four original form fields remained, and the final blank page measured 612×792 points. Temporary viewport overrides were reset.
- Cancelling preview loading of a 350-page file after a three-page PDF completed retained only that completed PDF. Adding another valid PDF afterward recovered without reloading.
- Final UI check: the desktop Organize button occupied y=596.5–652.5 within a 720px viewport. Native keyboard movement announced the destination as a page position. Removing the last source, adding a Letter blank and exporting produced a valid one-page 583-byte PDF.

Private evidence outside the repository: `release24-organize-workspace.png`, `release24-organize-mobile.png`; source/output PDFs, independently rendered images and JSON checks under `audit-2026-10-29/fixtures/organize/`. The seven-case test module can emit synthetic fixtures with `ORGANIZE_QA_DIR`.

## Limits

The source/output limits are enforced bounds, not maximum-size performance certification. Complex scripts, custom form JavaScript, obscure annotation behaviors and every PDF reader are not comprehensively certified. Namespacing affects field names in combined files. Bookmarks/document attachments are not rebuilt; links with unavailable destinations are removed. Original appearance preservation does not guarantee that a future third-party form editor will use identical fonts when values are changed. Broader reference parity and all-tool validation remain in progress; zero defects are not claimed.
