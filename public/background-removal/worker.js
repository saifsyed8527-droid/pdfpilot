/* PDFPilot: local, terminable background-removal inference. No image uploads. */
const ROOT = '/background-removal';
let session, ort, backend, modelMode;
const report = (message, progress) => self.postMessage({ type: 'progress', message, progress });
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
async function loadModel(mode) {
  const root = ROOT + (mode === 'fast' ? '/u2netp-v1' : '/u2net-v1');
  const response = await fetch(root + '/manifest.json');
  if (!response.ok) throw new Error('The background-removal model could not be loaded. Please try again.');
  const manifest = await response.json();
  if (!Number.isInteger(manifest.size) || manifest.size < 1 || manifest.size > 180_000_000 || !Array.isArray(manifest.parts) || manifest.parts.length > 3 || manifest.parts.reduce((sum, part) => sum + part.size, 0) !== manifest.size) throw new Error('The model download could not be verified. Please reload and try again.');
  const buffer = new Uint8Array(manifest.size);
  let offset = 0;
  for (const part of manifest.parts) {
    const response = await fetch(root + '/' + part.file);
    if (!response.ok || !response.body) throw new Error('The background-removal model download failed. Check your connection and try again.');
    const reader = response.body.getReader(); let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      if (size + value.length > part.size) throw new Error('The model download is incomplete. Please reload and try again.');
      buffer.set(value, offset + size); size += value.length;
      report('Loading the background-removal model…', Math.round(5 + (offset + size) / manifest.size * 35));
    }
    if (size !== part.size || await hash(buffer.subarray(offset, offset + size)) !== part.sha256) throw new Error('The model download could not be verified. Please reload and try again.');
    offset += size;
  }
  return buffer;
}
async function initialize(preferred) {
  if (session) return;
  modelMode = preferred === 'wasm' || preferred === 'fast' ? 'fast' : 'detailed';
  backend = 'wasm';
  const runtime = '/runtime-1.22.0/';
  ort = await import(ROOT + runtime + 'ort.wasm.min.mjs');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = ROOT + runtime;
  const model = await loadModel(modelMode); report('Preparing the image model…', 45);
  session = await ort.InferenceSession.create(model, { executionProviders: [backend], graphOptimizationLevel: 'all' });
}
self.onmessage = async ({ data }) => {
  let bitmap, surface, input;
  try {
    if (!(data.file instanceof Blob) || data.file.size > 100 * 1024 * 1024) throw new Error('Choose an image below 100MB.');
    bitmap = await createImageBitmap(data.file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000 || Math.max(bitmap.width, bitmap.height) > 16384) throw new Error('Use an image below 20 megapixels and 16,384 pixels per side.');
    await initialize(data.mode || data.backend);
    report('Finding the subject and its edges…', 55);
    const side = 320, count = side * side;
    surface = new OffscreenCanvas(side, side);
    const context = surface.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, side, side); context.drawImage(bitmap, 0, 0, side, side);
    const pixels = context.getImageData(0, 0, side, side).data;
    const values = new Float32Array(3 * count), mean = [.485, .456, .406], std = [.229, .224, .225];
    let divisor = 1;
    for (let i = 0; i < pixels.length; i += 4) divisor = Math.max(divisor, pixels[i], pixels[i + 1], pixels[i + 2]);
    for (let channel = 0; channel < 3; channel++) for (let i = 0; i < count; i++) values[channel * count + i] = (pixels[i * 4 + channel] / divisor - mean[channel]) / std[channel];
    input = new ort.Tensor('float32', values, [1, 3, side, side]);
    const output = await session.run({ [session.inputNames[0]]: input });
    const tensor = output[session.outputNames[0]];
    const result = await tensor.getData();
    const width = tensor.dims.at(-1), height = tensor.dims.at(-2);
    if (width * height !== result.length || !width || !height) throw new Error('The model returned an invalid cutout. Please try another image.');
    const mask = new Uint8ClampedArray(result.length);
    let min = Infinity, max = -Infinity;
    for (const value of result) { min = Math.min(min, value); max = Math.max(max, value); }
    if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('The model returned an invalid cutout. Please try another image.');
    for (let i = 0; i < result.length; i++) mask[i] = Math.round((result[i] - min) / Math.max(.000001, max - min) * 255);
    for (const value of Object.values(output)) value.dispose();
    self.postMessage({ type: 'done', mask, width, height, backend }, [mask.buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const readable = /^(Choose an image|Use an image|The background-removal model|The model download|The model returned)/.test(message);
    self.postMessage({ type: 'error', message: readable ? message : 'The image could not be processed on this device. Choose Fast mode, close other busy tabs, or try a smaller image.' });
  }
  finally { input?.dispose(); bitmap?.close(); if (surface) surface.width = surface.height = 1; }
};
