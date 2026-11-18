# Conversion reliability checkpoint — 18 November 2026

Base: GitHub main c4996a68bf53da20b65eca94df3780da6aad0c4c.
Branch: codex/pdf-reliability-20261118. Local only; not pushed or deployed.

## Integrated fix
Recovered the existing uncommitted PDF-to-PowerPoint engine patch from pdf-powerpoint-fix-2026-11-11 without changing that worktree. Default appearance output now uses high-quality JPEG (small lossy compression) rather than PNG, addressing the previously investigated Mac Quick Look repeated-page behavior. Explicit engine PNG option remains supported. Optional native search-text failures/limits no longer discard renderable appearance-mode pages. Editable and OCR modes keep strict text limits. The current localized UI is preserved, with the page report using existing translated No text / layer labels for omitted text.

## Fresh verification
35/35 focused tests passed on this current-main integration: 48-page distinct-picture storyboards in both JPEG and PNG, caption and order checks, native crop/rotation, Hindi/Arabic OCR, PPTX-to-PDF RTL, compression, invalid input, cancellation/retry, and page operations. TypeScript noEmit with incremental disabled passed. Synthetic fixtures only; no production load tests and no customer-file upload.

## Explicit limits and next checks
No production release, live conversion verification, full production build, or complete suite has been performed on this patch. Tests establish archive/output invariants, not Microsoft PowerPoint or Quick Look application compatibility for all files. Existing older customer-file QA evidence is historical, not a fresh user-bug reproduction. All 109 tools and all localized routes are not functionally verified by these 35 tests.
Editable PDF-to-PPT output deliberately does not reconstruct pictures, charts, fonts or full design. Appearance mode preserves rendered pages but is not editable design reconstruction. These product limits must remain explicit.
Page-operation tests also document lost interactive form/internal-link semantics in extracted/deleted-page output despite preserved visible appearance; do not describe those tests as full semantic fidelity.

## Follow-up browser and capability review
Real macOS Chrome 157.0.8103.79, local development app: the actual upload buttons triggered filechooser events; a synthetic four-page PDF with four different colored pictures and four distinct text markers downloaded a four-slide PPTX. All slide image hashes differ, every slide has its correct text marker, and every slide has its image relationship. Re-uploading that PPTX through the actual PowerPoint picker downloaded a four-page PDF. Independent PDF.js extraction found the four expected text markers in order, and all four rendered PDF pages were visually inspected: correct numbered image and caption, no dropped/repeated pages.
The existing /pdf-to-powerpoint-on-mac guide retained Finder/Downloads guidance and the correct tool link; widths 375, 768 and 1440 had no horizontal overflow. This is Chrome on a real Mac, not Safari or Microsoft PowerPoint certification. Automated picker assignment is not a manually inspected native dialog.
The processing/privacy/format declarations were re-read against the engine and retained: browser processing, PDF input/PPTX output, supported appearance/editable modes, bounded OCR, and documented editable-mode limits. Existing Mac page content is unchanged and still accurately describes selecting and downloading files. Only its evidence-bound review is renewed; no new pages or broadened capability claims are approved. Initial prebuild correctly caught changed source hashes. Renewed hashes below bind this inspected source and fresh evidence, not an untested release.
