# Image resize, crop and watermark — 30 October 2026

These three tools retain the shared upload, preview/options, processing and automatic-download flow. The nine protected Merge/Split reference files remain unchanged. Reference contact sheets for image resize, crop and watermark (extraction groups 51, 52 and 62) informed these controls; extraction groups are not verified Google Docs tab identifiers.

## Implemented

- Resize: pixel dimensions or a percentage, aspect ratio, fit-within dimensions, no enlargement, batch previews and unique output names.
- Crop: draggable selection and corner handles, arrow-key positioning, exact pixel coordinates, square/4:3/16:9 presets and full-image reset. Out-of-bounds regions fail explicitly.
- Watermark: up to ten text/logo layers, selection, delete/undo, dragging and numeric positioning, nine position shortcuts, font styles, text/background colors, transparency, rotation and tiling. Preview handles follow the visible clamped position. Logo loading disables export and preserves intervening text changes.
- PNG/JPG/WEBP outputs, quality controls, white JPG backgrounds for transparent images, single-image preview/download and batch ZIP download. Failed source uploads keep a persistent error on the landing page. Invalid logos can be replaced without losing existing layers.
- Image bounds, batch limits, cancellable processing, stale-result suppression and canvas cleanup.

## Verification

- Six focused engine tests exercise actual encoded/decoded images: dimensions, aspect fitting, no-enlargement, crop pixels, output MIME/extension, PNG alpha, JPG white background, text/logo layers, rotation/opacity, preview scaling, invalid inputs and cancellation during decode followed by recovery. Full regression suite: 287 passed, zero failures.
- Browser: two same-named source files resized to 50% WEBP; ZIP entries had unique names and decoded to 200×100 and 100×200. No-enlargement preserved their original 400×200 and 200×400 dimensions.
- Browser: crop corner dragging and keyboard positioning changed the pixel region. An invalid region showed an error; correcting it downloaded a 200×100 image whose sampled pixels matched the selected blue quadrant.
- Browser: Hindi text and a transparent logo, separate rotations, opacity, background, deletion/undo and dragging were exported to two WEBP images. Both downloaded files were decoded and visually inspected independently.
- Browser: cancelled a 12-image enlargement, immediately retried at 25%, and decoded all 12 outputs at 300×250. The cancelled operation did not replace the newer result.
- Browser: malformed source image and malformed logo showed errors, then valid replacements produced a downloadable 400×200 PNG.
- At 390×844 the watermark workspace and result had no horizontal overflow. Result returned to the top of the page. A tiled watermark on transparent PNG retained alpha values from 0 to 255 in the downloaded file.
- Type checking and the production build passed. Lint passed with the same three existing warnings (Crop PDF effect cleanup and two local preview image warnings). All nine reference-file hashes match their baseline.
- Production verification: PR #15 and the production deployment succeeded. `/image-watermark` downloaded a 400×200 PNG with Hindi text, independent text/logo rotations and retained transparency. The file reopened and was visually inspected independently; its alpha channel still spans 0–255.

## Scope

Up to 30 source images, 200MB combined input/output and 40 megapixels per source; each side is limited to 16,384 pixels. Logos are limited to 5MB and five megapixels. GIF uses its first frame; GIF/BMP outputs become PNG. Re-encoding removes metadata. SVG and animation preservation are not supported. Text uses available browser fonts. These checks do not establish zero defects or complete competitor parity.
