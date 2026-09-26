const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const ts = require('typescript');
// The shared browser PDF engine reads the workbook's native OOXML styles.
global.DOMParser = require('@xmldom/xmldom').DOMParser;
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const XLSX = require('xlsx');
const { xml2js } = require('xml-js');
const { unzipSync, strFromU8 } = require('fflate');
const { inspectExcel, convertExcel, buildSheetXml, bundleExcelOutputs, DEFAULT_EXCEL_OPTIONS } = require('../src/lib/engines/excel-conversion-engine.ts');
const fixtures = path.join(os.tmpdir(), 'pdfpilot-excel-qa');
fs.mkdirSync(fixtures, { recursive: true });
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['Name', 'Name', '', '123', 'Amount', 'Active'],
  ['A & <B>', 'Second', 'Hindi: नमस्ते', 'line 1\nline 2', 123.45, true],
  ['Another', 'Duplicate heading', '', 'quote "value"', 0, false],
]), 'Sales');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Code', 'Count'], ['00123', 9]]), 'Inventory');
const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(path.join(fixtures, 'sample.xlsx'), bytes);
const file = new File([bytes], 'sample.xlsx');
const opts = (format, extra = {}) => ({ ...DEFAULT_EXCEL_OPTIONS, format, ...extra });

test('all sheets are inspected and exported without losing duplicate or blank headers', async () => {
  const inspection = await inspectExcel(file);
  assert.deepEqual(inspection.sheets.map((sheet) => sheet.name), ['Sales', 'Inventory']);
  const outputs = await convertExcel(file, opts('xml'));
  assert.equal(outputs.length, 2);
  const xml = await outputs[0].blob.text();
  const parsed = xml2js(xml, { compact: true });
  const row = parsed.rows.row[0];
  assert.equal(row.Name._text, 'A & <B>');
  assert.equal(row.Name_2._text, 'Second');
  assert.equal(row.field_3._text, 'Hindi: नमस्ते');
  assert.equal(row._123._text, 'line 1\nline 2');
  assert.equal(row.Amount._text, '123.45');
  assert.equal(row.Active._text, 'TRUE');
});

test('headerless and wider rows preserve every cell and invalid XML characters fail clearly', () => {
  const parsed = xml2js(buildSheetXml([['Title'], ['Data', 'Extra']], true), { compact: true });
  assert.equal(parsed.rows.row.field_2._text, 'Extra');
  const headerless = xml2js(buildSheetXml([['first', 'second']], false), { compact: true });
  assert.equal(headerless.rows.row.field_1._text, 'first');
  assert.throws(() => buildSheetXml([['A'], ['\u0001']], true), /cannot represent/);
});

test('selected sheet CSV retains leading zero strings', async () => {
  const outputs = await convertExcel(file, opts('csv', { sheets: ['Inventory'] }));
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].name, 'sample.csv');
  assert.match(await outputs[0].blob.text(), /00123,9/);
});

for (const format of ['ods', 'xls']) test(`${format} produces a readable workbook with selected data`, async () => {
  const [output] = await convertExcel(file, opts(format, { sheets: ['Inventory'] }));
  const reopened = XLSX.read(await output.blob.arrayBuffer());
  assert.deepEqual(reopened.SheetNames, ['Inventory']);
  assert.equal(reopened.Sheets.Inventory.A2.v, '00123');
  assert.equal(reopened.Sheets.Inventory.B2.v, 9);
});

test('XLS inputs work and renamed text files, empty files and no-sheet selections fail', async () => {
  const xls = XLSX.write(workbook, { type: 'buffer', bookType: 'biff8' });
  fs.writeFileSync(path.join(fixtures, 'legacy.xls'), xls);
  assert.equal((await convertExcel(new File([xls], 'legacy.xls'), opts('xml'))).length, 2);
  await assert.rejects(inspectExcel(new File(['not an excel workbook'], 'bad.xlsx')), /not a valid Excel/);
  fs.writeFileSync(path.join(fixtures, 'bad.xlsx'), 'not an excel workbook');
  await assert.rejects(inspectExcel(new File([], 'empty.xlsx')), /non-empty/);
  await assert.rejects(convertExcel(file, opts('xml', { sheets: [] })), /Select at least/);
  await assert.rejects(convertExcel(file, opts('xml', { sheets: ['Missing'] })), /no longer exists/);
});

test('Agile encrypted XLSX supports password retry and local export', async () => {
  const XlsxPopulate = require('xlsx-populate');
  const encrypted = await (await XlsxPopulate.fromDataAsync(bytes)).outputAsync({ password: 'test-password' });
  fs.writeFileSync(path.join(fixtures, 'locked.xlsx'), encrypted);
  const locked = new File([encrypted], 'locked.xlsx');
  await assert.rejects(inspectExcel(locked), /encrypted/);
  await assert.rejects(inspectExcel(locked, 'wrong'), /Could not unlock/);
  const [result] = await convertExcel(locked, opts('xml', { password: 'test-password', sheets: ['Inventory'] }));
  assert.match(await result.blob.text(), /00123/);
});

test('ZIP bundle preserves all files even with colliding names', async () => {
  const output = { name: 'same.xml', blob: new Blob(['<rows/>']) };
  const zip = await bundleExcelOutputs([output, output, { ...output, name: 'same_2.xml' }]);
  const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.equal(Object.keys(files).length, 3);
  assert.ok(Object.values(files).every((value) => strFromU8(value) === '<rows/>'));
});

test('PDF output opens with correct page count and selectable text', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => new Response(fs.readFileSync(path.join(__dirname, '../public', String(url))));
  try {
    const [output] = await convertExcel(file, opts('pdf', { sheets: ['Inventory'] }));
    const { PDFDocument } = require('pdf-lib');
    assert.equal((await PDFDocument.load(await output.blob.arrayBuffer())).getPageCount(), 1);
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(await output.blob.arrayBuffer()), useSystemFonts: true });
    const document = await task.promise;
    const text = (await (await document.getPage(1)).getTextContent()).items.map((item) => item.str).join(' ');
    assert.match(text, /00123/);
    assert.match(text, /Inventory/);
    await task.destroy?.();
    assert.ok(output.blob.size > 1000);
    fs.writeFileSync(path.join(fixtures, 'output.pdf'), new Uint8Array(await output.blob.arrayBuffer()));
  } finally { global.fetch = originalFetch; }
});

test('large workbook ranges and XLS limits fail instead of truncating', async () => {
  const large = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(large, { A1: { t: 's', v: 'test' }, '!ref': 'A1:ZZ1000' }, 'Huge');
  await assert.rejects(inspectExcel(new File([XLSX.write(large, { type: 'buffer' })], 'huge.xlsx')), /250,000/);
  large.Sheets.Huge['!ref'] = 'A1:JA2';
  await assert.rejects(convertExcel(new File([XLSX.write(large, { type: 'buffer' })], 'wide.xlsx'), opts('xls')), /256 columns/);
});
