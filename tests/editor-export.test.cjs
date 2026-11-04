const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFName, PDFRawStream, PDFString, StandardFonts, decodePDFRawStream, degrees, rgb } = require('pdf-lib');
const canvas = require('@napi-rs/canvas');
global.DOMMatrix ??= canvas.DOMMatrix;
global.ImageData ??= canvas.ImageData;
global.Path2D ??= canvas.Path2D;
global.document = { createElement: tag => { assert.equal(tag, 'canvas'); return canvas.createCanvas(1, 1); } };
const browserFetch = global.fetch;
global.fetch = url => typeof url === 'string' && (url.startsWith('/fonts/') || url === '/tesseract/pdf.ttf')
  ? Promise.resolve(new Response(fs.readFileSync(path.join(process.cwd(), 'public', url)))) : browserFetch(url);
const pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
function load(filename, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = name => name.endsWith('.mjs') ? require(path.resolve(path.dirname(filename), name)) : name === '../pdfjs' ? { loadPdfjs: async () => {
    const pdfjs = await pdfjsPromise;
    return { ...pdfjs, getDocument: options => pdfjs.getDocument({ ...options, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/', cMapUrl: path.resolve('node_modules/pdfjs-dist/cmaps') + '/' }) };
  } } : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts'), cache) : require(name);
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const { exportEditedPdf } = load('src/lib/editor/pdf-export.ts');
const { removeIndependentPageText } = load('src/lib/engines/pdf-content-text.ts');
function contentBytes(pdf, page) {
  const contents = page.node.Contents();
  return Buffer.concat((contents?.asArray?.() ?? (contents ? [contents] : [])).map(ref => Buffer.from(decodePDFRawStream(pdf.context.lookup(ref, PDFRawStream)).decode())));
}
const { extractPageTextRuns } = load('src/lib/editor/existing-text.ts');
const { copyEditorObject } = load('src/lib/editor/types.ts');
const SCALE = 1.5;
const file = bytes => new File([bytes], 'editor.pdf', { type: 'application/pdf' });
async function inspect(bytes) {
  const pdfjs = await pdfjsPromise;
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes).slice(), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), viewport = page.getViewport({ scale: SCALE });
      const surface = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: surface, viewport }).promise;
      const text = await page.getTextContent();
      pages.push({ runs: await extractPageTextRuns(page, pdfjs, viewport, surface), items: text.items.filter(item => 'str' in item), text: text.items.map(item => item.str ?? '').join(' '), image: surface.toBuffer('image/png'), width: surface.width, height: surface.height });
    }
  } finally { await task.destroy(); }
  return pages;
}
function edit(run, patch = {}) {
  return { id: 'edit-' + run.id, type: 'existing-text-edit', runId: run.id, x: run.xPx, y: run.yPx, width: run.widthPx, height: run.heightPx, rotation: run.rotation, zIndex: 1,
    originalText: run.str, newText: run.str, originalXPt: run.xPt, originalYPt: run.yPt, originalWidthPt: run.widthPt, originalHeightPt: run.heightPt,
    originalFontSizePt: run.fontSizePt, fontSizePt: run.fontSizePt, originalColor: '#000000', color: '#000000', coverColor: run.coverColor,
    originalCanvasX: run.xPx, originalCanvasY: run.yPx, originalCanvasWidth: run.widthPx, originalCanvasHeight: run.heightPx, originalCanvasRotation: run.rotation, originalTextAngle: run.textAngle, source: 'native', ...patch };
}
async function fixture({ rotation = 0, complex = false, crop = false } = {}) {
  const pdf = await PDFDocument.create(), page = pdf.addPage([400, 500]);
  page.setRotation(degrees(rotation));
  if (crop) page.setCropBox(10, 20, 370, 460);
  page.drawRectangle({ x: 20, y: 40, width: 60, height: 30, color: rgb(0, 0.5, 1) });
  if (complex) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.node.set(PDFName.of('Resources'), pdf.context.obj({ Font: { F1: font.ref } }));
    page.node.set(PDFName.of('Contents'), pdf.context.obj([pdf.context.register(pdf.context.flateStream('BT /F1 18 Tf 1 0 0 1 40 420 Tm (Alpha original) Tj 0 -40 Td (Keep this line) Tj ET'))]));
  } else {
    page.drawText('Alpha original', { x: 40, y: 420, size: 18 });
    page.drawText('Keep this line', { x: 40, y: 380, size: 18 });
  }
  pdf.addPage([400, 500]).drawText('Untouched page', { x: 40, y: 420, size: 18 });
  return pdf.save();
}
function evidence(name, bytes) {
  if (!process.env.EDITOR_QA_DIR) return;
  fs.mkdirSync(process.env.EDITOR_QA_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.EDITOR_QA_DIR, name), Buffer.from(bytes));
}

test('native replacement removes original searchable text and retains other pages and graphics', async () => {
  const input = await fixture(), before = await inspect(input);
  let flattened;
  const result = await exportEditedPdf(file(input), { 0: [edit(before[0].runs[0], { newText: 'Changed now', width: 300 })] }, SCALE, [], [], pages => { flattened = pages; });
  const output = await result.arrayBuffer(), after = await inspect(output);
  assert.deepEqual(flattened, []);
  assert.match(after[0].text, /Changed now/); assert.ok(!after[0].text.includes('Alpha original'));
  assert.match(after[0].text, /Keep this line/);
  assert.deepEqual(after[1].image, before[1].image);
  const parsed = await PDFDocument.load(output);
  const content = contentBytes(parsed, parsed.getPage(0)).toString();
  assert.match(content, /0 0.5 1 rg/);
  evidence('editor-native.pdf', input); evidence('editor-native-edited.pdf', output);
});
test('deletion and style-only edits are exported, while unchanged selections preserve appearance', async () => {
  const input = await fixture(), before = await inspect(input), run = before[0].runs[0];
  const deleted = await inspect(await (await exportEditedPdf(file(input), { 0: [edit(run, { newText: '' })] }, SCALE)).arrayBuffer());
  assert.ok(!deleted[0].text.includes('Alpha original')); assert.match(deleted[0].text, /Keep this line/);
  const styled = await inspect(await (await exportEditedPdf(file(input), { 0: [edit(run, { color: '#ff0000', bold: true, width: 300 })] }, SCALE)).arrayBuffer());
  assert.match(styled[0].text, /Alpha original/); assert.notDeepEqual(styled[0].image, before[0].image);
  const unchanged = await inspect(await (await exportEditedPdf(file(input), { 0: [edit(run)] }, SCALE)).arrayBuffer());
  assert.deepEqual(unchanged[0].image, before[0].image);
});
test('complex text fallback leaves no stale text, preserves untouched pages, links and form widgets', async () => {
  const original = await fixture({ complex: true });
  const pdf = await PDFDocument.load(original), page = pdf.getPage(0);
  const field = pdf.getForm().createTextField('name'); field.setText('Editable form'); field.addToPage(page, { x: 40, y: 150, width: 200, height: 25 });
  page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [40, 70, 120, 90], A: { S: 'URI', URI: PDFString.of('https://pdfpilot.net') } })));
  const input = await pdf.save(), before = await inspect(input);
  let flattened;
  const object = edit(before[0].runs[0], { newText: 'Complex fixed', width: 300 });
  const nativePdf = await PDFDocument.load(input), originalContent = contentBytes(nativePdf, nativePdf.getPage(0));
  assert.equal(await removeIndependentPageText(nativePdf, nativePdf.getPage(0), [object]), false);
  assert.deepEqual(contentBytes(nativePdf, nativePdf.getPage(0)), originalContent, 'fallback decision is atomic');
  const output = await (await exportEditedPdf(file(input), { 0: [object] }, SCALE, [], [], pages => { flattened = pages; })).arrayBuffer();
  const after = await inspect(output), parsed = await PDFDocument.load(output);
  assert.deepEqual(flattened, [1]); assert.match(after[0].text, /Complex fixed/);
  assert.ok(!after[0].text.includes('Alpha original')); assert.ok(!after[0].text.includes('Keep this line'));
  assert.deepEqual(after[1].image, before[1].image);
  assert.equal(parsed.getForm().getTextField('name').getText(), 'Editable form');
  assert.equal(parsed.getPage(0).node.Annots().size(), 2);
  evidence('editor-complex.pdf', input); evidence('editor-complex-edited.pdf', output);
});
test('rotated and cropped pages keep edits at their original location, including screen nudges', async () => {
  for (const rotation of [0, 90, 180, 270]) {
    const input = await fixture({ rotation, crop: true }), before = await inspect(input), run = before[0].runs[0];
    const output = await (await exportEditedPdf(file(input), { 0: [edit(run, { newText: 'Replaced', x: run.xPx + 15, y: run.yPx + 30 })] }, SCALE)).arrayBuffer();
    const after = await inspect(output), replacement = after[0].runs.find(item => item.str === 'Replaced');
    assert.ok(replacement, 'replacement for rotation ' + rotation);
    const delta = rotation === 0 ? [10, -20] : rotation === 90 ? [20, 10] : rotation === 180 ? [-10, 20] : [-20, -10];
    assert.ok(Math.abs(replacement.xPt - run.xPt - delta[0]) < 0.02);
    assert.ok(Math.abs(replacement.yPt - run.yPt - delta[1]) < 0.02);
    assert.equal(after[0].width, before[0].width); assert.equal(after[0].height, before[0].height);
    assert.deepEqual(after[1].image, before[1].image);
    if (rotation === 90) evidence('editor-rotated.pdf', input);
  }
});
test('copy creates independent text and Unicode replacements round-trip without hidden originals', async () => {
  const input = await fixture(), before = await inspect(input);
  const replacement = edit(before[0].runs[0], { newText: 'नमस्ते भारत', width: 350 });
  const copy = copyEditorObject(replacement, 'copy', 60, 2);
  assert.equal(copy.type, 'text'); assert.equal('runId' in copy, false);
  const output = await (await exportEditedPdf(file(input), { 0: [replacement, copy] }, SCALE)).arrayBuffer();
  const after = await inspect(output);
  assert.ok(!after[0].text.includes('Alpha original'));
  assert.equal((after[0].text.match(/नमस्ते\s+भारत/g) ?? []).length, 2, after[0].text);
  const parsed = await PDFDocument.load(output);
  assert.ok(contentBytes(parsed, parsed.getPage(0)).toString().includes('3 Tr'));
  evidence('editor-unicode-edited.pdf', output);
});
test('full Hindi and Arabic edited lines retain every logical character at all page rotations', async () => {
  const phrases = ['ऑर्डर 0012 की कीमत 125 रुपये है।', 'الطلب 0012 يكلف 125 دولارًا. احتفظ بالإيصال.'];
  for (const rotation of [0, 90, 180, 270]) {
    const input = await fixture({ rotation, crop: true }), before = await inspect(input);
    const objects = phrases.map((newText, i) => {
      const run = before[0].runs[i], radians = run.rotation * Math.PI / 180, extra = (490 - run.widthPx) / 2;
      // Grow the rotated selection around its existing baseline, just as a
      // width change must do in the UI; do not move it beyond the CropBox.
      return edit(run, { newText, fontSizePt: 11, width: 490, x: run.xPx - (1 - Math.cos(radians)) * extra, y: run.yPx + Math.sin(radians) * extra, id: 'unicode-' + i });
    });
    const output = await (await exportEditedPdf(file(input), { 0: objects }, SCALE)).arrayBuffer();
    const after = await inspect(output);
    const text = after[0].items.map(item => item.str).join('').replace(/\s/g, '').normalize('NFC');
    for (const phrase of phrases) assert.ok(text.includes(phrase.replace(/\s/g, '').normalize('NFC')), `Rotation ${rotation}: ${text}`);
    assert.ok(!text.includes('Alpha original') && !text.includes('Keep this line'));
    assert.deepEqual(after[1].image, before[1].image);
    assert.equal(after[0].width, before[0].width); assert.equal(after[0].height, before[0].height);
    evidence('editor-unicode-full-' + rotation + '.pdf', output);
    evidence('editor-unicode-full-' + rotation + '.png', after[0].image);
    const authored = after[0].runs.find(run => run.str === phrases[0]);
    assert.ok(authored);
    let flattened;
    const again = await exportEditedPdf(file(output), { 0: [edit(authored, { newText: 'Updated 125' })] }, SCALE, [], [], pages => { flattened = pages; });
    const reopened = await inspect(await again.arrayBuffer());
    assert.deepEqual(flattened, [], 'Authored text stays independently editable at rotation ' + rotation);
    assert.ok(reopened[0].text.includes('Updated 125') && !reopened[0].text.includes('ऑर्डर'));
    assert.ok(reopened[0].text.replace(/\s/g, '').includes(phrases[1].replace(/\s/g, '')));
    assert.deepEqual(reopened[1].image, before[1].image);
  }
});
test('unknown authored-text versions fail atomically and cancelled Unicode saving returns no output', async () => {
  const input = await fixture(), before = await inspect(input);
  const original = await exportEditedPdf(file(input), { 0: [edit(before[0].runs[0], { newText: 'ऑर्डर', width: 300 })] }, SCALE);
  const bytes = await original.arrayBuffer(), rendered = await inspect(bytes), run = rendered[0].runs.find(run => run.str === 'ऑर्डर');
  const pdf = await PDFDocument.load(bytes), page = pdf.getPage(0);
  const content = contentBytes(pdf, page).toString().replace('/V 1', '/V 2');
  page.node.set(PDFName.of('Contents'), pdf.context.obj([pdf.context.register(pdf.context.flateStream(content))]));
  const unchanged = contentBytes(pdf, page);
  assert.equal(await removeIndependentPageText(pdf, page, [edit(run, { newText: 'Changed' })]), false);
  assert.deepEqual(contentBytes(pdf, page), unchanged);
  const previousFetch = global.fetch;
  let cancelled = false;
  global.fetch = async url => { if (url === '/tesseract/pdf.ttf') cancelled = true; return previousFetch(url); };
  try {
    await assert.rejects(exportEditedPdf(file(input), { 0: [edit(before[0].runs[0], { newText: 'ऑर्डर' })] }, SCALE, [], [], undefined, () => cancelled), /cancelled/);
  } finally { global.fetch = previousFetch; }
});
test('reopening and deleting authored Unicode removes visible ink as well as searchable text', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([600, 300]);
  const source = file(await pdf.save());
  const obj = { id: 'new', type: 'text', x: 60, y: 90, width: 700, height: 60, rotation: 0, zIndex: 1, text: 'ऑर्डर', fontSize: 28, fontWeight: 'normal', fontStyle: 'normal', color: '#000000', align: 'left' };
  const first = await exportEditedPdf(source, { 0: [obj] }, SCALE), before = await inspect(await first.arrayBuffer());
  const run = before[0].runs.find(run => run.str.trim() === obj.text);
  assert.ok(run);
  let flattened;
  const output = await exportEditedPdf(file(await first.arrayBuffer()), { 0: [edit(run, { newText: '' })] }, SCALE, [], [], value => { flattened = value; });
  const after = await inspect(await output.arrayBuffer());
  assert.deepEqual(flattened, []);
  assert.equal(after[0].text.trim(), '');
  const image = await canvas.loadImage(after[0].image), surface = canvas.createCanvas(image.width, image.height), ctx = surface.getContext('2d'); ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data;
  assert.equal(pixels.filter((value, index) => index % 4 !== 3 && value < 240).length, 0, 'No fragments of the old word may remain');
  evidence('editor-unicode-reopened-deleted.pdf', await output.arrayBuffer());
});
test('unsupported glyphs fail with a useful message instead of silently drawing boxes', async () => {
  const input = await fixture(), before = await inspect(input);
  await assert.rejects(exportEditedPdf(file(input), { 0: [edit(before[0].runs[0], { newText: '\u{1fae8}' })] }, SCALE), /does not support/);
});
test('replacement font overflow fails without an output and can recover with a fitting font size', async () => {
  const input = await fixture(), before = await inspect(input), newText = 'الطلب 0012 يكلف 125 دولارًا. احتفظ بالإيصال.';
  const object = edit(before[0].runs[0], { newText, width: 240, height: 24, fontSizePt: 11 });
  await assert.rejects(exportEditedPdf(file(input), { 0: [object] }, SCALE), /needs more room.*Widen/);
  const output = await exportEditedPdf(file(input), { 0: [{ ...object, fontSizePt: 7 }] }, SCALE);
  const after = await inspect(await output.arrayBuffer());
  assert.ok(after[0].text.replace(/\s/g, '').includes(newText.replace(/\s/g, '')));
  assert.deepEqual(after[1].image, before[1].image);
});
test('editor exports real glyphs for all additional OCR scripts, mixed-script words and bold text', async () => {
  const { createEditorTextWriter } = load('src/lib/editor/text-replacement.ts');
  const phrases = ['বাংলা ভাষা', 'ગુજરાતી ભાષા', 'ਪੰਜਾਬੀ ਭਾਸ਼ਾ', 'שלום עולם', 'ಕನ್ನಡ ಭಾಷೆ', 'മലയാളം ഭാഷ', 'தமிழ் மொழி', 'తెలుగు భాష', 'ภาษาไทย', '中文测试', '日本語テスト', '한국어 시험', 'Total金額125', 'المبلغ 250', 'राशि 250 रुपये', 'مرحبا بالعالم', 'שלום 250 עולם', 'Invoice المبلغ 250 USD'];
  const pdf = await PDFDocument.create();
  const standard = { normal: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold), italic: await pdf.embedFont(StandardFonts.HelveticaOblique), boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique) };
  const writer = await createEditorTextWriter(pdf, standard, phrases.join('\n'), { vectorText: true });
  for (const phrase of phrases) {
    const page = pdf.addPage([500, 250]);
    assert.ok(writer.width(phrase, 24) > 20);
    await writer.drawLine(page, phrase, 30, 180, 24, 0, '#000000');
    await writer.drawLine(page, phrase, 30, 110, 24, 0, '#000000', true);
  }
  writer.finish(); const bytes = await pdf.save();
  assert.ok(bytes.length < 5_000_000, `Subset font output unexpectedly large: ${bytes.length}`);
  const decoded = await inspect(bytes);
  assert.equal(decoded.length, phrases.length);
  for (const [i, page] of decoded.entries()) {
    assert.ok(page.items.length >= 2, phrases[i]);
    assert.ok(!page.text.includes('\u0000') && !page.text.includes('\ufffd'), page.text);
    assert.equal(page.text.replace(/\s/g, '').normalize('NFC'), phrases[i].repeat(2).replace(/\s/g, '').normalize('NFC'), phrases[i]);
    const image = await canvas.loadImage(page.image), surface = canvas.createCanvas(image.width, image.height), ctx = surface.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data;
    assert.ok(pixels.filter((value, index) => index % 4 !== 3 && value < 150).length > 300, phrases[i]);
  }
  for (const index of [9, 10, 11, 12]) assert.ok(decoded[index].items.map(item => item.str).join('').includes(phrases[index]), decoded[index].text);
  evidence('editor-all-scripts.pdf', bytes);
});
test('OCR line fitting matches the actual replacement fonts and respects cancellation', async () => {
  const { measureEditorOcrLine } = load('src/lib/editor/ocr-font-fit.ts');
  const { createEditorTextWriter } = load('src/lib/editor/text-replacement.ts');
  const phrases = ['राशि 125 रुपये', 'المبلغ 125', '合計 125 円', 'Total金額125'];
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const writer = await createEditorTextWriter(pdf, { normal, bold: normal, italic: normal, boldItalic: normal }, phrases.join('\n'), { vectorText: true });
  const controller = new AbortController();
  for (const phrase of phrases) assert.ok(Math.abs(await measureEditorOcrLine(phrase, controller.signal) - writer.width(phrase, 1)) < 1e-6, phrase);
  for (const phrase of ['PDF PILOT OCR TEST', 'WWWW iii 125', 'Invoice number 2026']) {
    const measured = await measureEditorOcrLine(phrase, controller.signal);
    assert.ok(measured + 1e-6 >= normal.widthOfTextAtSize(phrase, 1));
    assert.ok(measured + 1e-6 >= writer.width(phrase, 1));
  }
  controller.abort(); await assert.rejects(measureEditorOcrLine('cancelled', controller.signal), /cancelled/);
});
test('a normal-only CJK edit saves small valid subsets even when the bold font stays unused', async () => {
  const input = await fixture(), before = await inspect(input);
  const output = await (await exportEditedPdf(file(input), { 0: [edit(before[0].runs[0], { newText: '合計 250 円' })] }, SCALE)).arrayBuffer();
  assert.ok(output.byteLength < 3_000_000, output.byteLength);
  const decoded = await inspect(output);
  assert.ok(decoded[0].items.map(item => item.str).join('').includes('合計 250 円'));
  assert.deepEqual(decoded[1].image, before[1].image);
});
test('scan ink removal remains complete when the fitted replacement font is much smaller', async () => {
  const surface = canvas.createCanvas(800, 1000), ctx = surface.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 800, 1000); ctx.fillStyle = 'black'; ctx.font = '36px sans-serif'; ctx.fillText('SCANNED ORIGINAL', 80, 160);
  const pdf = await PDFDocument.create(), page = pdf.addPage([400, 500]); page.drawImage(await pdf.embedPng(surface.toBuffer('image/png')), { x: 0, y: 0, width: 400, height: 500 });
  const input = await pdf.save(), before = await inspect(input);
  const obj = { id: 'ink', type: 'existing-text-edit', runId: 'ocr-ink', x: 60, y: 110, width: 280, height: 12, rotation: 0, zIndex: 1, originalText: 'SCANNED ORIGINAL', newText: 'small', originalXPt: 40, originalYPt: 420, originalWidthPt: 210, originalHeightPt: 25, fontSizePt: 5, originalFontSizePt: 5, color: '#000000', coverColor: '#ffffff', source: 'ocr', originalInkQuad: [[38,438],[250,438],[250,416],[38,416]] };
  const output = await (await exportEditedPdf(file(input), { 0: [obj] }, SCALE)).arrayBuffer();
  const after = await inspect(output); assert.match(after[0].text, /small/);
  const image = await canvas.loadImage(after[0].image), c = canvas.createCanvas(image.width,image.height), x = c.getContext('2d'); x.drawImage(image,0,0);
  assert.ok(x.getImageData(60,94,300,15).data.every((v,i)=> i%4===3 || v>250));
  assert.notDeepEqual(after[0].image,before[0].image);
});
test('scanned page replacement removes the visible source pixels and keeps replacement selectable', async () => {
  const surface = canvas.createCanvas(800, 1000), ctx = surface.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 800, 1000); ctx.fillStyle = 'black'; ctx.font = '36px sans-serif'; ctx.fillText('SCANNED ORIGINAL', 80, 160);
  const pdf = await PDFDocument.create(), page = pdf.addPage([400, 500]);
  page.drawImage(await pdf.embedPng(surface.toBuffer('image/png')), { x: 0, y: 0, width: 400, height: 500 });
  const input = await pdf.save();
  const object = { id: 'scan', type: 'existing-text-edit', runId: 'ocr-0', x: 60, y: 97, width: 280, height: 30, rotation: 0, zIndex: 1, originalText: 'SCANNED ORIGINAL', newText: 'SCAN REPLACED', originalXPt: 40, originalYPt: 420, originalWidthPt: 210, originalHeightPt: 22, fontSizePt: 18, originalFontSizePt: 18, color: '#000000', coverColor: '#ffffff', source: 'ocr' };
  let flattened;
  const output = await (await exportEditedPdf(file(input), { 0: [object] }, SCALE, [], [], pages => { flattened = pages; })).arrayBuffer();
  assert.deepEqual(flattened, [1]); assert.match((await inspect(output))[0].text, /SCAN REPLACED/);
  evidence('editor-scanned.pdf', input); evidence('editor-scanned-edited.pdf', output);
});
