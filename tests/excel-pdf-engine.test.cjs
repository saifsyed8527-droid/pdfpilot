const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const XLSX = require('xlsx');
const XlsxPopulate = require('xlsx-populate');
const { PDFDocument, PDFName, PDFString, PDFRawStream } = require('pdf-lib');
const { inflateSync } = require('node:zlib');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
global.DOMParser = require('@xmldom/xmldom').DOMParser;
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { inspectExcelWorkbook, convertExcelFileToPdf } = require('../src/lib/engines/excel-to-pdf-engine.ts');
const { readExcelMetadata, excelCellStyle } = require('../src/lib/engines/excel-pdf-metadata.ts');
const originalFetch = global.fetch;
const fontCache = new Map();
test.before(() => { global.fetch = async url => new Response(fs.readFileSync(path.join(__dirname, '../public', String(url)))); });
test.after(() => { global.fetch = originalFetch; });
const fileOf = workbook => new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'fixture.xlsx');
const bookOf = (sheet, name = 'Data') => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheet, name); return wb; };
const convert = (file, selected, progress, cancelled) => convertExcelFileToPdf(file, selected, progress, cancelled, fontCache);
async function readPdf(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await task.promise;
  const pages = [], outOfBounds = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i), items = (await page.getTextContent()).items;
    pages.push(items.map(item => item.str || '').join('\n'));
    for (const item of items) if (item.str && (item.transform[4] < 0 || item.transform[4] + item.width > page.view[2] + 0.5 || item.transform[5] < 0 || item.transform[5] > page.view[3])) outOfBounds.push(item.str);
  }
  await task.destroy();
  assert.deepEqual(outOfBounds, [], 'all text stays inside its PDF page');
  return { pdf, pages, text: pages.join('\n').replace(/\s/g, '') };
}

test('empty formatting tails generate one page, full URLs and safe clickable links', async () => {
  const url = 'https://example.com/' + 'long-url-section/'.repeat(30) + '?keep=1&all=2';
  const sheet = { A1: { t: 's', v: 'Heading' }, A2: { t: 's', v: url, l: { Target: url } }, A3: { t: 'n', v: 0 }, B3: { t: 'b', v: false }, '!ref': 'A1:X1000', '!cols': [{ width: 60 }] };
  const output = await readPdf(await convert(fileOf(bookOf(sheet))));
  assert.equal(output.pages.length, 1);
  assert.ok(output.text.includes(url));
  assert.ok(output.text.includes('0'));
  assert.ok(output.text.includes('FALSE'));
  const annot = output.pdf.getPage(0).node.Annots().lookup(0);
  assert.equal(annot.lookup(PDFName.of('A')).lookup(PDFName.of('URI'), PDFString).decodeText(), url);
});

test('long cell text continues over pages without an eight-line cap or clipping', async () => {
  const lines = Array.from({ length: 120 }, (_, i) => `Unique line ${String(i).padStart(3, '0')}`);
  const sheet = { A1: { t: 's', v: lines.join('\n') }, '!ref': 'A1', '!cols': [{ width: 35 }] };
  const output = await readPdf(await convert(fileOf(bookOf(sheet))));
  assert.ok(output.pages.length >= 3);
  for (const line of lines) assert.ok(output.text.includes(line.replace(/\s/g, '')), line);
});

test('visible data, merged spans, cached formulas and selected sheets are preserved', async () => {
  const sheet = {
    A1: { t: 's', v: 'Merged title' }, A2: { t: 's', v: 'Visible' }, B2: { t: 'n', f: '1-1', v: 0 },
    A3: { t: 's', v: 'Hidden row marker' }, C2: { t: 's', v: 'Hidden column marker' },
    '!ref': 'A1:C1000', '!merges': [XLSX.utils.decode_range('A1:B1')], '!rows': [,,{ hidden: true }], '!cols': [{ width: 25 }, { width: 20 }, { hidden: true }],
  };
  const workbook = bookOf(sheet, 'Chosen');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Excluded sheet marker']]), 'Other');
  const file = fileOf(workbook);
  assert.deepEqual(await inspectExcelWorkbook(file), ['Chosen', 'Other']);
  const output = await readPdf(await convert(file, ['Chosen']));
  assert.equal(output.pages.length, 1);
  for (const value of ['Mergedtitle', 'Visible', '0']) assert.ok(output.text.includes(value));
  for (const value of ['Hiddenrowmarker', 'Hiddencolumnmarker', 'Excludedsheetmarker']) assert.ok(!output.text.includes(value));
  await assert.rejects(convert(file, []), /Select at least/);
  await assert.rejects(convert(file, ['Missing']), /no longer exists/);
});

test('native OOXML styles retain fill, font size, alignment and border colours', async () => {
  const workbook = await XlsxPopulate.fromBlankAsync();
  workbook.sheet(0).cell('A1').value('Styled').style({ fill: 'FFFF00', bold: true, italic: true, fontSize: 16, fontColor: 'FF0000', horizontalAlignment: 'center', border: { style: 'medium', color: '008800' } });
  workbook.sheet(0).column('A').width(30);
  const bytes = await workbook.outputAsync();
  const parsed = XLSX.read(bytes, { type: 'buffer', cellStyles: true, bookFiles: true });
  const metadata = readExcelMetadata(parsed, XLSX.utils.decode_range);
  const style = excelCellStyle(metadata.get(parsed.SheetNames[0]), 'A1', 0, 0);
  assert.equal(style.fill.toUpperCase(), 'FFFF00');
  assert.equal(style.font.size, 16); assert.equal(style.font.bold, true); assert.equal(style.font.italic, true);
  assert.equal(style.alignment.horizontal, 'center'); assert.equal(style.borders.bottom.color.toUpperCase(), '008800');
  const result = await readPdf(await convert(new File([bytes], 'styled.xlsx')));
  assert.ok(result.text.includes('Styled'));
  const contents = result.pdf.getPage(0).node.Contents().asArray().map(ref => result.pdf.context.lookup(ref, PDFRawStream)).map(stream => inflateSync(stream.getContents()).toString()).join('\n');
  assert.match(contents, /1 1 0 rg/, 'yellow fill is actually drawn into the PDF');
  const entries = unzipSync(bytes);
  entries['xl/styles.xml'] = strToU8(strFromU8(entries['xl/styles.xml']).replace(/rgb="(?:FF)?FFFF00"/i, 'indexed="22"'));
  const indexed = XLSX.read(zipSync(entries), { type: 'array', cellStyles: true, bookFiles: true });
  const indexedStyle = excelCellStyle(readExcelMetadata(indexed, XLSX.utils.decode_range).get(indexed.SheetNames[0]), 'A1', 0, 0);
  assert.equal(indexedStyle.fill.toUpperCase(), 'C0C0C0', 'indexed palette entries must not cycle through the first eight colours');
});

test('missing formula results, empty workbooks and cancellation do not produce false success', async () => {
  const formula = fileOf(bookOf({ A1: { t: 'n', f: '1+1' }, '!ref': 'A1' }));
  await assert.rejects(convert(formula), /no saved result/);
  await assert.rejects(convert(fileOf(bookOf({ '!ref': 'A1' }))), /do not contain printable/);
  const file = fileOf(bookOf(XLSX.utils.aoa_to_sheet([['Data']])));
  await assert.rejects(convert(file, undefined, undefined, () => true), /Cancelled/);
  await assert.rejects(inspectExcelWorkbook(new File(['not a spreadsheet'], 'renamed.xlsx')), /not an unencrypted XLSX/);
});

test('unsupported objects and impossible page layouts fail explicitly instead of silently losing content', async () => {
  const source = fileOf(bookOf(XLSX.utils.aoa_to_sheet([['Chart workbook']])));
  const entries = unzipSync(new Uint8Array(await source.arrayBuffer()));
  entries['xl/worksheets/sheet1.xml'] = strToU8(strFromU8(entries['xl/worksheets/sheet1.xml']).replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>'));
  await assert.rejects(convert(new File([zipSync(entries)], 'drawing.xlsx')), /missing or linked drawing/);
  entries['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
  entries['xl/drawings/drawing1.xml'] = strToU8('<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>');
  const emptyDrawing = await readPdf(await convert(new File([zipSync(entries)], 'empty-drawing.xlsx')));
  assert.equal(emptyDrawing.pages.length, 1, 'an empty Google Sheets drawing part must not block conversion');
  assert.ok(emptyDrawing.text.includes('Chartworkbook'));
  const narrow = { A1: { t: 's', v: 'Too narrow' }, '!ref': 'A1', '!cols': [{ width: 0.5 }] };
  await assert.rejects(convert(fileOf(bookOf(narrow))), /too narrow/);
  const merged = { A1: { t: 's', v: 'Tall merge' }, '!ref': 'A1:B100', '!merges': [XLSX.utils.decode_range('A1:B100')] };
  await assert.rejects(convert(fileOf(bookOf(merged))), /vertically merged block/);
});
