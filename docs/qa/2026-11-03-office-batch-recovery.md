# Office PDF batch recovery — 3 November 2026

Word, PowerPoint and Excel conversions now retain completed PDFs when another document fails. Each file has its own error or ready state and an individual download. Retry processes unfinished files only. Changing rotation or selected Excel sheets invalidates only that file's result; sorting does not discard results. A partial ZIP explicitly identifies how many documents were omitted. Back to files keeps inputs and finished work. Word keeps its single-document page previews and visual renderer; the shared workspace preserves upload, arrange/options, processing and automatic/repeat download.

Cancellation leaves controls disabled until the active converter has completed its cleanup, preventing overlapping Word rendering. Ready outputs remain available afterwards. Batch validation accepts 1–20 documents, 100MiB each and 200MiB combined input/output, with a cooperative 180-second deadline per file. Each completed PDF is parsed and checked for pages before becoming ready. ZIP names preserve Unicode and cannot overwrite each other when duplicate names collide with generated suffixes. Workbook inspection is queued, and a bad workbook no longer disables conversion of the good ones. Document-derived errors stay in the masked workspace; conversion-failure analytics use constant messages.

## Reference and verification

Reviewed all eight screenshots in extraction group 24 (Word), all six in 25 (PowerPoint) and all six in 26 (Excel). These reference groups show multi-file upload, arranging, per-file rotation/removal, processing and result actions. Extraction groups are not verified original Docs tab IDs. No private reference file was uploaded.

- Seven engine tests verify failure in the middle of a batch, actual valid PDF output, sequential conversion, cleanup before retry, retained outputs, per-file setting invalidation, malformed/empty outputs, cooperative timeout, input/output bounds, Unicode/colliding ZIP names, and cancellation during packaging.
- Actual Word browser batch: valid DOCX, damaged DOCX, valid DOCX. Both valid two-page PDFs remained downloadable in a partial ZIP, with an explicit 2-of-3 notice. Independent parsing found two real image pages in each.
- Actual Excel browser batch: valid XLSX, damaged XLSX, valid XLSX. Both valid workbooks converted despite the inspection error. Changing one workbook's sheet selection reduced only its ready count. An empty sheet selection produced a local error and was corrected without starting over. A later real ZIP contained one Summary-only PDF and an unchanged two-sheet PDF. The unchanged PDF was byte-identical to its earlier download. Independent extraction confirmed correct sheet counts, cell values and the string 0012.
- Actual PowerPoint browser batch: valid PPTX, damaged PPTX, valid PPTX. Both two-page PDFs downloaded in the partial ZIP; independent parsing verified text and rotation: first document 90 degrees on both pages, second zero degrees.
- Word cancellation was exercised during page 19 of a 30-page conversion (60% overall progress), with two earlier results retained. No rendering iframe remained after cancellation. Retry showed File 1 of 1 and produced a real three-entry ZIP with 2, 30 and 2 pages; every long-document page retained the requested 90-degree rotation.
- Mobile Word at 390 × 844 CSS pixels had no horizontal overflow. The real Unicode-named PDF had two image pages, its Hindi title rendered correctly, and both 1000 × 1414 page previews loaded. The result reset scroll to the top and the download control was visible.

Synthetic fixtures, real downloads and inspected screenshots remain outside the published repository in local audit-2026-10-29/fixtures/office-batch and release33 evidence.

## Limits

This changes batch behavior, not Office format support. DOCX/PPTX/XLSX remain the accepted formats; legacy DOC/PPT/XLS were not added. Word pages remain image-based and not searchable. Unsupported complex Office objects still give errors; fonts and pagination can differ from the original editor. The timeout is cooperative and cannot interrupt every synchronous browser/library call immediately. No cloud account integration, paid-tier unlock, or claim of universal Office fidelity is made.

Final automated checks: 436 tests passed, type checking passed, production build passed, and all nine Merge/Split baseline files remain byte-identical. The final build introduced no new lint warnings; existing warnings remain in Compress PDF, Crop PDF and PDF to JPG.

The finished production build also downloaded a real two-page Word PDF. Independent PDFium parsing and visual inspection confirmed both page images and their text. Pixel comparison was not identical to the earlier browser run: glyph rasterization differed, with identical first-page ink bounds and a one-pixel bottom-bound difference on page two. No content or pagination difference was found.
