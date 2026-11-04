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
const { inspectExcelWorkbook, inspectExcelSheetChoices, convertExcelFileToPdf } = require('../src/lib/engines/excel-to-pdf-engine.ts');
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

// Independently generated BIFF8 workbook (xlwt). It includes formatted
// currency and dates, a merged heading, hidden cells and a very hidden sheet.
const legacyBytes = fs.readFileSync(path.join(__dirname, 'fixtures/excel-legacy-receipt.xls'));
const legacyFile = () => new File([legacyBytes], 'receipt-2003.xls');
function changeLegacyRecord(change) {
  const cfb = XLSX.CFB.read(legacyBytes, { type: 'buffer' });
  const entry = XLSX.CFB.find(cfb, '/Workbook');
  const stream = Buffer.from(entry.content);
  const offsets = [];
  for (let pos = 0; pos + 4 <= stream.length;) {
    const id = stream.readUInt16LE(pos), size = stream.readUInt16LE(pos + 2);
    offsets.push({ pos, id, size });
    pos += size + 4;
  }
  change(stream, offsets);
  entry.content = stream;
  return new File([XLSX.CFB.write(cfb, { type: 'buffer' })], 'fixture.xls');
}

test('Excel 97–2003 exports visible sheets and formatted cells, with hidden sheets opt-in', async () => {
  const file = legacyFile();
  assert.deepEqual(await inspectExcelSheetChoices(file), [
    { name: 'Receipt', hidden: false }, { name: 'Notes', hidden: false }, { name: 'Internal', hidden: true },
    { name: 'Diagram', hidden: true },
  ]);
  const output = await readPdf(await convert(file));
  assert.equal(output.pages.length, 2);
  assert.ok(output.pdf.getPage(0).getWidth() > output.pdf.getPage(0).getHeight());
  assert.equal(output.pdf.getPage(1).getWidth(), 612);
  for (const value of ['Novemberreceipt', '0012', 'USD125.00', '2026-11-04', 'TRUE', 'Keepthisline']) assert.ok(output.text.includes(value), value);
  for (const hidden of ['HIDDENROW', 'HIDDENCOLUMN', 'Internalonly']) assert.ok(!output.text.includes(hidden), hidden);
  const chosen = await readPdf(await convert(file, ['Internal', 'Notes']));
  assert.equal(chosen.pages.length, 2);
  assert.match(chosen.pages[0].replace(/\s/g, ''), /Internalonly/);
  assert.match(chosen.pages[1].replace(/\s/g, ''), /Keepthisline/);
  await assert.rejects(convert(file, ['Diagram']), /Diagram.*drawings/);
});

test('XLSX also starts with visible sheets and preserves explicit hidden-sheet selection', async () => {
  const workbook = bookOf(XLSX.utils.aoa_to_sheet([['Public report']]), 'Visible');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Internal only']]), 'Hidden');
  workbook.Workbook = { Sheets: [{ name: 'Visible', Hidden: 0 }, { name: 'Hidden', Hidden: 1 }] };
  const file = fileOf(workbook);
  assert.equal((await inspectExcelSheetChoices(file))[1].hidden, true);
  assert.doesNotMatch((await readPdf(await convert(file))).text, /Internal/);
  assert.match((await readPdf(await convert(file, ['Hidden']))).text, /Internalonly/);
});

test('cell-only XLS files with an empty drawing group retain their real web links', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Receipt', 'Website'], ['0012', 'Open receipt']]);
  const url = 'https://example.com/receipt';
  sheet.B2.l = { Target: url };
  sheet['!cols'] = [{ width: 18 }, { width: 24 }];
  const binary = XLSX.write(bookOf(sheet), { type: 'buffer', bookType: 'biff8' });
  const result = await readPdf(await convert(new File([binary], 'exported.xls')));
  assert.match(result.text, /0012Openreceipt/);
  const action = result.pdf.getPage(0).node.Annots().lookup(0).lookup(PDFName.of('A'));
  assert.equal(action.lookup(PDFName.of('URI'), PDFString).decodeText(), url);
});

test('XLS with an unsupported drawing can still export a different selected sheet', async () => {
  const file = changeLegacyRecord((stream, records) => {
    // Mark the first sheet's print header as a legacy header picture. Its
    // length stays unchanged so the second sheet's actual BOF still matches.
    const firstSheet = records.filter(r => r.id === 0x0809)[1].pos;
    const header = records.find(r => r.pos > firstSheet && r.id === 0x0014);
    stream.writeUInt16LE(0x0866, header.pos);
  });
  await assert.rejects(convert(file), /Receipt.*drawings/);
  const selected = await readPdf(await convert(file, ['Notes']));
  assert.equal(selected.pages.length, 1);
  assert.match(selected.text, /Keepthisline/);
});

test('XLS rejects encryption, unsupported versions and damaged BIFF boundaries before conversion', async () => {
  await assert.rejects(inspectExcelWorkbook(changeLegacyRecord((stream, records) => {
    stream.writeUInt16LE(0x002f, records[1].pos);
  })), /encrypted/);
  await assert.rejects(inspectExcelWorkbook(changeLegacyRecord(stream => stream.writeUInt16LE(0x0500, 4))), /older Excel/);
  await assert.rejects(inspectExcelWorkbook(changeLegacyRecord(stream => stream.writeUInt16LE(0xffff, 2))), /damaged/);
  const bad = new File([legacyBytes.subarray(0, 92)], 'cut.xls');
  await assert.rejects(inspectExcelWorkbook(bad));
  await assert.rejects(convert(legacyFile(), undefined, undefined, () => true), /Cancelled/);
  assert.equal((await readPdf(await convert(legacyFile(), ['Notes']))).pages.length, 1);
});

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
