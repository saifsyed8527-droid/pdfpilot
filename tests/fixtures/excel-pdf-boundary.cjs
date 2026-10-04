const XLSX = require('xlsx');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
const sharp = require('sharp');

// Synthetic local workbook: selectable cells, an embedded PNG and optionally
// a real saved-data chart; the second sheet proves worksheet order.
module.exports = async function excelPdfBoundaryFixture(withChart = true) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['FIRST SHEET ALPHA', 'Value'], ['Synthetic', 42]]), 'First');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['SECOND SHEET BRAVO'], ['Final value', 73]]), 'Second');
  for (const name of book.SheetNames) book.Sheets[name]['!cols'] = [{ wch: 30 }, { wch: 10 }];
  const entries = unzipSync(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
  entries['xl/worksheets/sheet1.xml'] = strToU8(strFromU8(entries['xl/worksheets/sheet1.xml']).replace('</worksheet>', '<drawing r:id="draw"/></worksheet>'));
  const relations = content => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${content}</Relationships>`;
  const relation = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  entries['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(relations(relation('draw', 'drawing', '../drawings/drawing1.xml')));
  const anchor = (row, width, height, object) => `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${width * 12700}" cy="${height * 12700}"/>${object}<xdr:clientData/></xdr:oneCellAnchor>`;
  const picture = '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Synthetic green picture"/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="pic"/></xdr:blipFill><xdr:spPr/></xdr:pic>';
  const chart = '<xdr:graphicFrame><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Saved values chart"/></xdr:nvGraphicFramePr><a:graphic><a:graphicData><c:chart r:id="chart"/></a:graphicData></a:graphic></xdr:graphicFrame>';
  entries['xl/drawings/drawing1.xml'] = strToU8(`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchor(4, 100, 50, picture)}${withChart ? anchor(10, 360, 240, chart) : ''}</xdr:wsDr>`);
  entries['xl/drawings/_rels/drawing1.xml.rels'] = strToU8(relations(relation('pic', 'image', '../media/picture.png') + (withChart ? relation('chart', 'chart', '../charts/chart1.xml') : '')));
  entries['xl/media/picture.png'] = await sharp({ create: { width: 200, height: 100, channels: 4, background: '#16a34a' } }).png().toBuffer();
  if (withChart) entries['xl/charts/chart1.xml'] = strToU8('<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>SAVED CHART CHARLIE</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:barChart><c:ser><c:tx><c:v>Amount</c:v></c:tx><c:cat><c:strLit><c:ptCount val="3"/><c:pt idx="0"><c:v>Jan</c:v></c:pt><c:pt idx="1"><c:v>Feb</c:v></c:pt><c:pt idx="2"><c:v>Mar</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:ptCount val="3"/><c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt><c:pt idx="2"><c:v>30</c:v></c:pt></c:numLit></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>');
  return new File([zipSync(entries)], 'excel-pdf-boundary.xlsx');
};
