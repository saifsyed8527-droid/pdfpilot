const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const canvas = require('@napi-rs/canvas');
global.createImageBitmap = async blob => { const image = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())); image.close = () => {}; return image; };
global.document = { createElement: () => { const surface = canvas.createCanvas(1, 1); surface.toBlob = (done, type, quality) => done(new Blob([surface.toBuffer(type, quality === undefined ? undefined : Math.round(quality * 100))], { type })); return surface; } };
function load(filename, cache = new Map()) { filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename).exports; const module = { exports: {} }; cache.set(filename, module); const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name), module, module.exports); return module.exports; }
const engine = load('src/lib/engines/upscale-image-engine.ts');
const geometry = import('../public/image-upscale/pixels.mjs');
function png() { const c = canvas.createCanvas(4, 3), ctx = c.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(1, 1, 2, 1); return new Blob([c.toBuffer('image/png')], { type: 'image/png' }); }
function file() { return new File([png()], 'small.png', { type: 'image/png' }); }
const nearestModel = async values => { const result = new Float32Array(3 * 256 * 256); for (let c = 0; c < 3; c++) for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) result[c * 256 * 256 + y * 256 + x] = values[c * 128 * 128 + Math.floor(y / 2) * 128 + Math.floor(x / 2)]; return result; };
test('overlapping AI tiles cover odd dimensions and boundaries exactly, including both 4x passes', async () => {
  const { upscalePixels } = await geometry, width = 103, height = 99, pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set([x, y, (x + y) % 256, 255], (y * width + x) * 4);
  let calls = 0, progress = [];
  const result = await upscalePixels(pixels, width, height, 4, async input => { calls++; return nearestModel(input); }, (done, total, pass) => progress.push([done, total, pass]));
  assert.deepEqual([result.width, result.height], [412, 396]); assert.equal(calls, 13); assert.deepEqual(progress.at(-1), [13, 13, 2]);
  for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) assert.deepEqual(Array.from(result.pixels.subarray((y * result.width + x) * 4, (y * result.width + x) * 4 + 4)), [Math.floor(x / 4), Math.floor(y / 4), (Math.floor(x / 4) + Math.floor(y / 4)) % 256, 255]);
});
test('reflection handles one-pixel and tiny images without dark padding or lost border pixels', async () => {
  const { reflect, upscalePixels } = await geometry;
  for (const v of [-1000, -16, 0, 16, 1000]) assert.equal(reflect(v, 1), 0);
  assert.deepEqual([-3, -2, -1, 0, 1, 2, 3, 4].map(n => reflect(n, 3)), [1, 2, 1, 0, 1, 2, 1, 0]);
  const result = await upscalePixels(new Uint8ClampedArray([30, 80, 180, 255]), 1, 1, 4, nearestModel);
  for (let i = 0; i < result.pixels.length; i += 4) assert.deepEqual(Array.from(result.pixels.subarray(i, i + 4)), [30, 80, 180, 255]);
});
test('alpha remains transparent or translucent and matte removal preserves solid colors', async () => {
  const { upscalePixels } = await geometry;
  const transparent = await upscalePixels(new Uint8ClampedArray([50, 90, 100, 0]), 1, 1, 4, nearestModel); assert.ok(transparent.pixels.every(v => v === 0));
  const half = await upscalePixels(new Uint8ClampedArray([50, 90, 100, 128]), 1, 1, 4, nearestModel);
  for (let i = 0; i < half.pixels.length; i += 4) assert.deepEqual(Array.from(half.pixels.subarray(i, i + 4)), [50, 90, 100, 128]);
  const edge = await upscalePixels(new Uint8ClampedArray([0, 0, 0, 0, 200, 30, 40, 255]), 2, 1, 2, nearestModel);
  assert.deepEqual([3, 7, 11, 15].map(i => edge.pixels[i]), [0, 64, 191, 255]);
});
test('oversized images and malformed model output fail instead of exporting blank output', async () => {
  const { outputDimensions, upscalePixels } = await geometry;
  for (const args of [[0, 1, 2], [3000, 2000, 2], [1025, 1025, 4], [4097, 1, 2], [10, 10, 3]]) { assert.throws(() => outputDimensions(...args), /at most 16 megapixels/); assert.throws(() => engine.validateUpscaleSize(...args), /at most 16 megapixels/); }
  assert.deepEqual(outputDimensions(2000, 2000, 2), { width: 4000, height: 4000 });
  await assert.rejects(upscalePixels(new Uint8ClampedArray(4), 1, 1, 2, async () => new Float32Array(1)), /invalid result/);
  await assert.rejects(upscalePixels(new Uint8ClampedArray(4), 1, 1, 2, async () => new Float32Array(3 * 256 * 256).fill(NaN)), /invalid result/);
});
test('cancelled batches retain completed outputs and terminate inference before retry', async () => {
  let stopped = 0;
  global.Worker = class { postMessage() { this.timer = setTimeout(() => this.onmessage({ data: { type: 'done', blob: png(), width: 8, height: 6 } }), 5); } terminate() { clearTimeout(this.timer); stopped++; } };
  const controller = new AbortController(), completed = [];
  await assert.rejects(engine.upscaleImages([file(), file()], 2, false, controller.signal, undefined, (_i, value) => { completed.push(value); queueMicrotask(() => controller.abort()); }), /cancelled/);
  assert.equal(completed.length, 1); assert.equal(stopped, 1);
  const retry = await engine.upscaleImages([file()], 2, true); assert.equal(retry.length, 1); assert.equal(stopped, 2);
});
test('invalid worker output and failures never become a successful image', async () => {
  let data = { type: 'done', blob: new Blob(['not png']), width: 8, height: 6 };
  global.Worker = class { postMessage() { queueMicrotask(() => this.onmessage({ data })); } terminate() {} };
  await assert.rejects(engine.upscaleImages([file()], 2, false), /invalid result/);
  data = { type: 'error', message: 'The model download could not be verified.' };
  await assert.rejects(engine.upscaleImages([file()], 4, false), /could not be verified/);
});
test('format encoding keeps PNG bytes, WEBP alpha and JPEG white background', async () => {
  const image = { blob: png(), width: 4, height: 3, factor: 2 };
  assert.equal(await engine.encodeUpscaledImage(image, 'image/png', .9), image.blob);
  const jpg = await engine.encodeUpscaledImage(image, 'image/jpeg', 1), webp = await engine.encodeUpscaledImage(image, 'image/webp', 1);
  const a = await canvas.loadImage(Buffer.from(await jpg.arrayBuffer())), b = await canvas.loadImage(Buffer.from(await webp.arrayBuffer()));
  for (const value of [a, b]) assert.deepEqual([value.width, value.height], [4, 3]);
  const surface = canvas.createCanvas(4, 3), ctx = surface.getContext('2d'); ctx.drawImage(a, 0, 0); assert.equal(ctx.getImageData(0, 0, 1, 1).data[3], 255);
  ctx.clearRect(0, 0, 4, 3);ctx.drawImage(b, 0, 0); assert.equal(ctx.getImageData(0, 0, 1, 1).data[3], 0);
  const controller = new AbortController(); controller.abort(); await assert.rejects(engine.encodeUpscaledImage(image, 'image/png', .9, controller.signal), /cancelled/);
});
test('bundled AI models and official runtime files match pinned hashes', () => {
  const root = 'public/image-upscale/swin2sr-92a21aca-v1', manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  for (const part of Object.values(manifest.models)) { const bytes = fs.readFileSync(path.join(root, part.file)); assert.equal(bytes.length, part.size); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), part.sha256); }
  const runtime = 'public/image-upscale/runtime-1.31.1', integrity = JSON.parse(fs.readFileSync(path.join(runtime, 'integrity.json')));
  for (const file of integrity.files) { const bytes = fs.readFileSync(path.join(runtime, file.file)); assert.equal(bytes.length, file.size); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256); }
});
