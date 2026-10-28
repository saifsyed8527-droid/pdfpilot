const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFString, decodePDFRawStream, degrees, rgb } = require('pdf-lib');
const canvas = require('@napi-rs/canvas');
global.DOMMatrix ??= canvas.DOMMatrix; global.ImageData ??= canvas.ImageData; global.Path2D ??= canvas.Path2D;
global.document = { createElement: tag => { assert.equal(tag, 'canvas'); return canvas.createCanvas(1, 1); } };
const originalFetch = global.fetch;
global.fetch = url => typeof url === 'string' && url.startsWith('/color-profiles/') ? Promise.resolve(new Response(fs.readFileSync(path.join(process.cwd(), 'public', url)))) : originalFetch(url);
const pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
const source = ts.transpileModule(fs.readFileSync('src/lib/engines/pdfa-engine.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const engine = { exports: {} };
new Function('require', 'module', 'exports', source)(name => name === '../pdfjs' ? { loadPdfjs: async () => {
  const pdfjs = await pdfjsPromise;
  return { ...pdfjs, getDocument: options => pdfjs.getDocument({ ...options, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' }) };
} } : require(name), engine, engine.exports);
const { convertPdfToPdfa } = engine.exports;
async function fixture() {
  const pdf = await PDFDocument.create(), page = pdf.addPage([400, 500]);
  page.drawText('Archive text', { x: 40, y: 420, size: 18 });
  page.drawRectangle({ x: 20, y: 20, width: 80, height: 40, color: rgb(0, 0.5, 1), opacity: 0.5 });
  pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert("example")') }));
  const form = pdf.getForm().createTextField('name'); form.setText('Form value'); form.addToPage(page, { x: 40, y: 200, width: 200, height: 24 });
  const rotated = pdf.addPage([400, 500]); rotated.setCropBox(10, 20, 370, 460); rotated.setRotation(degrees(90)); rotated.drawText('Rotated archive', { x: 30, y: 400, size: 18 });
  return new File([await pdf.save()], 'archive.pdf', { type: 'application/pdf' });
}
for (const profile of ['PDF/A-1b', 'PDF/A-2b', 'PDF/A-3b']) test(`${profile} creates self-contained opaque images with original physical dimensions`, async () => {
  const input = await fixture(), result = await convertPdfToPdfa(input, { conformance: profile });
  const bytes = new Uint8Array(await result.blob.arrayBuffer()), pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(pdf.getPageCount(), 2); assert.deepEqual(pdf.getPages().map(page => page.getSize()), [{ width: 400, height: 500 }, { width: 460, height: 370 }]);
  assert.ok(!pdf.catalog.has(PDFName.of('OpenAction'))); assert.equal(pdf.getForm().getFields().length, 0);
  const metadata = pdf.catalog.lookup(PDFName.of('Metadata'), PDFRawStream);
  const xmp = Buffer.from(decodePDFRawStream(metadata).decode()).toString('utf8');
  assert.match(xmp, new RegExp('<pdfaid:part>' + profile[6] + '</pdfaid:part>')); assert.match(xmp, /<pdfaid:conformance>B/);
  const intents = pdf.catalog.lookup(PDFName.of('OutputIntents'), PDFArray);
  assert.equal(intents.size(), 1);
  for (const page of pdf.getPages()) {
    assert.equal(page.node.Annots()?.size() ?? 0, 0);
    const images = page.node.Resources().lookup(PDFName.of('XObject'));
    const image = pdf.context.lookup(images.values()[0], PDFRawStream);
    assert.equal(image.dict.get(PDFName.of('ColorSpace')).toString(), '/DeviceRGB'); assert.ok(!image.dict.has(PDFName.of('SMask')));
    assert.ok(decodePDFRawStream(image).decode().length > 1_000_000);
  }
  if (process.env.ARCHIVE_QA_DIR) {
    fs.mkdirSync(process.env.ARCHIVE_QA_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.ARCHIVE_QA_DIR, profile.replace('/', '') + '.pdf'), bytes);
    fs.writeFileSync(path.join(process.env.ARCHIVE_QA_DIR, 'archive-source.pdf'), new Uint8Array(await input.arrayBuffer()));
  }
});
test('archive rotation and 300 DPI preserve size and produce sharper pages', async () => {
  const result = await convertPdfToPdfa(await fixture(), { conformance: 'PDF/A-2b', dpi: 300, rotation: 90 });
  const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.deepEqual(pdf.getPages().map(page => page.getSize()), [{ width: 500, height: 400 }, { width: 370, height: 460 }]);
  const image = pdf.context.lookup(pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject')).values()[0], PDFRawStream);
  assert.equal(image.dict.get(PDFName.of('Width')).asNumber(), Math.ceil(500 * 300 / 72));
});
test('archive rejects false conformance claims, invalid input and cancellation', async () => {
  const input = await fixture();
  await assert.rejects(convertPdfToPdfa(input, { conformance: 'PDF/A-2a' }), /Tagged and Unicode/);
  await assert.rejects(convertPdfToPdfa(input, { conformance: 'PDF/A-2b', isCancelled: () => true }), /cancelled/);
  await assert.rejects(convertPdfToPdfa(new File(['not a PDF'], 'bad.pdf'), { conformance: 'PDF/A-2b' }), /Invalid PDF/);
});
test('archive cancellation between pages stops rendering and never produces a result', async () => {
  let cancelled = false, rendered = 0;
  await assert.rejects(convertPdfToPdfa(await fixture(), { conformance: 'PDF/A-2b', isCancelled: () => cancelled }, done => { rendered = done; cancelled = true; }), /cancelled/);
  assert.equal(rendered, 1);
});
