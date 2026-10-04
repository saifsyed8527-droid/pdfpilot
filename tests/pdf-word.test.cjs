const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const { unzipSync, strFromU8 } = require('fflate');

function loadEngine(filename, overrides = {}, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const localRequire = name => overrides[name] ?? (name.startsWith('.') ? loadEngine(path.resolve(path.dirname(filename), name + '.ts'), overrides, cache) : require(name));
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const { convertPdfToWord, createWordFromPages } = loadEngine('src/lib/engines/pdf-word-engine.ts');
const page = (pageNumber, text = '') => ({ pageNumber, paragraphs: text ? [text] : [], paragraphStyles: text ? ['body'] : [] });
async function xml(blob) { return strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']); }
const file = new File(['test'], 'mixed.pdf', { type: 'application/pdf' });
function harness(pages, recognized = 'Scanned middle page') {
  const calls = { rendered: [], terminated: 0, destroyed: 0, created: 0, canvases: [] };
  const dependencies = {
    extractText: async () => structuredClone(pages),
    openRenderer: async () => ({ pageCount: pages.length, destroy: async () => { calls.destroyed++; }, render: async number => { calls.rendered.push(number); const canvas = { width: 120, height: 100 }; calls.canvases.push(canvas); return canvas; } }),
    createWorker: async () => { calls.created++; return { recognize: async () => ({ text: recognized, confidence: 99 }), terminate: async () => { calls.terminated++; } }; },
  };
  return { calls, dependencies };
}

test('Auto retains selectable pages and inserts OCR text in original page order', async () => {
  const { calls, dependencies } = harness([page(1, 'Selectable first'), page(2), page(3, 'Selectable last')]);
  const result = await convertPdfToWord(file, { mode: 'auto' }, dependencies);
  const document = await xml(result.blob);
  assert.ok(document.indexOf('Selectable first') < document.indexOf('Scanned middle page'));
  assert.ok(document.indexOf('Scanned middle page') < document.indexOf('Selectable last'));
  assert.equal((document.match(/w:type="page"/g) || []).length, 2);
  assert.deepEqual(calls.rendered, [2]);
  assert.equal(result.usedOcr, true);
  assert.deepEqual(result.unrecognizedPages, []);
  assert.equal(calls.terminated, 1); assert.equal(calls.destroyed, 1);
  assert.equal(calls.canvases[0].width, 0);
  assert.ok(!document.includes('<w:drawing>'), 'output contains editable text, not page screenshots');
});

test('selectable-only Auto never starts OCR or rendering', async () => {
  const { calls, dependencies } = harness([page(1, 'Editable text')]);
  const result = await convertPdfToWord(file, { mode: 'auto' }, dependencies);
  assert.equal(result.usedOcr, false); assert.equal(calls.created, 0);
  assert.deepEqual(calls.rendered, []); assert.match(await xml(result.blob), /Editable text/);
});

test('No OCR rejects mixed pages instead of silently dropping scanned content', async () => {
  const { calls, dependencies } = harness([page(1, 'Cover'), page(2)]);
  await assert.rejects(convertPdfToWord(file, { mode: 'text' }, dependencies), /page 2.*Choose Auto/);
  assert.equal(calls.created, 0);
});

test('forced OCR processes every page and returns editable paragraphs', async () => {
  const { calls, dependencies } = harness([page(1, 'Existing'), page(2)]);
  dependencies.extractText = async () => { throw new Error('must not extract in forced mode'); };
  const result = await convertPdfToWord(file, { mode: 'ocr' }, dependencies);
  assert.deepEqual(calls.rendered, [1, 2]); assert.equal(calls.created, 1);
  assert.equal((await xml(result.blob)).includes('Existing'), false);
});

test('blank pages retain breaks, identify no-text pages, and all-empty documents fail', async () => {
  const mixed = harness([page(1, 'Cover'), page(2)], '');
  const result = await convertPdfToWord(file, { mode: 'auto' }, mixed.dependencies);
  assert.deepEqual(result.unrecognizedPages, [2]);
  assert.match(await xml(result.blob), /w:type="page"/);
  const empty = harness([page(1)], '');
  await assert.rejects(convertPdfToWord(file, { mode: 'auto' }, empty.dependencies), /No readable text/);
  assert.equal(empty.calls.terminated, 1); assert.equal(empty.calls.destroyed, 1);
  await assert.rejects(convertPdfToWord(file, { mode: 'auto' }, harness([]).dependencies), /no pages/);
});

test('cancel during OCR returns no stale download and releases worker/renderer/canvas', async () => {
  const { calls, dependencies } = harness([page(1), page(2)]);
  let cancelled = false;
  dependencies.createWorker = async () => ({ recognize: async () => { cancelled = true; return { text: 'Too late', confidence: 99 }; }, terminate: async () => { calls.terminated++; } });
  assert.equal(await convertPdfToWord(file, { mode: 'auto', isCancelled: () => cancelled }, dependencies), null);
  assert.deepEqual(calls.rendered, [1]); assert.equal(calls.terminated, 1); assert.equal(calls.destroyed, 1);
  assert.equal(calls.canvases[0].width, 0);
});

test('OCR failure returns no partial DOCX, releases resources, and a fresh retry succeeds', async () => {
  const { calls, dependencies } = harness([page(1, 'Cover'), page(2)]);
  const createWorker = dependencies.createWorker;
  dependencies.createWorker = async () => ({ recognize: async () => { throw new Error('OCR failure'); }, terminate: async () => { calls.terminated++; } });
  await assert.rejects(convertPdfToWord(file, { mode: 'auto' }, dependencies), /OCR failure/);
  assert.equal(calls.terminated, 1); assert.equal(calls.destroyed, 1);
  dependencies.createWorker = createWorker;
  assert.match(await xml((await convertPdfToWord(file, { mode: 'auto' }, dependencies)).blob), /Scanned middle page/);
});

test('real mixed PDF fixture reproduces old omission and passes PDF.js + English OCR + DOCX inspection', async () => {
  const canvasModule = require('@napi-rs/canvas');
  global.DOMMatrix ??= canvasModule.DOMMatrix;
  global.ImageData ??= canvasModule.ImageData;
  global.Path2D ??= canvasModule.Path2D;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { PDFDocument } = require('pdf-lib');
  const { createWorker } = require('tesseract.js');
  const { extractPdfText } = loadEngine('src/lib/pdf-text-extraction.ts', { './pdfjs': { loadPdfjs: async () => pdfjs } });
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]).drawText('SELECTABLE COVER ALPHA', { x: 40, y: 650, size: 24 });
  const scan = canvasModule.createCanvas(1224, 1584);
  const ctx = scan.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, scan.width, scan.height);
  ctx.fillStyle = 'black'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('SCANNED ATTACHMENT BRAVO', 80, 260);
  const image = await pdf.embedPng(scan.toBuffer('image/png'));
  pdf.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  pdf.addPage([612, 792]).drawText('SELECTABLE END CHARLIE', { x: 40, y: 650, size: 24 });
  const input = new File([await pdf.save()], 'mixed-text-scan.pdf', { type: 'application/pdf' });
  const extracted = await extractPdfText(input);
  assert.deepEqual(extracted.map(p => p.paragraphs.length), [1, 0, 1]);
  const before = await createWordFromPages(extracted);
  assert.ok(!(await xml(before)).includes('SCANNED ATTACHMENT BRAVO'), 'the previous whole-document text branch omitted the scanned page');
  const rendered = [];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-word-ocr-'));
  const dependencies = {
    extractText: extractPdfText,
    openRenderer: async source => {
      const loadingTask = pdfjs.getDocument({ data: await source.arrayBuffer() });
      const doc = await loadingTask.promise;
      return { pageCount: doc.numPages, destroy: () => loadingTask.destroy(), render: async number => {
        rendered.push(number); const page = await doc.getPage(number); const viewport = page.getViewport({ scale: 2.6 });
        const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas;
      } };
    },
    createWorker: async () => {
      const worker = await createWorker('eng', 1, { langPath: path.resolve('public/tesseract'), cachePath: scratch });
      return { recognize: async canvas => { const { data } = await worker.recognize(canvas.toBuffer('image/png')); return { text: data.text, confidence: data.confidence }; }, terminate: () => worker.terminate() };
    },
  };
  try {
    const result = await convertPdfToWord(input, { mode: 'auto' }, dependencies);
    const document = await xml(result.blob);
    assert.deepEqual(rendered, [2]);
    assert.match(document, /SCANNED ATTACHMENT BRAVO/);
    assert.ok(document.indexOf('SELECTABLE COVER ALPHA') < document.indexOf('SCANNED ATTACHMENT BRAVO'));
    assert.ok(document.indexOf('SCANNED ATTACHMENT BRAVO') < document.indexOf('SELECTABLE END CHARLIE'));
    assert.equal((document.match(/w:type="page"/g) || []).length, 2);
    const entries = Object.keys(unzipSync(new Uint8Array(await result.blob.arrayBuffer())));
    assert.equal(entries.some(name => name.startsWith('word/media/')), false);
    if (process.env.PDFPILOT_WORD_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.PDFPILOT_WORD_EVIDENCE_DIR, { recursive: true });
      for (const [name, blob] of [['mixed-input.pdf', input], ['before-missing-page.docx', before], ['after-mixed-pages.docx', result.blob]]) fs.writeFileSync(path.join(process.env.PDFPILOT_WORD_EVIDENCE_DIR, name), Buffer.from(await blob.arrayBuffer()));
      fs.writeFileSync(path.join(process.env.PDFPILOT_WORD_EVIDENCE_DIR, 'after-document.xml'), document);
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
