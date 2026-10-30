# Local MediaPipe face detector

Runtime: Google's `@mediapipe/tasks-vision` 0.10.21, official npm archive. Its SHA-512 integrity was verified against registry metadata before extracting the CommonJS bundle and SIMD/non-SIMD WASM files. `vision_bundle.cjs` is renamed to `vision_bundle.js` for a JavaScript MIME type; its bytes are unchanged. A classic worker exposes a local `exports` object for this self-contained CommonJS bundle (no Node dependencies).

Model: official BlazeFace short-range float16 TFLite model downloaded on 30 October 2026. The exact model/runtime SHA-256 hashes and upstream URLs are in `provenance.json`. Apache-2.0 license is included. Model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/index and model card https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf .

All runtime, model and worker requests are same-origin. Worker CSP permits same-origin scripts, model fetches and WASM compilation, with no JavaScript eval or external connections. No image upload, face identification, embeddings or external telemetry endpoint is used. Detection is an editable suggestion and can miss small, occluded or turned faces; users can manually add/remove coverage and must review before export.

Upstream source-map comments are retained. Development source maps are not shipped. These vendored files are not edited by application code.

The short-range model is compatible with this runtime. More suggestions also scans nine overlapping image tiles to help find smaller faces. The full-range model was rejected during pre-release browser validation because its anchor count does not match this runtime; it is not shipped.
