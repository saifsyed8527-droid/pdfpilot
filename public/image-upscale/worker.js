/* Local Swin2SR inference. Images are never sent to a server. */
import { TILE, outputDimensions, upscalePixels } from './pixels.mjs';
const ROOT = '/image-upscale', MODEL = ROOT + '/swin2sr-92a21aca-v1';
let session, ort, backend;
const report = (message, progress) => self.postMessage({ type: 'progress', message, progress });
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
async function loadModel(mode) {
  const manifestResponse = await fetch(MODEL + '/manifest.json');
  if (!manifestResponse.ok) throw new Error('The upscaling model could not be loaded. Check your connection and retry.');
  const manifest = await manifestResponse.json(), entry = manifest.models?.[mode];
  if (!entry || entry.file !== `model-${mode}.onnx` || !Number.isInteger(entry.size) || entry.size < 1 || entry.size > 12_000_000) throw new Error('The model download could not be verified. Reload and retry.');
  const response = await fetch(MODEL + '/' + entry.file);
  if (!response.ok || !response.body) throw new Error('The upscaling model could not be loaded. Check your connection and retry.');
  const reader = response.body.getReader(), bytes = new Uint8Array(entry.size); let offset = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    if (offset + value.length > bytes.length) throw new Error('The model download could not be verified. Reload and retry.');
    bytes.set(value, offset); offset += value.length; report('Loading the upscaling model…', 2 + offset / bytes.length * 12);
  }
  if (offset !== bytes.length || await hash(bytes) !== entry.sha256) throw new Error('The model download could not be verified. Reload and retry.');
  return bytes;
}
async function releaseGpu() {
  try { await session?.release(); } catch { /* device loss can reject release */ }
  session = undefined;
}
async function initializeCpu() {
  ort = await import('/background-removal/runtime-1.22.0/ort.wasm.min.mjs');
  ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = '/background-removal/runtime-1.22.0/';
  const model = await loadModel('cpu'); report('Preparing compatibility processing…', 15);
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); backend = 'cpu';
}
async function initialize(compatibility) {
  if (session) return;
  if (!compatibility && navigator.gpu) {
    try {
      const runtime = ROOT + '/runtime-1.31.1/';
      ort = await import(runtime + 'ort.webgpu.bundle.min.mjs'); ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = runtime;
      const model = await loadModel('gpu'); report('Preparing accelerated processing…', 15);
      session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
      backend = 'gpu'; return;
    } catch { await releaseGpu(); report('Switching to compatibility processing…', 1); }
  }
  await initializeCpu();
}
async function runTile(values) {
  const input = new ort.Tensor('float32', values, [1, 3, TILE, TILE]); let outputs;
  try {
    outputs = await session.run({ pixel_values: input });
    const tensor = outputs.reconstruction;
    if (tensor.dims.join(',') !== `1,3,${TILE * 2},${TILE * 2}`) throw new Error('The image model returned an invalid result. Please retry.');
    // Fresh tensors and readback per tile: reusing captured GPU buffers can
    // return a previous tile on some browser/runtime combinations.
    return new Float32Array(await tensor.getData());
  } finally { input.dispose(); if (outputs) for (const tensor of Object.values(outputs)) tensor.dispose(); }
}
async function infer(values) {
  try { return await runTile(values); }
  catch (error) {
    if (backend !== 'gpu') throw error;
    await releaseGpu(); report('Continuing with compatibility processing…', 15); await initializeCpu();
    return runTile(values);
  }
}

self.onmessage = async ({ data }) => {
  let bitmap, source, destination;
  try {
    if (!(data.file instanceof Blob) || !data.file.size || data.file.size > 100 * 1024 * 1024) throw new Error('Choose an image below 100MB.');
    bitmap = await createImageBitmap(data.file); outputDimensions(bitmap.width, bitmap.height, data.factor);
    source = new OffscreenCanvas(bitmap.width, bitmap.height); const ctx = source.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0); const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const width = bitmap.width, height = bitmap.height; bitmap.close(); bitmap = undefined; source.width = source.height = 1;
    await initialize(!!data.compatibility);
    report('Enlarging image details…', 16);
    const result = await upscalePixels(pixels, width, height, data.factor, infer, (done, total, pass) => report(`Enlarging details: ${done} of ${total} sections${data.factor === 4 ? ` · pass ${pass} of 2` : ''}…`, 16 + done / total * 78));
    report('Preparing the full-size image…', 96);
    destination = new OffscreenCanvas(result.width, result.height); destination.getContext('2d').putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0);
    const blob = await destination.convertToBlob({ type: 'image/png' });
    if (!blob.size || blob.size > 100 * 1024 * 1024) throw new Error('The enlarged image exceeds 100MB. Try a smaller source image.');
    self.postMessage({ type: 'done', blob, width: result.width, height: result.height });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    self.postMessage({ type: 'error', message: /^(Choose an image|The upscaling model|The model download|The image model|The enlarged image)/.test(message) ? message : 'This image could not be enlarged on your device. Try compatibility mode, close other busy tabs, or choose a smaller image.' });
  } finally { bitmap?.close(); if (source) source.width = source.height = 1; if (destination) destination.width = destination.height = 1; }
};
