const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const canvas = require('@napi-rs/canvas');
global.createImageBitmap = async blob => { const image = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())); image.close = () => {}; return image; };
global.document = { createElement: tag => { assert.equal(tag, 'canvas'); const surface = canvas.createCanvas(1, 1); surface.toBlob = (done, type, quality) => done(new Blob([surface.toBuffer(type, quality === undefined ? undefined : Math.round(quality * 100))], { type })); return surface; } };
function load(filename, cache = new Map()) {
  filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name), module, module.exports); return module.exports;
}
const engine = load('src/lib/engines/image-engine.ts'), { watermarkImage } = load('src/lib/engines/image-watermark-engine.ts');
function evidence(name, bytes) { if (process.env.IMAGE_QA_DIR) { fs.mkdirSync(process.env.IMAGE_QA_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.IMAGE_QA_DIR, name), Buffer.from(bytes)); } }
function source(width = 400, height = 200, transparent = false) {
  const surface = canvas.createCanvas(width, height), ctx = surface.getContext('2d');
  if (!transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
  ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, width / 2, height / 2);
  ctx.fillStyle = '#0000ff'; ctx.fillRect(width / 2, height / 2, width / 2, height / 2);
  const bytes = surface.toBuffer('image/png'); evidence(transparent ? 'transparent.png' : 'source.png', bytes); return new File([bytes], 'source.png', { type: 'image/png' });
}
async function inspect(blob) { const image = await canvas.loadImage(Buffer.from(await blob.arrayBuffer())), output = canvas.createCanvas(image.width, image.height); output.getContext('2d').drawImage(image, 0, 0); return { width: image.width, height: image.height, pixel: (x, y) => Array.from(output.getContext('2d').getImageData(x, y, 1, 1).data) }; }
const layer = patch => ({ id: 'test', kind: 'text', text: 'Sample', x: .5, y: .5, width: .4, fontSize: .15, font: 'sans-serif', bold: true, italic: false, underline: false, color: '#000000', background: 'transparent', opacity: 1, rotation: 0, tiled: false, ...patch });

test('resize percentage, aspect fitting, non-proportional sizing and no-enlarge change the actual decoded dimensions', async () => {
  const file = source();
  for (const [target, expected] of [[{ percentage: 25, maintainAspectRatio: true }, [100, 50]], [{ width: 300, height: 300, maintainAspectRatio: true }, [300, 150]], [{ width: 80, height: 120, maintainAspectRatio: false }, [80, 120]], [{ width: 800, height: 800, maintainAspectRatio: true, noEnlarge: true }, [400, 200]], [{ percentage: 200, maintainAspectRatio: true, noEnlarge: true }, [400, 200]]]) {
    const blob = await engine.resizeImage(file, target, 'image/png'), decoded = await inspect(blob); assert.deepEqual([decoded.width, decoded.height], expected); evidence(`resized-${expected.join('x')}.png`, await blob.arrayBuffer());
  }
  assert.deepEqual(engine.resizedDimensions({ width: 1, height: 1000 }, { percentage: 1, maintainAspectRatio: true }), { width: 1, height: 10 });
});
test('image crop selects exact source pixels and rejects regions outside the image', async () => {
  const file = source(), blob = await engine.cropImage(file, { x: 200, y: 100, width: 200, height: 100 }, 'image/png'), decoded = await inspect(blob);
  assert.deepEqual([decoded.width, decoded.height], [200, 100]); assert.deepEqual(decoded.pixel(100, 50), [0, 0, 255, 255]); evidence('crop-blue.png', await blob.arrayBuffer());
  for (const region of [{ x: -1, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 401, height: 200 }, { x: .5, y: 0, width: 10, height: 10 }]) await assert.rejects(engine.cropImage(file, region, 'image/png'), /crop inside/);
});
test('PNG transparency survives and JPG uses white behind transparent pixels, with real format headers', async () => {
  const input = source(400, 200, true), png = await engine.resizeImage(input, { percentage: 50, maintainAspectRatio: true }, 'image/png');
  assert.equal((await inspect(png)).pixel(150, 25)[3], 0);
  const jpg = await engine.resizeImage(input, { percentage: 50, maintainAspectRatio: true }, 'image/jpeg', .95), bytes = new Uint8Array(await jpg.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 3)), [255, 216, 255]); assert.ok((await inspect(jpg)).pixel(150, 25).slice(0, 3).every(n => n > 245)); evidence('transparent-white.jpg', bytes);
  const webp = await engine.cropImage(input, { x: 0, y: 0, width: 200, height: 100 }, 'image/webp', .9); assert.equal(Buffer.from(await webp.arrayBuffer()).toString('ascii', 8, 12), 'WEBP'); evidence('crop.webp', await webp.arrayBuffer());
});
test('watermarks combine transparent image layers, opacity, rotation and text without changing source dimensions', async () => {
  const surface = canvas.createCanvas(40, 20), ctx = surface.getContext('2d'); ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 40, 20); const logo = new File([surface.toBuffer('image/png')], 'logo.png', { type: 'image/png' }); evidence('logo.png', await logo.arrayBuffer());
  const input = source(), blob = await watermarkImage(input, [layer({ kind: 'image', image: logo, width: .2, x: .75, y: .25, rotation: 90, opacity: .5 }), layer({ text: 'TEST', x: .25, y: .75, color: '#000000', background: '#ffff00', underline: true })], 'image/png');
  const decoded = await inspect(blob); assert.deepEqual([decoded.width, decoded.height], [400, 200]); const pixel = decoded.pixel(300, 50); assert.ok(pixel[1] > 245 && pixel[0] > 120 && pixel[0] < 140); assert.deepEqual(decoded.pixel(300, 5), [255, 255, 255, 255]); assert.ok(decoded.pixel(300, 20)[0] < 150, '90-degree logo has the rotated height'); evidence('watermark-layers.png', await blob.arrayBuffer());
  const preview = await watermarkImage(input, [layer({ text: 'PROOF', tiled: true, rotation: -30 })], 'image/png', 1, undefined, 100); assert.deepEqual([(await inspect(preview)).width, (await inspect(preview)).height], [100, 50]); evidence('watermark-preview.png', await preview.arrayBuffer());
});
test('invalid dimensions, invalid logo, invalid formats and cancellation never produce a result', async () => {
  const input = source(), abort = new AbortController(); abort.abort();
  await assert.rejects(engine.resizeImage(input, { width: 100, maintainAspectRatio: true }, 'image/png', 1, abort.signal), /cancelled/);
  for (const width of [0, -1, Infinity, 20000, 2.5]) await assert.rejects(engine.resizeImage(input, { width, maintainAspectRatio: true }, 'image/png'), /dimensions|whole-pixel/);
  await assert.rejects(watermarkImage(input, [], 'image/png'), /one and ten/);
  await assert.rejects(watermarkImage(input, [layer({ opacity: 2 })], 'image/png'), /valid watermark/);
  await assert.rejects(watermarkImage(input, [layer({ kind: 'image', image: new File(['broken'], 'bad.png') })], 'image/png'));
  await assert.rejects(engine.resizeImage(input, { width: 100, maintainAspectRatio: true }, 'image/gif'), /PNG, JPG or WEBP/);
  const retry = await engine.resizeImage(input, { width: 100, maintainAspectRatio: true }, 'image/png'); assert.equal((await inspect(retry)).width, 100);
});
test('cancellation during image decoding discards the decoded result and a later conversion recovers', async () => {
  const input = source(), original = global.createImageBitmap, controller = new AbortController();
  global.createImageBitmap = async blob => { const decoded = await original(blob); controller.abort(); return decoded; };
  try { await assert.rejects(engine.cropImage(input, { x: 0, y: 0, width: 50, height: 50 }, 'image/png', 1, controller.signal), /cancelled/); }
  finally { global.createImageBitmap = original; }
  assert.equal((await inspect(await engine.cropImage(input, { x: 0, y: 0, width: 50, height: 50 }, 'image/png'))).width, 50);
});
