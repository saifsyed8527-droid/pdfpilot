# Editor and PDF image export verification — 29 October 2026

The existing Merge/Split flow remains the baseline. Their source and shared chrome were not changed.

## PDF Editor

`tests/editor-export.test.cjs` creates real PDFs and independently renders and extracts the exported output with PDF.js. It verifies native replacement and deletion, style-only edits, unchanged selections, atomic rejection of complex native streams, rendered-page fallback, preserved form widgets and links, unchanged other pages, rotations 0/90/180/270, offset CropBoxes, screen-coordinate nudges, independent copies, Hindi output and explicit unsupported-glyph errors.

Browser checks on macOS additionally covered upload, typing, bold/italic, delete, undo/redo, English OCR on a scanned page, save, automatic download and repeated file changes. Downloaded PDFs were parsed independently; scanned output was rendered and visually inspected. The 390px mobile viewport retained a 390px document width, fit the page initially, accepted an edit and downloaded the PDF. This is responsive-layout evidence, not a physical iPhone or Android test.

Replacement fonts may differ. Independently addressable standard-font text is removed from its page stream. Scanned or complex page content is rendered before replacing text; other page text then becomes an image while replacements stay selectable. Form widgets and links are retained. This is text editing, not certified redaction or a promise that all historical bytes are purged. English is the bundled OCR language; fonts without a supported replacement glyph produce a recoverable error.

## PDF to JPG/PNG

Browser checks covered two synthetic PDFs containing five pages, ascending and descending filename sort, manual movement, PNG at 150 DPI, automatic ZIP download and related tools. Every archive entry decoded successfully. Entry order matched the selected file order: Beta pages 1–3, then Alpha pages 1–2. Existing image-engine regression tests retain 150/300 DPI, extraction and output validation coverage.

## Homepage

The compact homepage retained 99 tools, category filtering, search and links. At a 390px viewport the Image tools filter showed 10 tools without document overflow.

These checks do not establish complete competitor feature parity or absence of every bug.
