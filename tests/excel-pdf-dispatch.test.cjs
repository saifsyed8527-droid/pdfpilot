const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { PDFDocument, PDFName } = require('pdf-lib');
const fixture = require('./fixtures/excel-pdf-boundary.cjs');
global.DOMParser = require('@xmldom/xmldom').DOMParser;
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(filename).href));
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const { runExcelWorker } = require('../src/lib/engines/excel-worker-client.ts');
const { convertExcel, DEFAULT_EXCEL_OPTIONS } = require('../src/lib/engines/excel-conversion-engine.ts');
const originalFetch = global.fetch, originalWorker = global.Worker;
let created = 0;
test.beforeEach(() => {
  created = 0;
  global.Worker = class { constructor() { created++; throw new Error('PDF must not use a DOM-less worker'); } };
  global.fetch = async url => new Response(fs.readFileSync(path.join(__dirname, '../public', String(url))));
});
test.after(() => { global.fetch = originalFetch; global.Worker = originalWorker; });
const options = { ...DEFAULT_EXCEL_OPTIONS, format: 'pdf' };

test('alternate PDF dispatch uses the DOM renderer and preserves actual image, text, sheet order and count', async () => {
  const [output] = await runExcelWorker('convert', await fixture(false), options, new AbortController().signal);
  assert.equal(created, 0);
  const bytes = new Uint8Array(await output.blob.arrayBuffer()), pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  const images = pdf.getPages().flatMap(page => page.node.Resources().lookup(PDFName.of('XObject'))?.entries() || []).filter(([, ref]) => pdf.context.lookup(ref).dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
  assert.equal(images.length, 1);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const document = await task.promise;
  try {
    const pages = [];
    for (let i = 1; i <= document.numPages; i++) pages.push((await (await document.getPage(i)).getTextContent()).items.map(item => item.str || '').join(' '));
    assert.match(pages[0].replace(/\s/g, ''), /FIRSTSHEETALPHA/); assert.match(pages[0], /42/);
    assert.match(pages[1].replace(/\s/g, ''), /SECONDSHEETBRAVO/); assert.match(pages[1], /73/);
  } finally { await task.destroy(); }
});

test('pre-aborted PDF conversion never reads the file or creates a worker', async () => {
  const controller = new AbortController(); controller.abort();
  const file = { arrayBuffer() { throw new Error('must not read'); } };
  await assert.rejects(runExcelWorker('convert', file, options, controller.signal), { name: 'AbortError' });
  await assert.rejects(convertExcel(file, options, undefined, () => true), { name: 'AbortError' });
  assert.equal(created, 0);
});

test('cancel during PDF input preparation settles immediately, removes listener, suppresses stale progress and allows retry', async () => {
  const source = await fixture(false), bytes = await source.arrayBuffer();
  let release, began;
  const started = new Promise(resolve => { began = resolve; });
  const delayed = new File([bytes], 'delayed.xlsx');
  delayed.arrayBuffer = () => { began(); return new Promise(resolve => { release = resolve; }); };
  const controller = new AbortController(), signal = controller.signal;
  let listeners = 0;
  const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (...args) => { if (args[0] === 'abort') listeners++; return add(...args); };
  signal.removeEventListener = (...args) => { if (args[0] === 'abort') listeners--; return remove(...args); };
  const progress = [];
  const pending = runExcelWorker('convert', delayed, options, signal, value => progress.push(value));
  await started; controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(listeners, 0);
  release(bytes); await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(progress, []);
  const [retry] = await runExcelWorker('convert', source, options, new AbortController().signal);
  assert.equal((await PDFDocument.load(await retry.blob.arrayBuffer())).getPageCount(), 2);
  assert.equal(created, 0);
});

test('inspection and XML still use a dedicated worker and cancellation terminates it', async () => {
  const instances = [];
  global.Worker = class { constructor() { this.terminated = false; instances.push(this); } postMessage(data) { this.request = data; } terminate() { this.terminated = true; } };
  const controller = new AbortController();
  const pending = runExcelWorker('convert', await fixture(false), { ...options, format: 'xml' }, controller.signal);
  assert.equal(instances[0].request.type, 'convert'); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(instances[0].terminated, true);
  const inspection = runExcelWorker('inspect', await fixture(false), options, new AbortController().signal);
  instances[1].onmessage({ data: { type: 'result', result: { sheets: [], preview: [] } } });
  assert.deepEqual(await inspection, { sheets: [], preview: [] }); assert.equal(instances[1].terminated, true);
});
