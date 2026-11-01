const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const canvas = require('@napi-rs/canvas');
global.createImageBitmap = async blob => { const image = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())); image.close = () => {}; return image; };
global.document = { createElement: () => { const surface = canvas.createCanvas(1, 1); surface.toBlob = (done, type, quality) => done(new Blob([surface.toBuffer(type, quality === undefined ? undefined : Math.round(quality * 100))], { type })); return surface; } };
function load(filename, cache = new Map()) {
  filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name), module, module.exports); return module.exports;
}
const { renderCutout, initialCutoutOptions, validateSubjectMask, validateCutoutOptions, removeImageBackgrounds, createCutoutZip } = load('src/lib/engines/background-removal-engine.ts');
function input(alpha = false) { const s = canvas.createCanvas(200, 100), c = s.getContext('2d'); c.fillStyle = '#0000ff'; c.fillRect(0, 0, 200, 100); if (alpha) c.clearRect(0, 0, 20, 20); return new File([s.toBuffer('image/png')], 'image.png', { type: 'image/png' }); }
function mask(fill = 255) { return { width: 200, height: 100, alpha: new Uint8ClampedArray(20000).fill(fill), mode: 'fast' }; }
async function inspect(blob) { const im = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())), s = canvas.createCanvas(im.width, im.height); s.getContext('2d').drawImage(im, 0, 0); return { width: im.width, height: im.height, pixel: (x, y) => Array.from(s.getContext('2d').getImageData(x, y, 1, 1).data) }; }
test('cutouts keep original RGB, alpha, dimensions and a transparent background', async () => {
  const m = mask(); for (let y = 0; y < 100; y++) m.alpha.fill(0, y * 200 + 100, y * 200 + 200);
  const d = await inspect(await renderCutout(input(true), m, [], initialCutoutOptions));
  assert.deepEqual([d.width, d.height], [200, 100]); assert.equal(d.pixel(10, 10)[3], 0);
  assert.deepEqual(d.pixel(70, 50), [0, 0, 255, 255]); assert.equal(d.pixel(150, 50)[3], 0);
});
test('erase and restore strokes change only painted regions, with no connecting line between strokes', async () => {
  const erase = [{ mode: 'erase', diameter: .2, points: [{ x: .1, y: .3 }, { x: .2, y: .3 }] }, { mode: 'erase', diameter: .2, points: [{ x: .8, y: .7 }, { x: .9, y: .7 }] }];
  const d = await inspect(await renderCutout(input(), mask(), erase, initialCutoutOptions));
  assert.equal(d.pixel(30, 30)[3], 0); assert.equal(d.pixel(170, 70)[3], 0); assert.equal(d.pixel(100, 50)[3], 255);
  const restored = await inspect(await renderCutout(input(true), mask(0), [{ mode: 'restore', diameter: .3, points: [{ x: .5, y: .5 }] }, { mode: 'restore', diameter: .2, points: [{ x: .05, y: .1 }] }], initialCutoutOptions));
  assert.deepEqual(restored.pixel(100, 50), [0, 0, 255, 255]); assert.equal(restored.pixel(150, 50)[3], 0); assert.equal(restored.pixel(10, 10)[3], 0);
});
test('preview and full-size brush geometry agree, with per-image source alpha preserved', async () => {
  const strokes = [{ mode: 'erase', diameter: .2, points: [{ x: .5, y: .5 }] }];
  const d = await inspect(await renderCutout(input(), mask(), strokes, initialCutoutOptions, 'image/png', undefined, 100));
  assert.deepEqual([d.width, d.height], [100, 50]); assert.equal(d.pixel(50, 25)[3], 0); assert.deepEqual(d.pixel(20, 20), [0, 0, 255, 255]);
});
test('solid backgrounds and JPG white fill are real pixels, while WEBP retains transparency', async () => {
  const png = await inspect(await renderCutout(input(), mask(0), [], { background: '#ff0000', feather: 0 })); assert.deepEqual(png.pixel(100, 50), [255, 0, 0, 255]);
  const jpg = await inspect(await renderCutout(input(), mask(0), [], initialCutoutOptions, 'image/jpeg')); assert.ok(jpg.pixel(100, 50).every(v => v >= 250));
  const webp = await renderCutout(input(), mask(0), [], initialCutoutOptions, 'image/webp'); assert.equal(webp.type, 'image/webp'); assert.equal((await inspect(webp)).pixel(100, 50)[3], 0);
});
test('edge softness creates intermediate alpha at the cut boundary', async () => {
  const m = mask(); for (let y = 0; y < 100; y++) m.alpha.fill(0, y * 200 + 100, y * 200 + 200);
  const d = await inspect(await renderCutout(input(), m, [], { ...initialCutoutOptions, feather: 3 }));
  assert.ok(d.pixel(100, 50)[3] > 0 && d.pixel(100, 50)[3] < 255); assert.equal(d.pixel(70, 50)[3], 255); assert.equal(d.pixel(130, 50)[3], 0);
});
test('invalid masks, settings and stroke bounds fail before export; cancelled exports can be retried', async () => {
  assert.throws(() => validateSubjectMask({ ...mask(), alpha: [] }), /mask is invalid/);
  assert.throws(() => validateSubjectMask({ ...mask(), width: 2001 }), /mask is invalid/);
  assert.throws(() => validateCutoutOptions([], { background: 'red', feather: 0 }), /valid background/);
  assert.throws(() => validateCutoutOptions([{ mode: 'erase', diameter: .1, points: [{ x: 2, y: 0 }] }], initialCutoutOptions), /inside the image/);
  const abort = new AbortController(); abort.abort(); await assert.rejects(renderCutout(input(), mask(), [], initialCutoutOptions, 'image/png', abort.signal), /cancelled/);
  assert.equal((await inspect(await renderCutout(input(), mask(), [], initialCutoutOptions))).width, 200);
});
test('batch workers preserve completed cutouts when cancelled and terminate before a fresh retry', async () => {
  let terminated = 0;
  global.Worker = class { postMessage() { this.timer = setTimeout(() => this.onmessage({ data: { type: 'done', width: 2, height: 2, mask: new Uint8ClampedArray([0, 255, 128, 255]) } }), 5); } terminate() { clearTimeout(this.timer); terminated++; } };
  const controller = new AbortController(), completed = [];
  const pending = removeImageBackgrounds([input(), input()], 'fast', controller.signal, undefined, (i, m) => { completed.push(m); queueMicrotask(() => controller.abort()); });
  await assert.rejects(pending, /cancelled/); assert.equal(completed.length, 1); assert.equal(terminated, 1);
  const results = await removeImageBackgrounds([input()], 'fast'); assert.deepEqual(Array.from(results[0].alpha), [0, 255, 128, 255]); assert.equal(terminated, 2);
});
test('invalid model output and worker failures never resolve a successful cutout', async () => {
  let invalid = true, stopped = 0;
  global.Worker = class { postMessage() { queueMicrotask(() => this.onmessage({ data: invalid ? { type: 'done', width: 2, height: 2, mask: new Uint8ClampedArray(3) } : { type: 'error', message: 'Choose Fast mode on this device.' } })); } terminate() { stopped++; } };
  await assert.rejects(removeImageBackgrounds([input()], 'fast'), /mask is invalid/); invalid = false;
  await assert.rejects(removeImageBackgrounds([input()], 'detailed'), /Choose Fast/); assert.equal(stopped, 2);
});
test('ZIP keeps every duplicate filename, the exact image bytes and cancellation', async () => {
  const { unzipSync } = require('fflate'); const a = await renderCutout(input(), mask(), [], initialCutoutOptions), b = await renderCutout(input(), mask(0), [], initialCutoutOptions);
  const zip = await createCutoutZip([{ name: '../same.png', blob: a }, { name: '../same.png', blob: b }]);
  const entries = unzipSync(new Uint8Array(await zip.arrayBuffer())); assert.deepEqual(Object.keys(entries), ['1_.._same.png', '2_.._same.png']);
  assert.deepEqual(entries['1_.._same.png'], new Uint8Array(await a.arrayBuffer())); assert.deepEqual(entries['2_.._same.png'], new Uint8Array(await b.arrayBuffer()));
  const controller = new AbortController(); controller.abort(); await assert.rejects(createCutoutZip([{ name: 'a.png', blob: a }], controller.signal), /cancelled/);
});
test('shipped background model chunks match their pinned manifest hashes', () => {
  for (const directory of ['u2netp-v1', 'u2net-v1']) {
    const root = path.join('public/background-removal', directory), manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
    const chunks = manifest.parts.map(part => { const bytes = fs.readFileSync(path.join(root, part.file)); assert.equal(bytes.length, part.size); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), part.sha256); return bytes; });
    const bytes = Buffer.concat(chunks); assert.equal(bytes.length, manifest.size); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  }
});
