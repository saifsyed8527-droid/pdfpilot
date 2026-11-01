# Remove Background — 1 November 2026

Adds the 107th public tool at `/remove-background`, using the existing landing,
workspace, options, processing and auto/repeat-download flow. The original 99
remain public; all nine protected Merge/Split source hashes match the baseline.
Reference image group 56 (all seven screenshots) was reviewed for multi-image
selection, before/after comparison and transparent downloads. This is a bounded
implementation/verification record, not a claim of complete reference parity.

## Implemented

- Real on-device foreground segmentation: U2NetP Fast and full U2Net Detailed,
  unmodified official rembg exports with upstream MD5 and per-part SHA-256
  verification. Same-origin ONNX Runtime Web 1.22.0, one CPU thread in a
  terminable worker. No uploaded images, external inference, paid keys or account.
- Before/after slider, original/cutout views, fit/150%/200% zoom, erase/restore
  brushes with round separate strokes, 30-step undo/redo and reset. Original
  transparency remains transparent even under Restore. Color background and
  0–4px edge softness. Full-size PNG/WEBP/JPG, first GIF frame, individual results
  and cancellable ZIP. No watermark or resolution paywall.
- Up to 10 files, 100MB each/200MB combined, 20MP and 16,384px per side. Model
  processing is sequential, bounded to 180 seconds per image, and retains
  completed masks if cancelled or a later item fails. Retry processes only
  unfinished items. Reprocess explicitly replaces the selected mask/brush edits.
- Versioned local assets and license/provenance notices. The large model is split
  into three parts below 64MiB; reconstructed bytes equal the official model.
  No shared `node_modules` changes or new package dependency.

## Verification

- Full suite: **344/344 tests pass**. Production build passes, including TypeScript
  and lint; three pre-existing lint warnings remain. Ten new tests decode pixels
  for alpha/RGB, masks, separate erase/restore strokes, preview geometry, solid
  color/JPG white/WEBP transparency, edge softness, rejection, cancellation,
  completed-result retention, worker failure and duplicate-name ZIP fidelity.
  Both model manifests/chunks pass checksum tests.
- Public NASA/scikit-image astronaut fixture: real Fast and Detailed inference
  and downloaded 512×512 PNGs in the local production build. Detailed completed
  in about 4.8 seconds in the isolated local benchmark on this laptop; performance
  is device/network dependent. Visual inspection confirmed the subject/helmet
  retained and background removed. Detailed removed remnants left by Fast.
- Native pointer erase stroke: actual PNG changed 5,038 pixels within
  `[148,285]–[311,316]`; an opaque orange pixel became transparent, while pixels
  above the stroke remained exact. Undo download matches the original detailed
  cutout at every decoded pixel. Redo then Restore repainted 797 alpha pixels;
  the restored center equals its source RGB/alpha while the unpainted stroke
  remains erased. Saved outputs, not just preview state, were inspected.
- Invalid `.png` rejects with a decoding message; a 5000×4200 image rejects at
  the 20MP limit; the next valid upload succeeds without reloading.
- Actual **390×844** viewport: no document horizontal overflow; colored JPG with
  0.5px softness downloads at 512×512. Decoded background `(33,201,176)` matches
  selected `#20c9b0` within JPEG rounding. Mobile result screenshot saved.
- Seven-image batch: one existing Fast result plus six pending Detailed inputs.
  Cancel left **2/7** cutouts ready (the earlier Fast result plus one completed
  Detailed result). Retrying in Fast mode completed only the other five and
  automatically saved a ZIP. All seven entries decode as 512×512 WEBP; each
  alpha plane exactly matches the corresponding previously verified Fast or
  Detailed PNG, confirming retained results were not overwritten on retry.
- Default viewport restored after mobile checking. Test images are public or
  synthetic fixtures; identity-document images from the user's reference were
  not uploaded or used for inference tests.

Local evidence is in the task workspace's `audit-2026-10-29/fixtures/background/`
and `release21-background-{workspace,mobile,cancelled}.png`, outside the public
repository. The earlier HTML-to-Image release's production download verification
is also recorded in its QA note in this change.

## Compatibility and limits

The config diff only replaces obsolete, unused background-removal isolation
headers with the dedicated worker's WASM policy and immutable asset caching.
Global page policy and PDF.js/Tesseract worker policies remain unchanged; their
actual responses were checked. The three capabilities that fingerprint this
shared config and two existing PDF-to-Word review fingerprints were refreshed
after this scoped compatibility check. No capability claims, page copy or pSEO
scope changed (26 approved tools/18 reviewed pages).

Foreground segmentation cannot guarantee perfect hair/glass/multiple-subject
boundaries. The page offers brush correction and tells users to review edges.
Detailed uses a 176MB model and more time/memory; Fast uses 4.6MB. Downloads are
cached after first use where the browser permits it. No claim of all-device
performance, perfect matting, universal image support or zero bugs is made.
