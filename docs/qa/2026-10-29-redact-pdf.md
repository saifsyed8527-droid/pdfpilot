# Redact PDF — 29 October 2026

Adds the reference's redaction workflow as a free, local tool in the existing upload → preview/options → process → automatic/repeat download flow. The original 99 tools remain public; the catalog now has 100 tools. Redact PDF is included in PDF security navigation and homepage/search listings.

Users can draw, move, resize and remove areas; use keyboard nudges/Delete or numeric geometry; undo/redo; repeat an area on current, all, odd, even or specified pages; and mark whole pages. Search supports literal text, email, phone and Luhn-valid card candidates. Search includes filled AcroForm text/choice values and marks entire matching text blocks/widgets. Black/white fill and 150/300 DPI are available.

The exporter creates a new PDF from opaque, masked RGB pixels. No source PDF objects are copied. Source text layers, forms, links, attachments, metadata and incremental history are omitted. The visible crop, rotation and physical dimensions are preserved in the new page images. A stable in-memory source snapshot keeps preview and export consistent if the file on disk changes. Cancellation stops the active renderer and prevents a stale result.

Validation:
- Six engine tests cover literal/pattern search, separate text objects, form values, four native rotations with cropped pages, black/white marks, 300 DPI, all page selectors, invalid geometry, malformed input, large-page limits, cancellation and retry.
- Exported PDFs are reopened and rendered; every PDF object and decompressed stream is checked for source secret strings. Original catalog attachments, forms, metadata, outlines and actions are absent; pages contain no selectable text or annotations.
- Browser download with 17 marks across four pages: text, form value, email, phone and card results. Independently reopened with pypdf and rendered with PDFium. Selected content is covered, unmarked public content remains visible, and no original text layer, form, attachment or source metadata survives.
- Undo/redo, numeric area edits, even-page repetition, pointer drawing/resizing, keyboard nudging/removal and invalid range recovery were exercised in the browser.
- At 390-pixel width, pages 2 and 4 were fully redacted white at 300 DPI. The actual download has entirely white pixels on those pages while pages 1 and 3 remain visible; document width stays at 390 pixels.
- A malformed PDF shows readable recovery guidance and disables processing. Replacing it with an 80-page PDF works. Cancelling its active 300-DPI export returns to the editable workspace without a result; replacement and area editing work afterward.
- Protected Merge/Split reference files and shared flow components remain byte-for-byte unchanged.
- All 262 automated tests, type checking and the production build pass. Lint passes with the three existing crop/PDF-to-JPG warnings and no new warnings.
- Production browser verification after deployment found all five text/form-value matches and downloaded a four-page redacted PDF. Independent pypdf/PDFium checks confirmed the source secret strings, text layers, forms, metadata and attachments were absent.

Limits: all output pages are flattened, including unmarked pages; searchable text, interactive forms and links are deliberately lost. Search does not perform OCR on scanned pages. Candidate detection is not a guarantee of finding all sensitive data; the UI asks users to review marks and add missing areas. Pure XFA and password-protected PDFs require conversion/unlocking first. The browser imposes page-pixel and output-size limits. No universal security certification or complete competitor-parity claim is made.
