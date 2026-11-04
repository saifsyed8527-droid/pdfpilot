# Editing a line of an existing paragraph

Edit PDF and the PDF Forms text editor can replace or delete a separately positioned line inside a multi-line PDF text object. Unedited native text stays selectable. The editor matches the selected text to its original page coordinates and preserves the line advance and spacing used by subsequent lines.

The regression fixtures cover repeated lines in the same paragraph, accented letters, euro prices, four page rotations, cropped pages, interactive form fields and an untouched second page. A second fixture embeds a Noto font, Cyrillic and French text in one paragraph. Its tests save two successive edits and reopen both exports to check text selection, positions and the untouched page.

The native path supports ordinary WinAnsi text and horizontal two-byte composite fonts with a supported embedded Unicode map. Tests cover character ranges, array mappings, ligatures and supplementary Unicode characters. Missing or inherited maps, vertical encodings, linked text advances, invisible OCR and alternate-text spans use the existing page-rendering fallback. That fallback can turn other text on the edited page into an image. Replacement fonts and spacing can differ from the original.

Chrome opened the embedded-font fixture in the production build. Saving the middle line as `Paid €250` downloaded a 285,945-byte PDF. PDFium recovered the replacement and both surrounding lines. The edited line occupied the original row, the old price was absent, and the second page rendered identically at 1.5×. When extracting the entire page, this reader listed the newly drawn replacement after the two original lines. All 467 tests passed, the build generated 588 pages, and the nine Merge/Split reference files matched their baseline.

The published editor also saved the middle line as `Paid €375`. Its download had SHA-256 `0c17d5d8ec456e541978d44a6ede24783d4fa8a601cf54adedb421672811ebaf`. Reopening that PDF in PDFium reproduced the whole-page reading order issue.

## Original fonts and reading order

A plain replacement that fits its original line can now use the original font and position in the page stream. This works with supported WinAnsi standard fonts, one-byte embedded fonts with Unicode mappings and horizontal two-byte fonts. Edits requiring shaping, a missing or ambiguous character, additional space, wrapping, styling or a new position use the existing replacement writer. That writer can use another font and can change whole-page extraction order.

The checked-in fixture `tests/fixtures/editor-writer-receipt.pdf` was exported independently by LibreOffice Writer from a synthetic two-page DOCX. It uses an embedded Liberation Sans subset, glyph codes different from Unicode, kerning adjustments and a PDF structure tree. Changing the middle row to `€250` preserved its original font, marked-content ID, line positions and structure tree. PDF.js and PDFium read the heading, price and remaining sentence in the original order. A separate two-byte font fixture also matched a reference rendering drawn with the original font, pixel for pixel.

## Printable form marks

The Edit PDF toolbar can insert a check mark, a cross or an editable date. Sign PDF shares the two vector marks and its existing date button. Section 65 of the supplied reference shows this workflow on paper-style forms. Mark labels are localized for the site's 12 interface languages. Both strokes of a cross remain independent when rendered, and the marks use the normal selection, positioning, duplication and undo controls. Pixel tests cover their printed form on four page rotations and distinguish them from interactive form fields.

Chrome opened the real Writer PDF on the Hindi editor page. The middle amount was changed to `€250` on page one. A check, a cross and a date were inserted and moved independently on page two. The download was 15,502 bytes. All three text runs on the first page used the original Liberation Sans font, in the original order, and the page matched the independent render at 1.5×. The second page contained the printed marks and the selectable date. All 471 tests passed and the build generated 588 pages.
