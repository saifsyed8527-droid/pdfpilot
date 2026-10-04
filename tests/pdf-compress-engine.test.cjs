const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, degrees } = require('pdf-lib');
const { createCanvas } = require('@napi-rs/canvas');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const loader = require('../src/lib/pdfjs.ts');
const engine = require('../src/lib/engines/pdf-compress-engine.ts');
const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
let pdfjs;
const originalDocument = global.document;
test.before(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // The production engine remains unmodified: adapt only the browser canvas
  // host and worker-loader environment to the real Node PDF.js/encoder.
  loader.loadPdfjs = async () => ({ ...pdfjs, getDocument(options) { return pdfjs.getDocument({ ...options, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' }); } });
  global.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    const canvas = createCanvas(1, 1);
    canvas.toBlob = (callback, mimeType, quality) => callback(new Blob([canvas.toBuffer(mimeType, Math.round(quality * 100))], { type: mimeType }));
    return canvas;
  } };
});
test.after(() => { global.document = originalDocument; });
async function tinyPdf() {
  const pdf = await PDFDocument.create();
  for (const text of ['ALPHA PAGE ONE', 'ALPHA PAGE TWO']) pdf.addPage([400, 500]).drawText(text, { x: 40, y: 400 });
  return pdf.save();
}

test('all compression presets retain tiny text PDFs byte-for-byte rather than fake savings', async () => {
  const bytes = await tinyPdf();
  for (const [scale, quality] of [[.6, .5], [.8, .7], [1, .92]]) {
    const progress = [];
    const output = await engine.compressPdfPagesWithGuard(arrayBuffer(bytes), scale, quality, (...values) => progress.push(values));
    assert.equal(output.keptOriginal, true);
    assert.deepEqual(output.bytes, bytes);
    assert.deepEqual(progress, [[1, 2], [2, 2]]);
    assert.equal((await PDFDocument.load(output.bytes)).getPageCount(), 2);
  }
});

test('image-heavy PDFs actually shrink and retain page order, aspect and rotation geometry', async () => {
  const pdf = await PDFDocument.create();
  // Deterministic high-frequency pixels avoid an artificially tiny solid PNG.
  const canvas = createCanvas(1200, 900), ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(1200, 900);
  let seed = 12345;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data[index] = seed & 255; pixels.data[index + 1] = (seed >>> 8) & 255; pixels.data[index + 2] = (seed >>> 16) & 255; pixels.data[index + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const image = await pdf.embedPng(canvas.toBuffer('image/png'));
  pdf.addPage([400, 300]).drawImage(image, { width: 400, height: 300 });
  const second = pdf.addPage([500, 400]); second.setRotation(degrees(90)); second.drawRectangle({ x: 0, y: 0, width: 500, height: 400 });
  const bytes = await pdf.save();
  const output = await engine.compressPdfPagesWithGuard(arrayBuffer(bytes), .8, .7);
  assert.equal(output.keptOriginal, false);
  assert.ok(output.bytes.length < bytes.length / 2, `${bytes.length} → ${output.bytes.length}`);
  const parsed = await PDFDocument.load(output.bytes);
  assert.equal(parsed.getPageCount(), 2);
  assert.deepEqual(parsed.getPages().map(p => p.getSize()), [{ width: 400, height: 300 }, { width: 400, height: 500 }]);
  const task = pdfjs.getDocument({ data: output.bytes.slice() });
  try {
    const doc = await task.promise;
    const page1 = await doc.getPage(1), page2 = await doc.getPage(2);
    const images = [];
    for (const page of [page1, page2]) {
      const viewport = page.getViewport({ scale: 1 }), target = createCanvas(viewport.width, viewport.height);
      await page.render({ canvas: target, viewport }).promise;
      const value = target.getContext('2d').getImageData(100, 100, 1, 1).data;
      images.push(Array.from(value));
    }
    assert.ok(images[0].some((value, i) => i < 3 && value > 10), 'first page remains the colored image');
    assert.ok(images[1].slice(0, 3).every(value => value <= 3) && images[1][3] === 255, 'second page remains black within JPEG rounding');
  } finally { await task.destroy(); }
  if (process.env.COMPRESS_QA_DIR) {
    fs.mkdirSync(process.env.COMPRESS_QA_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.COMPRESS_QA_DIR, 'image-source.pdf'), bytes);
    fs.writeFileSync(path.join(process.env.COMPRESS_QA_DIR, 'image-compressed.pdf'), output.bytes);
  }
});

test('malformed input rejects without output and a subsequent valid conversion succeeds', async () => {
  await assert.rejects(engine.compressPdfPagesWithGuard(arrayBuffer(new TextEncoder().encode('not PDF')), .8, .7));
  const bytes = await tinyPdf();
  const output = await engine.compressPdfPagesWithGuard(arrayBuffer(bytes), .8, .7);
  assert.equal(output.keptOriginal, true);
  assert.deepEqual(output.bytes, bytes);
});
