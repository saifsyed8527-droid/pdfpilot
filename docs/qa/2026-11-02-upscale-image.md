# Image upscaling — implementation and output verification

## Shipped scope

Adds `/upscale-image` as public tool 108. The previous 107 registry entries are unchanged. The tool uses the shared upload → preview/options → process → auto/repeat-download flow. All nine protected Merge/Split baseline files remain byte-for-byte unchanged.

- 2× AI enlargement and 4× through two learned 2× passes; original proportions; before/after slider; Original/Enlarged views; contained 200%/300% zoom; original/output dimensions.
- Up to ten local PNG/JPG/WEBP/BMP/GIF-first-frame inputs; 100MB per file, 200MB input/results batch; output at most 16MP and 8192px per side. These are enforced limits, not a maximum-size performance certification.
- Transparent PNG/WEBP and white-background JPG; 10–100% lossy-format quality; individual downloads and collision-safe batch ZIP; full-size free output with no watermark or account.
- Same-origin worker with verified model hashes; automatic GPU selection with CPU fallback, explicit compatibility option, real worker termination on cancellation, retained completed images, retry only unfinished images, explicit download-completed action.
- Corrected loading progress on image selection in Upscale and Remove Background: a previous export's 100% no longer carries into new file loading.

Model/runtime provenance, licenses, transformation details and hashes are in `public/image-upscale/README.md`, the model manifest and runtime integrity manifest. Shared node_modules and dependency manifests are unchanged. The page CSP stays unchanged; WASM is allowed only on the new inference worker. Versioned models/runtimes have immutable caching. Existing pSEO capability evidence hashes were refreshed solely for this scoped worker header; approved claims and the 26-tool/18-page pSEO scope remain unchanged.

## Verification performed

- Full suite: 352 tests passed; final focused rerun: 21 tests passed after the GPU correction and loading-progress fix. Eight new focused cases cover tile placement across odd dimensions and both passes, reflected one-pixel boundaries, alpha/matte reconstruction, malformed inference output, enforced size limits, worker cancellation/retention/retry, real output format encoding and bundled asset hashes.
- Production build, TypeScript and lint passed; three pre-existing lint warnings remain in Crop PDF/PDF to JPG. Local HTTP checks confirmed new route, same-origin worker policy, immutable model cache and Hindi fallback to the working English route.
- Actual browser file selection: invalid PNG → actionable error; 4097×1 image → output-side limit error; subsequent valid PNG processed without reload. A 1025×1025 input was accepted for 2×, rejected before processing at 4×, then recovered to 2× with the error cleared.
- Actual GPU downloads: 128×128 public NASA astronaut fixture → 256×256 and 512×512 RGBA PNG. Each downloaded image was compared with an independently executed native ONNX reference using the pinned original model and separately constructed tile batches. At 2× only 8 RGB channel values differed by 1/255; at 4× only 212 differed by 1/255. Maximum difference was 1/255 in both. Outputs were visibly inspected alongside ordinary bicubic resizing.
- A captured-buffer experiment initially repeated the first tile. It was rejected before release. Fresh per-tile tensors/readback fixed the defect; the independent pixel comparisons above verify the final worker. No captured GPU buffers are shipped.
- Actual CPU compatibility processing: a transparent/translucent 103×99 fixture → 412×396 PNG. Every alpha value exactly matched two independent bilinear enlargement passes; 102,652 pixels were fully transparent and 41,272 fully opaque. The central translucent pixel was [229,60,40,128], and the background remained [0,0,0,0]. A mixed PNG ZIP retained the previously completed astronaut PNG byte-for-byte.
- At 390×844 viewport, page width remained 390px, and mobile JPG batch export decoded as real RGB JPEGs at 512×512 and 412×396; transparent source background became [255,255,255]. Quality was also adjusted using the native keyboard, with the displayed state updating to 100%.
- Six-image batch: cancelling the unfinished 256×256 input preserved five ready 4× images. Retry visibly processed only the remaining image. The downloaded ZIP contained six real WEBPs, including the 1024×1024 result. Three duplicate astronaut inputs produced pixel-identical WEBPs to the earlier result; transparent WEBP retained the PNG alpha plane exactly.
- Native keyboard adjustment moved the before/after slider to 49% and the actual image clipping to 51%; zoom at 200% stayed inside its scrollable preview, with page/viewport widths both 1280px. Temporary mobile viewport was reset.

Local proof artifacts (outside the public repository): `release22-upscale-workspace.png`, `release22-upscale-mobile.png`, `release22-upscale-cancelled.png`; decoded outputs and comparison reports in `audit-2026-10-29/fixtures/upscale/`.

## Limits

AI estimates detail and can alter text, faces and fine patterns; it cannot recover factual detail absent from the input. Review before sharing. 4× is two passes of a 2× model, not a separately trained 4× network. Reflected overlapping tiles bound working memory, but challenging textures may show seams. Large images can take minutes, especially on CPU; maximum-size, low-memory and all-browser testing is not claimed. GIF animation is not retained; SVG/HEIC are not accepted by this tool. Browser encoding can change metadata/color profiles. GPU availability and speed depend on the user's browser/device. The existing broader project feature work is still in progress; this release does not claim all-reference parity or zero defects.

## Production verification

PR #25 merged as `0417ff684232567ee4471ad953805e5e7648ae76`; Vercel production deployment `9zVxoupmBJ5nRgiNLZVV4hDnNahW` succeeded. The live `/upscale-image` page accepted the public 128×128 NASA fixture and automatically downloaded a valid 256×256 PNG. Independent decoding against the original model's native tiled reference found only eight channel values differing by one level (mean absolute difference 0.0000406901). Local proof: `release22-upscale-live.png`; downloaded evidence: `fixtures/upscale/production-2x.png` in the private QA workspace.
