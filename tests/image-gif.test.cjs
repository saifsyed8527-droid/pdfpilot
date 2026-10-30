const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sharp = require('sharp');
function load(filename, cache = new Map()) {
  filename = path.resolve(filename); if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, allowJs: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), /\.js$/.test(name) ? name : name + '.ts'), cache) : require(name), module, module.exports); return module.exports;
}
const { gifEncoder, gifFramePlacement, validateGifOptions } = load('src/lib/engines/image-gif-core.ts');
const defaults = { width: 20, height: 10, delay: 250, repeat: 0, fit: 'contain', background: '#ffffff' };
function pixels(r, g, b) { const data = new Uint8ClampedArray(20 * 10 * 4); for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i); return data; }
test('GIF download decodes all frames, colors, timing and repeat metadata', async () => {
  const encoder = gifEncoder(defaults); encoder.add(pixels(255, 0, 0)); encoder.add(pixels(0, 0, 255));
  const bytes = Buffer.from(encoder.finish()), metadata = await sharp(bytes, { animated: true }).metadata();
  assert.equal(bytes.toString('ascii', 0, 6), 'GIF89a'); assert.equal(metadata.width, 20); assert.equal(metadata.pageHeight, 10); assert.equal(metadata.pages, 2); assert.deepEqual(metadata.delay, [250, 250]); assert.equal(metadata.loop, 0);
  for (const [page, expected] of [[0, [255, 0, 0]], [1, [0, 0, 255]]]) { const decoded = await sharp(bytes, { page }).removeAlpha().raw().toBuffer(); assert.deepEqual(Array.from(decoded.subarray(0, 3)), expected); }
  if (process.env.IMAGE_QA_DIR) { fs.mkdirSync(process.env.IMAGE_QA_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.IMAGE_QA_DIR, 'two-frame.gif'), bytes); }
});
test('static GIF encodes only supplied subarray pixels and has no loop extension', async () => {
  const encoder = gifEncoder({ ...defaults, repeat: -1 }), all = new Uint8ClampedArray(804); all.fill(100); all.set(pixels(0, 255, 0), 4); encoder.add(all.subarray(4));
  const bytes = Buffer.from(encoder.finish()); assert.equal(bytes.includes(Buffer.from('NETSCAPE2.0')), false);
  assert.equal((await sharp(bytes).metadata()).pages, 1);
  assert.deepEqual(Array.from((await sharp(bytes).removeAlpha().raw().toBuffer()).subarray(0, 3)), [0, 255, 0]);
});
test('GIF fit preserves aspect or crops/stretches as selected and rejects oversized or invalid jobs', () => {
  assert.deepEqual(gifFramePlacement(40, 10, defaults), { x: 0, y: 2.5, width: 20, height: 5 });
  assert.deepEqual(gifFramePlacement(40, 10, { ...defaults, fit: 'cover' }), { x: -10, y: 0, width: 40, height: 10 });
  assert.deepEqual(gifFramePlacement(40, 10, { ...defaults, fit: 'stretch' }), { x: 0, y: 0, width: 20, height: 10 });
  for (const patch of [{ width: 0 }, { width: 2049 }, { delay: 0 }, { delay: 100000 }, { repeat: 101 }, { background: 'bad' }, { fit: 'invalid' }, { width: 2048, height: 2048 }]) assert.throws(() => validateGifOptions({ ...defaults, ...patch }, 2));
  assert.throws(() => validateGifOptions({ ...defaults, width: 2000, height: 1000 }, 30), /megapixels/);
  assert.throws(() => validateGifOptions(defaults, 31), /30/);
  assert.throws(() => gifEncoder(defaults).add(new Uint8ClampedArray(4)), /dimensions/);
});
