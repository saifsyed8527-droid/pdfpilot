const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const XLSX = require('xlsx');
const sharp = require('sharp');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
const { PDFDocument, PDFName } = require('pdf-lib');
global.DOMParser = require('@xmldom/xmldom').DOMParser;
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { excelPackage } = require('../src/lib/engines/excel-package.ts');
const { readExcelChart, excelChartOption } = require('../src/lib/engines/excel-chart-model.ts');
const { readExcelGraphics, excelGeometry, graphicsContentRange, positionExcelGraphic } = require('../src/lib/engines/excel-pdf-graphics.ts');
const { excelImageFormat, validateExcelSvg } = require('../src/lib/engines/excel-graphic-renderer.ts');
const { readExcelMetadata } = require('../src/lib/engines/excel-pdf-metadata.ts');
const { convertExcelFileToPdf } = require('../src/lib/engines/excel-to-pdf-engine.ts');
const { convertExcel, DEFAULT_EXCEL_OPTIONS } = require('../src/lib/engines/excel-conversion-engine.ts');
const xml = source => new DOMParser().parseFromString(source, 'application/xml').documentElement;
const workbook = (sheet = XLSX.utils.aoa_to_sheet([['Month', 'Budget', 'Actual'], ['Jan', 10, 15], ['Feb', 0, 20], ['Mar', 30, 25]])) => { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Data'); return book; };
const chartXml = (kind, ser, extra = '', axes = '') => `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>QA chart title</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:${kind}>${extra}${ser}</c:${kind}>${axes}</c:plotArea><c:legend><c:legendPos val="b"/></c:legend></c:chart></c:chartSpace>`;
const refSeries = (col = 'B') => `<c:ser><c:tx><c:strRef><c:f>'Data'!$${col}$1</c:f></c:strRef></c:tx><c:cat><c:strRef><c:f>'Data'!$A$2:$A$4</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>'Data'!$${col}$2:$${col}$4</c:f></c:numRef></c:val></c:ser>`;
const readChart = (text, book = workbook()) => readExcelChart(xml(text), book, XLSX, excelPackage(book), 'Data');
const optionFor = chart => excelChartOption(chart, 600, 400, (f, v) => XLSX.SSF.format(f, v));
const originalFetch = global.fetch, fontCache = new Map();
test.before(() => { global.fetch = async url => new Response(fs.readFileSync(path.join(__dirname, '../public', String(url)))); });
test.after(() => { global.fetch = originalFetch; });

test('saved chart references preserve series names, category order, zeroes and values', () => {
  const chart = readChart(chartXml('barChart', refSeries() + refSeries('C')));
  assert.equal(chart.title, 'QA chart title');
  assert.deepEqual(chart.groups[0].series.map(s => s.name), ['Budget', 'Actual']);
  assert.deepEqual(chart.groups[0].series[0].values, [10, 0, 30]);
  assert.deepEqual(chart.groups[0].series[0].categories, ['Jan', 'Feb', 'Mar']);
  assert.deepEqual(optionFor(chart).series[0].data.map(d => d.value), [10, 0, 30]);
});

test('sparse chart caches keep missing positions instead of shifting category pairs', () => {
  const ser = '<c:ser><c:val><c:numRef><c:f>[1]external!$B$1:$B$3</c:f><c:numCache><c:formatCode>0.0%</c:formatCode><c:ptCount val="3"/><c:pt idx="0"><c:v>0</c:v></c:pt><c:pt idx="2"><c:v>0.3</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser>';
  const s = readChart(chartXml('lineChart', ser)).groups[0].series[0];
  assert.deepEqual(s.values, [0, null, 0.3]);
  assert.equal(s.format, '0.0%');
});

test('hidden chart cells are excluded only when plot-visible-only is enabled', () => {
  const book = workbook(); book.Sheets.Data['!rows'] = [,,{ hidden: true }];
  const source = chartXml('barChart', refSeries());
  assert.deepEqual(readChart(source, book).groups[0].series[0].values, [10, 30]);
  assert.deepEqual(readChart(source.replace('</c:chart>', '<c:plotVisOnly val="0"/></c:chart>'), book).groups[0].series[0].values, [10, 0, 30]);
});

test('bar direction, stacking and percentage stacking use the right axes and data', () => {
  const normal = optionFor(readChart(chartXml('barChart', refSeries(), '<c:barDir val="bar"/>')));
  assert.equal(normal.xAxis[0].type, 'value'); assert.equal(normal.yAxis[0].type, 'category');
  const stack = optionFor(readChart(chartXml('barChart', refSeries() + refSeries('C'), '<c:grouping val="stacked"/>')));
  assert.equal(stack.series[0].stack, stack.series[1].stack);
  const percent = optionFor(readChart(chartXml('barChart', refSeries() + refSeries('C'), '<c:grouping val="percentStacked"/>')));
  assert.equal(percent.series[0].data[0].value, 40); assert.equal(percent.series[1].data[0].value, 60);
  assert.equal(percent.series[0].data[1].value, 0); assert.equal(percent.series[1].data[1].value, 100);
});

for (const [kind, output] of [['barChart', 'bar'], ['lineChart', 'line'], ['areaChart', 'line'], ['pieChart', 'pie'], ['doughnutChart', 'pie'], ['radarChart', 'radar']]) test(`${kind} has a real plotted series, not a placeholder`, () => {
  const o = optionFor(readChart(chartXml(kind, refSeries())));
  assert.equal(o.series[0].type, output); assert.ok(o.series[0].data.length);
  if (kind === 'areaChart') assert.ok(o.series[0].areaStyle);
  if (kind === 'doughnutChart') assert.ok(o.series[0].radius[0] > 0);
  if (kind === 'radarChart') assert.equal(o.radar.indicator.length, 3);
});

test('scatter/bubble use numeric X values and preserve bubble sizes', () => {
  const s = refSeries().replace('<c:cat>', '<c:xVal>').replace('</c:cat>', '</c:xVal>').replace('$A$', '$C$').replace('$A$', '$C$').replace('<c:val>', '<c:yVal>').replace('</c:val>', '</c:yVal>').replace('</c:ser>', '<c:bubbleSize><c:numLit><c:ptCount val="3"/><c:pt idx="0"><c:v>1</c:v></c:pt><c:pt idx="1"><c:v>4</c:v></c:pt><c:pt idx="2"><c:v>9</c:v></c:pt></c:numLit></c:bubbleSize></c:ser>');
  for (const kind of ['scatterChart', 'bubbleChart']) {
    const o = optionFor(readChart(chartXml(kind, s)));
    assert.equal(o.xAxis[0].type, 'value'); assert.deepEqual(o.series[0].data[0], [15, 10, 1]);
    if (kind === 'bubbleChart') assert.ok(o.series[0].symbolSize([30, 25, 9]) > o.series[0].symbolSize([10, 15, 1]));
  }
});

test('combo charts keep their secondary value axis even when category axPos is left', () => {
  const axis = (kind, id, position) => `<c:${kind}><c:axId val="${id}"/><c:axPos val="${position}"/></c:${kind}>`;
  const source = chartXml('barChart', refSeries(), '<c:axId val="10"/><c:axId val="20"/>', axis('catAx', '10', 'l') + axis('valAx', '20', 'l') + axis('valAx', '30', 'r'))
    .replace('</c:plotArea>', `<c:lineChart><c:axId val="10"/><c:axId val="30"/>${refSeries('C')}</c:lineChart></c:plotArea>`);
  const option = optionFor(readChart(source));
  assert.equal(option.xAxis.length, 1); assert.equal(option.yAxis.length, 2);
  assert.equal(option.series[0].yAxisIndex, 0); assert.equal(option.series[1].yAxisIndex, 1);
  assert.equal(option.yAxis[1].position, 'right');
});

test('radar indicators share one numeric scale rather than normalizing every category', () => {
  const option = optionFor(readChart(chartXml('radarChart', refSeries() + refSeries('C'))));
  assert.equal(new Set(option.radar.indicator.map(i => i.max)).size, 1);
  assert.equal(new Set(option.radar.indicator.map(i => i.min)).size, 1);
  assert.deepEqual(option.series[0].data[0].value, [10, 0, 30]);
});

test('scatter honours line-only and marker-only series without creating an empty chart', () => {
  const series = refSeries().replaceAll('c:cat', 'c:xVal').replaceAll('c:val', 'c:yVal').replaceAll('$A$', '$C$');
  const line = series.replace('</c:ser>', '<c:spPr><a:ln/></c:spPr><c:marker><c:symbol val="none"/></c:marker></c:ser>');
  assert.equal(optionFor(readChart(chartXml('scatterChart', line, '<c:scatterStyle val="marker"/>'))).series[0].type, 'line');
  const marker = series.replace('</c:ser>', '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/></c:marker></c:ser>');
  assert.equal(optionFor(readChart(chartXml('scatterChart', marker, '<c:scatterStyle val="lineMarker"/>'))).series[0].type, 'scatter');
});

test('chart titles, date labels, value formats and workbook accent colours are retained', () => {
  const book = workbook();
  book.Sheets.Data.A2 = { t: 'n', v: 45292, z: 'mmm yyyy' };
  book.Sheets.Data.B2.z = '0.0%';
  book.files = { 'xl/theme/theme1.xml': { content: '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="FF1234"/></a:accent1></a:clrScheme></a:themeElements></a:theme>' } };
  const chart = readChart(chartXml('barChart', refSeries()).replace(/<c:title>.*?<\/c:title>/, '<c:title><c:tx><c:strRef><c:f>Data!$B$1</c:f></c:strRef></c:tx></c:title>'), book);
  assert.equal(chart.title, 'Budget'); assert.equal(chart.groups[0].series[0].categories[0], 'Jan 2024');
  assert.equal(chart.groups[0].series[0].format, '0.0%'); assert.equal(chart.groups[0].series[0].colour, 'FF1234');
});

test('3D, missing external data, missing formula caches and excessive points fail explicitly', () => {
  assert.throws(() => readChart(chartXml('bar3DChart', refSeries())), /native PDF export/);
  assert.throws(() => readChart(chartXml('barChart', refSeries().replaceAll("'Data'", "'[1]External'"))), /no saved data/);
  const book = workbook(); book.Sheets.Data.B2 = { t: 'n', f: 'SUM(1,2)' };
  assert.throws(() => readChart(chartXml('barChart', refSeries()), book), /no saved result/);
  assert.throws(() => readChart(chartXml('barChart', '<c:ser><c:val><c:numLit><c:ptCount val="20001"/></c:numLit></c:val></c:ser>')), /too many/);
});

async function pictureFile(sheet, anchors) {
  const bytes = XLSX.write(workbook(sheet), { type: 'buffer', bookType: 'xlsx' }), entries = unzipSync(bytes);
  entries['xl/worksheets/sheet1.xml'] = strToU8(strFromU8(entries['xl/worksheets/sheet1.xml']).replace('</worksheet>', '<drawing r:id="rIdQA"/></worksheet>'));
  entries['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdQA" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
  const pic = '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="QA logo"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rIdPic"/></xdr:blipFill><xdr:spPr/></xdr:pic>';
  const from = '<xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>';
  entries['xl/drawings/drawing1.xml'] = strToU8(`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors || `<xdr:oneCellAnchor>${from}<xdr:ext cx="2540000" cy="1270000"/>${pic}<xdr:clientData/></xdr:oneCellAnchor>`}</xdr:wsDr>`);
  entries['xl/drawings/_rels/drawing1.xml.rels'] = strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPic" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>');
  entries['xl/media/logo.png'] = await sharp({ create: { width: 200, height: 100, channels: 4, background: '#16a34a' } }).png().toBuffer();
  return { file: new File([zipSync(entries)], 'pictures.xlsx'), entries, pic, from };
}
function imageCount(pdf) { return pdf.getPages().map(p => p.node.Resources().lookup(PDFName.of('XObject'))).filter(Boolean).reduce((n, dict) => n + dict.entries().filter(([, ref]) => pdf.context.lookup(ref).dict.get(PDFName.of('Subtype'))?.toString() === '/Image').length, 0); }

test('image-only sheets generate a real PDF image at the saved anchor and original size', async () => {
  const { file } = await pictureFile({ '!ref': 'A1:X1000' });
  const book = XLSX.read(await file.arrayBuffer(), { bookFiles: true, cellStyles: true });
  const meta = readExcelMetadata(book, XLSX.utils.decode_range).get('Data');
  const g = readExcelGraphics(book, 'Data', meta, XLSX);
  assert.equal(g.length, 1);
  const geometry = excelGeometry(book.Sheets.Data, meta), rect = positionExcelGraphic(g[0], geometry).rect;
  assert.equal(rect.width, 200); assert.equal(rect.height, 100); assert.equal(rect.y, 30);
  assert.ok(graphicsContentRange(null, g, geometry));
  const pdf = await PDFDocument.load(await (await convertExcelFileToPdf(file, undefined, undefined, undefined, fontCache)).arrayBuffer());
  assert.equal(pdf.getPageCount(), 1); assert.equal(imageCount(pdf), 1);
});

test('original XLSX drawing parts survive the alternate Excel converter PDF path', async () => {
  const { file } = await pictureFile({ A1: { t: 's', v: 'Visible data' }, '!ref': 'A1' });
  const [output] = await convertExcel(file, { ...DEFAULT_EXCEL_OPTIONS, format: 'pdf' });
  assert.equal(imageCount(await PDFDocument.load(await output.blob.arrayBuffer())), 1);
});

test('two-cell anchors resize with rows; one-cell anchors keep their image size', async () => {
  const base = await pictureFile({ '!ref': 'A1' });
  const sheet = { '!rows': [{ hpt: 15 }, { hpt: 20 }, { hpt: 30 }] };
  const geometry = excelGeometry(sheet), measured = excelGeometry(sheet, undefined, new Map([[2, 100]]));
  const common = { kind: 'image', name: 'QA', rotation: 0, anchor: { kind: 'twoCellAnchor', from: { row: 2, col: 1, x: 2, y: 3 }, to: { row: 5, col: 4, x: 0, y: 0 }, editAs: 'twoCell' } };
  const original = positionExcelGraphic(common, geometry).rect;
  assert.equal(positionExcelGraphic(common, measured, geometry).rect.height, original.height + 70);
  assert.equal(positionExcelGraphic({ ...common, anchor: { ...common.anchor, editAs: 'oneCell' } }, measured, geometry).rect.height, original.height);
  assert.ok(base.file.size > 0);
});

test('standalone chart sheets use a full-page drawing for their zero-extent anchor', () => {
  const book = workbook();
  const drawing = '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="0" cy="0"/><xdr:graphicFrame><c:chart r:id="chart"/></xdr:graphicFrame></xdr:absoluteAnchor></xdr:wsDr>';
  const rel = (id, target) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Target="${target}"/></Relationships>`;
  book.files = Object.fromEntries(Object.entries({
    'xl/chartsheets/sheet1.xml': '<chartsheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><drawing r:id="drawing"/></chartsheet>',
    'xl/chartsheets/_rels/sheet1.xml.rels': rel('drawing', '../drawings/drawing1.xml'),
    'xl/drawings/drawing1.xml': drawing,
    'xl/drawings/_rels/drawing1.xml.rels': rel('chart', '../charts/chart1.xml'),
    'xl/charts/chart1.xml': chartXml('barChart', refSeries()),
  }).map(([k, content]) => [k, { content }]));
  const [graphic] = readExcelGraphics(book, 'Chart only', { partPath: 'xl/chartsheets/sheet1.xml' }, XLSX);
  assert.equal(graphic.kind, 'chart'); assert.ok(graphic.anchor.width > 700); assert.ok(graphic.anchor.height > 500);
  assert.ok(graphicsContentRange(null, [graphic], excelGeometry({})));
});

test('linked and missing pictures never trigger fetch or silent success', async () => {
  const { entries } = await pictureFile({ '!ref': 'A1' });
  entries['xl/drawings/_rels/drawing1.xml.rels'] = strToU8(strFromU8(entries['xl/drawings/_rels/drawing1.xml.rels']).replace('Target="../media/logo.png"', 'Target="https://example.com/private.png" TargetMode="External"'));
  await assert.rejects(convertExcelFileToPdf(new File([zipSync(entries)], 'linked.xlsx')), /linked, not embedded/);
});

test('safe SVG is accepted but remote, script, and entity content is rejected', () => {
  assert.doesNotThrow(() => validateExcelSvg(strToU8('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" fill="red"/></svg>')));
  for (const content of ['<script>alert(1)</script>', '<image href="https://example.com/private.png"/>', '<foreignObject/>', '<style>@import "https://example.com/style";</style>', '<rect onclick="alert(1)"/>']) assert.throws(() => validateExcelSvg(strToU8(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`)), /active|external|static/);
  assert.throws(() => validateExcelSvg(strToU8('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>')), /unsafe/);
  assert.doesNotThrow(() => validateExcelSvg(strToU8('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="colour"/></defs><rect fill="url(&quot;#colour&quot;)" width="10" height="10"/></svg>')));
});

test('image decoders validate dimensions before embedding', async () => {
  const png = await sharp({ create: { width: 80, height: 50, channels: 3, background: 'blue' } }).png().toBuffer();
  const jpg = await sharp(png).jpeg().toBuffer();
  assert.equal(excelImageFormat(png), 'png'); assert.equal(excelImageFormat(jpg), 'jpeg');
  const oversized = Buffer.from(png); oversized.writeUInt32BE(200000, 16);
  assert.throws(() => excelImageFormat(oversized), /too large/);
});
