# PDF Editor rotated-page export — 29 October 2026

Annotation tools now work on cropped pages with native rotations of 0, 90, 180 and 270 degrees. Text, shapes, freehand strokes, images and notes retain their visible position and their own rotation. Links use transformed hit areas. Form widgets share the form engine's border-aware placement and rotate in 90-degree steps. The original page rotation and existing annotations remain intact.

New bookmarks append to the existing outline tree instead of replacing it; titles support Unicode. Unsupported link schemes, XFA forms, overflowing notes and invalid form geometry stop export with a useful error. Save supports cancellation. Page-preview cleanup captures the image before clearing the canvas.

Browser checks found and fixed two additional failures: a click-created field was only one pixel wide, and fetching an image data URI was blocked by the site's connection policy. Click/tap now creates a useful default field/shape, while dragging still sets dimensions. Images embed directly from their local data URI. Damaged image loading reports an error and a subsequent valid image works. Stale image loads cannot add objects to a replacement document.

The dropdown creation control is exposed in the existing toolbar. Its options editor preserves typed newlines and trims empty rows only when exporting. Property inputs have accessible labels.

Validation:
- Four new engine tests reopen exported files and compare rendered page pixels across all four native rotations (under 0.4% changed pixels). They cover text styling, links, rectangles, ellipses, lines, drawings, rotated images, notes, text fields and dropdowns; existing bookmarks and Unicode titles; unsafe links; cancellation, note overflow and XFA errors.
- The image regression test blocks data-URI fetching to match the browser's connection policy.
- Real browser download: a 90-degree page with rotated bold/underlined English/Hindi text and a link; a 180-degree page with a required text field; a 270-degree page with a Hindi note; a Hindi bookmark. Independent pypdf checks and PDFium rendering verified the saved output.
- At 390-pixel viewport width, a dropdown was created on a rotated page. Options were typed using Enter, and the downloaded PDF retained both options, usable field geometry and the original page rotation. Document width stayed at 390 pixels.
- Damaged image validation was observed, then a valid image and a click-created rectangle were rotated and downloaded. Independent rendering verified both.
- The full 256-test suite passed. After the browser image fix, the editor export/overlay regression suite passed again. Type checking, lint and the production build passed (three pre-existing warnings in crop/PDF-to-JPG).
- Browser loading of XFA forms displays the specific unsupported-form message and a replacement-file action.
- Merge/Split reference files and shared flow components remain byte-for-byte unchanged.

Limits: this is not secure redaction or certificate signing. Existing complex-text edits may rasterize the affected page, as disclosed by the editor. Full script/reader compatibility is not claimed. The existing Hindi pre-base vowel extraction limitation is recorded in the forms QA note. No complete competitor feature-parity claim is made.
