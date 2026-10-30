# Photo Editor — 30 October 2026

## Change

Adds Photo Editor as the 103rd public tool using the existing upload → workspace → processing → automatic/repeat download flow. Merge/Split and their shared chrome, processing and result components retain all nine baseline hashes. Local reference review covered image groups 54 (16 placements) and 58 (13 placements); this is not a claim of complete reference parity.

Includes pixel/percentage sizing with aspect ratio, crop selection and coordinates, quarter-turn rotation/flips, brightness/contrast/saturation and eight filters; editable text, shapes, 24 emoji stickers, overlay images and separate drawing/highlighter layers; move/resize/rotate, hide/lock/order/duplicate/delete, 30-step undo/redo, preview zoom, background, frames and rounded corners. PNG/JPG/WEBP outputs render the layers into a new image. Precise hex color fields accompany native color pickers.

## Automated validation

- 299 tests passed, including seven decoded-image Photo Editor tests for crop/rotation/filter pixels, layer ordering/hidden/opacity, separate strokes and rotated image layers, transparent corners/JPG white fill/frames, styled text, sticker visibility, invalid settings and cancellation/retry.
- Production build and type checking passed. Lint passed with three previously recorded warnings in Crop PDF and PDF to JPG.
- All nine protected Merge/Split flow file hashes match the recorded baseline.

## Browser/output validation

At 1280×720: selected a 400×200 quadrant image; rejected a crop outside the source, recovered to the blue 200×100 region; rotated, resized to 200×400, applied grayscale, rounded corners and a double frame. Added underlined white Hindi/English text, an orange arrow, a heart sticker, a rotated green image layer and two separate red drawing strokes. Exercised duplicate/delete/undo/redo, lock/unlock, native layer dragging and corner resizing. Malformed image overlay failed clearly and a valid overlay recovered without discarding existing layers.

Downloaded `source-edited.png`, independently decoded at 200×400 RGBA. Transparent corner alpha is zero; untouched crop pixels are grayscale (18,18,18); the gap between the two red strokes remains untouched. Preview and exported composition were visually compared. Sticker visibility and an initial empty image-source warning found during browser testing were fixed before release.

At 390×844: no horizontal overflow; precise cyan brush color and 35% highlighter added with native drawing, then WEBP exported at 200×400 with transparency and all seven layers. Result scrolled to the top and retained Adjust edits/Start over controls.

Damaged source image displayed a persistent decoding error. A valid 5000×4000 source recovered. Cancelled an observed, active vintage-filter export; immediately reduced to 25% and retried successfully, independently decoding the resulting 1250×1000 JPEG. PNG/WEBP/JPEG browser exports all decoded successfully.

## Scope

Source/output limited to 20 megapixels, 100MB source file; up to 60 layers, overlays 5MB/five megapixels, 4,000 points per stroke and 20,000 total. Crop and rotation affect the base photo while layers retain relative output positions, as stated in the UI. Downloads are flattened; keeping the page open preserves editable layers. Fonts/emoji follow the browser/OS. GIF imports use their first frame. No animation preservation, persistent project format, remote assets, AI removal/upscaling or arbitrary sticker library is claimed. No sensitive reference screenshots were used as fixtures.

Production verification: PR #17 merged as `575f531aa8c645f5951d384b53b285b797c8ac23`; Vercel deployment succeeded. The public Photo Editor accepted a synthetic transparent PNG, added Hindi/English text, a star sticker and a native drawing stroke, then downloaded `transparent-edited.png`. Independent decoding confirmed 400×200 RGBA with transparent untouched pixels. The result screenshot is retained in the local release evidence.
