# PDF Metadata Editor — 30 October 2026

Implements the supplied metadata reference's editable creation/modification dates while preserving PDFPilot's upload → preview/options → process → automatic/repeat download flow. Adds synchronized PDF Info/XMP updates, date removal, custom-property inspection, verified saved values and Continue editing.

The previous route called a generic PDF loader with pdf-lib's metadata-update default. Merely opening a document could replace its producer/modification date in the editor's loaded state. The new engine always loads with `updateMetadata: false` and never regenerates form appearances when saving.

## Behavior

- Six text fields plus UTC creation/modification date inputs; blank values remove the corresponding properties. Restore loaded values and Modified: now are explicit controls.
- Info and document XMP fields are synchronized. Unrelated custom Info/XMP and archival properties are retained; nested custom structures are not searched/replaced as document fields. XMP-only documents supply missing Info values. Conflicting values are explained before saving.
- Remove document metadata clears Info (including custom fields/dates) and metadata streams. Orphaned metadata objects are discarded, while references shared outside metadata remain intact. Visible content, forms, comments, attachments, document identifiers and embedded image details are not anonymized or scrubbed.
- Unreadable XMP has a recovery option to remove it while saving Info changes. Digital-signature/certification guards refuse changes. Cancellation prevents stale output. Inputs are limited to 100MB; metadata fields to 8,000 characters; decoded document XMP to 2MB; external XML declarations are rejected.

## Validation

- Nine new tests cover original dates, XMP-only metadata, multilingual fields, escaping, exact UTC dates, blank fields, unrelated/nested XMP preservation, orphan removal and shared-object safety, unchanged page streams/forms, bad XML/input/dates, signatures and in-flight cancellation followed by a clean retry.
- Real browser download: Hindi/Arabic title/author/keywords and explicit creation/modification dates independently reopened with pypdf. XMP parsed independently with lxml. All four pages at native 0/90/180/270 rotations rendered with PDFium and compared pixel-for-pixel with the original; every image matched and the existing form value was retained.
- Real browser removal download independently reopened with no Info or document XMP; all four rendered pages and form value remained intact.
- Invalid XMP produced an actionable error, then saved after the explicit removal option. A certification fixture had both save/remove buttons disabled. A damaged PDF produced a persistent landing error and a valid replacement recovered.
- At a verified 390px viewport, cleared dates saved as absent dates in the downloaded PDF, with no horizontal overflow. Browser-native date input events were fixed after the first downloaded file exposed uncommitted date changes; final output was re-downloaded and checked.
- The nine protected Merge/Split files remain unchanged. Lint has only the existing Crop PDF/PDF to JPG warnings. All 318 automated tests and the production build (including type checking) pass.

This is document metadata editing/removal, not secure content redaction or a guarantee that every private value is removed from arbitrary PDFs. Tests use synthetic documents. Responsive viewport validation is not physical mobile/Safari certification.

Production: PR #20 merged at `cf70bf9e923303866184d093c4f6f81a8d8fdd8a`. Live-site download independently verified the multilingual title, requested UTC creation date, preserved 2011 modification date, four pages, readable XMP and unchanged form value.
