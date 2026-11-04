# Editing a line of an existing paragraph

Edit PDF and the PDF Forms text editor can replace or delete a separately positioned line inside a multi-line PDF text object. Unedited native text stays selectable. The editor matches the selected text to its original page coordinates and preserves the line advance and spacing used by subsequent lines.

The regression fixtures cover repeated lines in the same paragraph, accented letters, euro prices, four page rotations, cropped pages, interactive form fields and an untouched second page. A second fixture embeds a Noto font, Cyrillic and French text in one paragraph. Its tests save two successive edits and reopen both exports to check text selection, positions and the untouched page.

The native path supports ordinary WinAnsi text and horizontal two-byte composite fonts with a supported embedded Unicode map. Tests cover character ranges, array mappings, ligatures and supplementary Unicode characters. Missing or inherited maps, vertical encodings, linked text advances, invisible OCR and alternate-text spans use the existing page-rendering fallback. That fallback can turn other text on the edited page into an image. Replacement fonts and spacing can differ from the original.

Chrome opened the embedded-font fixture in the production build. Saving the middle line as `Paid €250` downloaded a 285,945-byte PDF. PDFium recovered the replacement and both surrounding lines. The edited line occupied the original row, the old price was absent, and the second page rendered identically at 1.5×. When extracting the entire page, this reader listed the newly drawn replacement after the two original lines. All 467 tests passed, the build generated 588 pages, and the nine Merge/Split reference files matched their baseline.
