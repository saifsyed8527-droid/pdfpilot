# Compare PDF — 29 October 2026

Adds visual comparison alongside text comparison within the existing upload → preview/options → process → result flow. Results offer side-by-side pages, synchronized scrolling, zoom, a difference overlay, added/removed text, page-pair selection, text search and a changed-pages filter. A PDF visual report downloads automatically; the complete UTF-8 text-change report is a separate download.

Exact matching text anchors identify inserted/removed pages. Unmatched gaps and scanned pages are paired in order; alignment can be disabled. Whitespace/case options affect text comparison only, while rendered differences remain visible. Filled text/choice form values are included in text extraction. The visual overlay distinguishes darker original pixels, darker revised pixels and color changes; page-size changes are reported separately.

Original and revised input controls are explicitly named. Pending replacement disables comparison and offers cancellation, so it cannot silently run with the previous revised file. Both files can be swapped. Rendering and report generation check cancellation; cancelled jobs cannot publish stale results.

Validation:
- The full suite passes all 270 tests. Type checking and the production build pass; lint reports only three existing warnings.
- Eight engine tests cover text edits, page insertion/removal, stable page anchors, scanned color changes, identical scans, position changes, page-size changes, form values, cropped/native rotations, sensitivity, text normalization, malformed and oversized input, cancellation and retry.
- Tests reopen/render every page of the PDF report and confirm that each comparison pair includes actual source and overlay images. The text report retains long Unicode changes without truncation.
- Real browser comparison of a three-page original and four-page revision correctly identifies three changed pairs, one inserted page and one unchanged page at its new position. The five-page PDF report was independently reopened with pypdf and rendered with PDFium.
- Browser text-change download contains the removed 100, added 150, inserted approval page and scan guidance. Search/no-results, changed-page filtering, text/overlay views and page selection were exercised.
- At 390 pixels, the layout stays within the viewport even at 300% image zoom. Scrolling one image pane moved both to the same relative position; synchronized scrolling is user-selectable.
- Malformed input displays readable recovery guidance. Swapping an 80-page input works; cancelling an active comparison returns to the workspace. Replacing it with an identical valid pair then produces a fresh four-page report with zero changed pairs.
- All nine protected Merge/Split reference files and shared flow components remain unchanged. The shared FileToolLayout gains only an optional replacement-button label; other tools retain their existing label and behavior.

Limits: rendering is bounded to 108 DPI and two million pixels per page pair, so tiny changes can be missed; the sensitivity and limit are disclosed. Text extraction does not perform OCR or reconstruct arbitrary reading order. Automatic alignment is based on exact normalized text, not semantic interpretation. Hidden metadata, attachments and digital signatures are not compared. Browser limits are 200 pages per input, two million extracted characters and bounded preview storage; oversized work stops explicitly instead of truncating it. PDF reports contain visual page comparisons; full text changes are provided separately. No complete competitor-parity claim is made.

Production verification: the published Compare PDF produced the expected three changed pairs from the original three-page / revised four-page fixture. The automatically downloaded five-page PDF report was reopened independently and rendered with PDFium. The live text report contains both changed amounts and the inserted approval page.
