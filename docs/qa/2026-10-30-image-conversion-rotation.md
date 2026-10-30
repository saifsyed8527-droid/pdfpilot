# Image conversion and rotation — 30 October 2026

Convert Image and Rotate/Flip Image retain the existing upload, workspace, processing and automatic-download flow. Reference contact sheets 53, 59 and 61 informed batch conversion, static/animated GIF and rotation by orientation. These numbers identify extracted groups, not verified Google Docs tabs.

## Implemented

- Convert multiple images to PNG/JPG/WEBP or static GIF. Combine images into one animated GIF, reorder frames, set dimensions, fit/crop/stretch, solid background, frame duration and repeat count.
- GIF encoding runs in a terminable worker. Cancel stops the worker; late results cannot replace a newer operation. The encoder is the official gifenc 1.0.3 npm build, vendored with its MIT license and verified archive integrity. It does not fetch remote scripts. The minified third-party build alone is excluded from application lint; new application/worker code remains linted.
- Rotate left/right and flip individual, all, portrait or landscape images. Each image has independent transformations and a rendered preview. Orientation filters use original dimensions. Flips happen on source axes before rotation.
- PNG/JPG/WEBP outputs, quality controls, batch ZIP, collision-safe names, stable source files, persistent invalid-input errors, recovery and adjustable results. Fixed white JPG background rendering after a transformed canvas operation.

## Output verification

- Five new focused tests plus the existing suite: 292 passed. Decoded GIF tests check both frames, exact colors, duration, loop metadata, static output and byte-offset handling. Rotation tests check four angles, horizontal/vertical flips, preview dimensions, white JPEG pixels and cancellation. GIF fit and bounds are also checked.
- Browser: an animated GIF with two differently shaped images was reordered, exported and independently decoded. Both frames were 400×200, each lasted 300ms, and the loop value was 2. Sampled pixels confirmed the selected order and white contain-fit margins.
- Browser: invalid GIF width showed an explicit error. Correcting the dimensions produced a ZIP containing two uniquely named, independently decoded 200×100 single-frame GIFs with no loop extension.
- Browser: cancelled an active 12-frame 1800×1500 job, immediately retried at 300×250, then independently decoded all 12 frames at the newer dimensions. A prior uncancelled large job also completed; it is not counted as cancellation evidence.
- Browser at 390×844: portrait-only rotation affected the portrait image; a selected transparent image received a separate rotation and horizontal flip. The ZIP contained three JPEGs at their expected dimensions. Sampled pixels confirmed the transformed red quadrant and white formerly-transparent area. No horizontal overflow; result scrolled to the top.
- Browser: a malformed input showed a persistent error. Selecting a valid PNG then produced a 100×200 static GIF. Its portrait preview measured 324×648, matching the output ratio. The downloaded file's frame count and white background were independently checked.
- All nine protected Merge/Split reference-file hashes match the baseline. Type checking and the production build passed. Lint passed with the same three pre-existing warnings.

## Scope

Up to 30 images and 200MB combined input/output, 40 megapixels per source. GIF output: 2,048px per side, four megapixels per frame and 40 megapixels across an animation. GIF is limited to 256 colors per frame and uses the chosen opaque background. Source GIFs contribute their first frame. SVG/TIFF/PSD/RAW input and preservation of existing animation are not supported here; HEIC has separate converters. Re-encoding removes metadata. These checks do not establish zero defects or complete competitor parity.
