const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { loadTs } = require('./load-ts.cjs');
const { visibleContentRange, wrapExcelText, excelColumnPoints, safeExcelLink, checkExcelArchiveEntry } = loadTs('src/lib/engines/excel-pdf-layout.ts');
const range = sheet => visibleContentRange(sheet, XLSX.utils.decode_cell);

test('formatted empty tails do not create hundreds of PDF pages', () => {
  const sheet = { '!ref': 'A1:X1000', A1: { v: 'Header' }, G7: { v: 'Last content' }, X1000: { t: 'z', s: { fgColor: { rgb: 'FFFFFF' } } } };
  assert.deepEqual(range(sheet), { s: { r: 0, c: 0 }, e: { r: 6, c: 6 } });
});
test('zero, false, formulas and hidden rows/columns are handled deliberately', () => {
  const sheet = { A1: { v: 0 }, B2: { v: false }, C3: { f: '1+1' }, H9: { v: 'hidden' }, '!rows': { 8: { hidden: true } } };
  assert.deepEqual(range(sheet).e, { r: 2, c: 2 });
  sheet['!cols'] = { 2: { hidden: true } };
  assert.deepEqual(range(sheet).e, { r: 1, c: 1 });
});
test('only populated merges extend print bounds; style-only merges do not', () => {
  const sheet = { A1: { v: 'Merged title' }, C4: { v: 'Last' }, '!merges': [XLSX.utils.decode_range('A1:D2'), XLSX.utils.decode_range('B3:X1000')] };
  assert.deepEqual(range(sheet), XLSX.utils.decode_range('A1:D4'));
  assert.equal(range({ '!ref': 'A1:X1000', A1: { t: 'z' } }), null);
});
test('long URLs wrap within the cell without losing or abbreviating characters', () => {
  const text = 'https://example.com/path/' + 'abcdefghijklmnopqrstuvwxyz'.repeat(10) + '?id=123&keep=true';
  const lines = wrapExcelText(text, x => x.length, 23);
  assert.ok(lines.length > 8);
  assert.ok(lines.every(x => x.length <= 23));
  assert.equal(lines.join(''), text);
});
test('paragraphs, blank lines and text well beyond the old 8-line cap survive', () => {
  const text = Array.from({length:100}, (_, i) => `Line ${i} has words`).join('\n') + '\n\nLast line';
  const lines = wrapExcelText(text, x => x.length, 12);
  assert.ok(lines.every(x => x.length <= 12));
  assert.equal(lines.join(' ').replace(/\s/g, ''), text.replace(/\s/g, ''));
  assert.ok(lines.includes(''));
  assert.ok(lines.includes('Last line'));
});
test('spreadsheet widths become points instead of falsely inferred pixels', () => {
  assert.equal(excelColumnPoints(89.43), 469.5);
  assert.equal(excelColumnPoints(24), 126);
  assert.equal(excelColumnPoints(0), 3);
});
test('links allow normal web and email links but no script/file/data/credentials', () => {
  assert.equal(safeExcelLink('https://example.com/?a=1&b=2'), 'https://example.com/?a=1&b=2');
  assert.equal(safeExcelLink('mailto:hello@example.com'), 'mailto:hello@example.com');
  for (const target of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', 'https://user:pass@example.com', undefined]) assert.equal(safeExcelLink(target), null);
});
test('archive expansion limits are checked before XML/media extraction', () => {
  assert.doesNotThrow(() => checkExcelArchiveEntry('xl/workbook.xml', 100, 3, 900));
  for (const args of [['../escape', 1, 1, 1], ['/escape', 1, 1, 1], ['xl/a', 100, 10001, 100], ['xl/a', 65*1024*1024, 1, 65*1024*1024], ['xl/a', 1, 1, 257*1024*1024]]) assert.throws(() => checkExcelArchiveEntry(...args), /too large|invalid/);
});
