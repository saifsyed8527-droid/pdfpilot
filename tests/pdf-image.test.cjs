const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('./load-ts.cjs');
const { imageDimensions, imageArchiveEntries, PdfImageError } = loadTs('src/lib/engines/pdf-image-engine.ts');
const { PDF_IMAGE_COPY } = loadTs('src/lib/i18n/pdf-image-copy.ts');
const { LOCALES } = loadTs('src/lib/i18n/locales.ts');
const { load } = require('../scripts/load-pseo-modules.cjs');
const { classifyKeyword } = load('src/lib/pseo/classify.ts');
const { portugueseIntent } = load('src/lib/pseo/portuguese.ts');

test('rendering dimensions round up rather than clipping fractional page edges', () => {
  assert.deepEqual(imageDimensions(595.28,841.89,300), {width:2481,height:3508});
  assert.deepEqual(imageDimensions(595.28,841.89,150), {width:1241,height:1754});
  assert.deepEqual(imageDimensions(841.89,595.28,300), {width:3508,height:2481});
});
test('oversized rendering refuses instead of silently lowering DPI', () => {
  for(const args of [[10000,10000,300],[0,10,150],[Infinity,100,300]])assert.throws(()=>imageDimensions(...args),error=>error instanceof PdfImageError&&error.code==='large');
});
test('archive names cannot collide for repeated or pre-numbered input names', () => {
  const bytes=new Uint8Array([1]);
  const names=['same.jpg','same.jpg','same-2.jpg','same.jpg','same-2.jpg'];
  const entries=imageArchiveEntries(names.map(name=>({name,bytes,width:1,height:1})));
  assert.equal(Object.keys(entries).length,5);
});
test('every UI and failure message exists in all 12 locales', () => {
  const keys=Object.keys(PDF_IMAGE_COPY.en);
  assert.equal(keys.length,29);
  for(const {code} of LOCALES){assert.deepEqual(Object.keys(PDF_IMAGE_COPY[code]),keys);for(const key of keys){assert.ok(PDF_IMAGE_COPY[code][key]?.trim(),code+':'+key);if(code!=='en')assert.notEqual(PDF_IMAGE_COPY[code][key],PDF_IMAGE_COPY.en[key],code+':'+key);}}
});
test('image intent ownership distinguishes extraction, PNG and detailed page rendering', () => {
  for(const q of ['extract images from pdf','extract pdf images','extract jpg from pdf'])assert.equal(classifyKeyword(q).modifier,'extract-images');
  for(const q of ['pdf to jpg high quality','pdf to high quality jpeg','pdf to jpg 300 dpi'])assert.equal(classifyKeyword(q).modifier,'high-quality');
  assert.equal(classifyKeyword('pdf to png').modifier,'pdf-to-png');
  assert.equal(classifyKeyword('jpg to pdf high quality').toolId,'jpg-to-pdf');
  assert.equal(classifyKeyword('pdf to jpg 600 dpi').family,'unsupported');
  assert.equal(classifyKeyword('extract images from pdf python').family,'informational');
  assert.equal(classifyKeyword('pdf to jpg 100kb').family,'size');
  assert.equal(portugueseIntent('extrair imagens do pdf').modifier,'extract-images');
  assert.equal(portugueseIntent('converter pdf em imagem de alta qualidade').modifier,'high-quality');
  assert.equal(portugueseIntent('pdf para png').modifier,'pdf-to-png');
});
test('PDFPilot workspace no longer embeds PDF plugins or competitor-red conversion controls', () => {
  const source=fs.readFileSync('src/app/pdf-to-jpg/pdf-to-jpg-client.tsx','utf8');
  assert.ok(!source.includes('<iframe'));
  assert.ok(!source.includes('bg-red-600'));
  assert.match(source,/useState<ImageResolution>\(300\)/);
  assert.match(source,/noClick: true, noKeyboard: true/);
});

test('JPG to PDF embeds original JPEG bytes without recompression, including rotated A4 output', async () => {
  const ts = require('typescript'), sharp = require('sharp');
  const { PDFDocument, PDFName, PDFRawStream } = require('pdf-lib');
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/engines/jpg-to-pdf-engine.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  const jpeg = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#123456' } }).jpeg({ quality: 97 }).toBuffer();
  for (const pageSize of ['fit', 'a4']) {
    const result = await module.exports.createImagePdf([{ file: new File([jpeg], 'original.jpg', { type: 'image/jpeg' }), rotation: 90 }], { pageSize, margin: 'small', orientation: 'portrait', merge: true }, () => {}, () => false);
    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    const streams = pdf.context.enumerateIndirectObjects().map(([,value]) => value).filter(value => value instanceof PDFRawStream && value.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'));
    assert.equal(streams.length, 1);
    assert.deepEqual(Buffer.from(streams[0].getContents()), jpeg);
    assert.equal(streams[0].dict.get(PDFName.of('Width')).asNumber(), 300);
    assert.equal(streams[0].dict.get(PDFName.of('Height')).asNumber(), 200);
  }
});

test('PDF image decoders receive worker-scoped WASM, not page-wide JavaScript eval', async () => {
  const ts = require('typescript'), previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync('next.config.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    new Function('require','module','exports','__dirname',code)(require,module,module.exports,process.cwd());
    const rules = await module.exports.default.headers();
    const page = rules.find(r => r.source === '/(.*)').headers.find(h => h.key === 'Content-Security-Policy').value;
    const worker = rules.find(r => r.source === '/pdf.worker.min.mjs').headers[0].value;
    assert.ok(!page.includes("'unsafe-eval'") && !page.includes("'wasm-unsafe-eval'"));
    assert.ok(worker.includes("'wasm-unsafe-eval'") && !worker.includes("'unsafe-eval'"));
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
