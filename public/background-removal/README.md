# Local background removal assets

Images are decoded and processed in a same-origin, single-threaded Web Worker.
Only runtime/model downloads use the network. No image data is uploaded.
Model assets load on demand, are versioned and cacheable, and every model part
is SHA-256 verified before inference. Cancelling terminates the worker, model
download and inference; a batch reuses one model session.

## Models

- **Fast:** U2NetP, 4,574,861 bytes, Apache-2.0, unchanged official rembg ONNX
  export from <https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx>.
  Upstream: <https://github.com/xuebinqin/U-2-Net>. Verified rembg MD5
  `8e83ca70e441ab06c318d82300c84806` and the SHA-256 in `u2netp-v1/manifest.json`.
- **Detailed:** full U2Net, 175,997,641 bytes, Apache-2.0, unchanged official
  rembg ONNX export from <https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx>.
  Verified rembg MD5 `60024c5c889badc19c04ad937298a77b` and the SHA-256 in
  `u2net-v1/manifest.json`. Split into three binary parts below 64MiB; concatenate
  in manifest order to reproduce the original model exactly. No weights changed.
- The upstream model license and rembg MIT license are included in each directory.
  The reference preprocessing/normalization is documented in
  <https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net.py> and its
  `base.py` normalizer: 320×320, normalized by the image's largest RGB sample,
  ImageNet mean/std, first output, min/max alpha normalization. Browser canvas
  resampling can differ slightly from the Python reference's Lanczos resampler.

## Runtime

ONNX Runtime Web **1.22.0**, Microsoft MIT license, unchanged WASM-only artifacts
from <https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.22.0.tgz>.
Tarball SHA-512 integrity:
`sha512-Ud/+EBo6mhuaQWt/OjaOk0iNWjXqJoeeMFr6xQEERZdIZH2OWpGzuujz7lfuOBjUa6TEE/sc4nb7Da5dNL34fg==`.
The MIT license and ThirdPartyNotices from the official `v1.22.0` tag are included.
`integrity.json` records the exact shipped runtime files; source maps, GPU and
other unused runtimes are omitted. Models work without WebGPU or cross-origin
isolation. WASM permission is scoped to this worker's response CSP.

## Limits

Ten input images, 100MB each, 200MB combined, 20MP/16,384px per side. Inference is
sequential and stops after 180 seconds per image. Masks are restored to the
original dimensions; preview rendering is bounded to 1,000px. Original source
transparency is preserved. Up to 200 erase/restore strokes and 20,000 points per
image, 30 undo steps, 0–4px edge softness, PNG/WEBP/JPG and cancellable batch ZIP.
These are foreground segmentation models, not perfect matting: hair, glass,
multiple subjects and busy backgrounds may need the manual brushes. A larger
model is not guaranteed to improve every image. No account, paid API, watermark
or lower-resolution-only download is required.
