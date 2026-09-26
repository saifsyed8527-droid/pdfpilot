"use client";

import type { CellObject, WorkBook, WorkSheet } from "xlsx";
import type { PDFDocument, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import { loadUnicodeFonts, patchToUnicodeCmaps, resolveFont, trackDrawnText } from "./unicode-fonts";
import { checkExcelArchiveEntry, excelColumnPoints, safeExcelLink, visibleContentRange, wrapExcelText } from "./excel-pdf-layout";
import { excelCellStyle, readExcelMetadata, type ExcelSheetMetadata, type ExcelStyle } from "./excel-pdf-metadata";
import { excelGeometry, graphicsContentRange, positionExcelGraphic, readExcelGraphics, type ExcelGraphic } from "./excel-pdf-graphics";
import { drawExcelGraphic, prepareExcelGraphic } from "./excel-graphic-renderer";

const MARGIN = 24;
const TOP = 48;
const PADDING = 3;
type Opened = { XLSX: typeof import("xlsx"); workbook: WorkBook; metadata: Map<string, ExcelSheetMetadata> };
type Fonts = Awaited<ReturnType<typeof loadUnicodeFonts>>;
type PdfLib = typeof import("pdf-lib");
type PreparedCell = { x: number; width: number; top: number; height: number; lines: string[]; font: PDFFont; size: number; style: ExcelStyle; link: string | null; row: number; endRow: number };
type RowGroup = { height: number; cells: PreparedCell[]; rowCount: number };
// Sheet inspection and conversion share one parse. The File key is released
// when the user removes it; private workbook data is never persisted/uploaded.
const workbooks = new WeakMap<File, Promise<Opened>>();
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const checkCancelled = (cancelled?: () => boolean) => { if (cancelled?.()) throw new Error("Cancelled"); };

function openWorkbook(file: File): Promise<Opened> {
  const existing = workbooks.get(file);
  if (existing) return existing;
  const pending = (async () => {
    if (!file.size || file.size > 100 * 1024 * 1024) throw new Error("Choose a non-empty XLSX file smaller than 100 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("This file is not an unencrypted XLSX workbook. Open it in Excel and save a new XLSX copy without a password.");
    const { unzipSync } = await import("fflate");
    let count = 0, expanded = 0;
    // Read ZIP entry sizes before SheetJS allocates decompressed XML/media.
    unzipSync(bytes, { filter(entry) {
      expanded += entry.originalSize;
      checkExcelArchiveEntry(entry.name, entry.originalSize, ++count, expanded);
      return false;
    } });
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(bytes, { type: "array", cellFormula: true, cellStyles: true, cellText: true, cellDates: true, bookFiles: true, dense: false });
    if (!workbook.SheetNames.length) throw new Error("This workbook does not contain any sheets.");
    return { XLSX, workbook, metadata: readExcelMetadata(workbook, XLSX.utils.decode_range) };
  })();
  workbooks.set(file, pending);
  pending.catch(() => workbooks.delete(file));
  return pending;
}

export async function inspectExcelWorkbook(file: File): Promise<string[]> {
  return (await openWorkbook(file)).workbook.SheetNames;
}

function cellText(cell: CellObject | undefined, XLSX: typeof import("xlsx")): string {
  if (!cell) return "";
  if (cell.f && (cell.v === undefined || cell.v === null)) {
    throw new Error("A formula has no saved result. Recalculate the workbook in Excel or Google Sheets, save it as XLSX, then try again.");
  }
  if (cell.w !== undefined) return String(cell.w);
  if (cell.v === undefined || cell.v === null) return "";
  return XLSX.utils.format_cell(cell);
}

function pdfColour(lib: PdfLib, hex: string) {
  return lib.rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

function columnWidth(sheet: WorkSheet, column: number, meta?: ExcelSheetMetadata) {
  const info = sheet["!cols"]?.[column];
  // SheetJS's inferred MDW/wpx can vary with the other widths in the file.
  // The saved character width is stable and retains column proportions.
  if (info?.width !== undefined) return excelColumnPoints(info.width);
  if (info?.wpx !== undefined) return Math.max(3, info.wpx * 0.75);
  return excelColumnPoints(meta?.defaultWidth || 8.43);
}

function drawCell(pdf: PDFDocument, page: PDFPage, cell: PreparedCell, y: number, height: number, lines: string[], lib: PdfLib, continuation = false) {
  const { x, width, style, size, font } = cell;
  page.drawRectangle({ x, y, width, height, color: pdfColour(lib, style.fill || "FFFFFF"), borderColor: pdfColour(lib, "D9DEE5"), borderWidth: 0.25 });
  for (const [side, border] of Object.entries(style.borders || {})) {
    const start = { x: side === "right" ? x + width : x, y: side === "top" ? y + height : y };
    const end = side === "left" || side === "right" ? { x: start.x, y: y + height } : { x: x + width, y: start.y };
    page.drawLine({ start, end, thickness: border.width, color: pdfColour(lib, border.color) });
  }
  const textHeight = lines.length * size * 1.3;
  const spare = Math.max(0, height - PADDING * 2 - textHeight);
  const vertical = continuation ? "top" : style.alignment?.vertical || "bottom";
  const offset = vertical === "center" ? spare / 2 : vertical === "bottom" ? spare : 0;
  const colour = pdfColour(lib, style.font?.color || (cell.link ? "0000FF" : "111827"));
  lines.forEach((line, index) => {
    if (!line) return;
    const textWidth = font.widthOfTextAtSize(line, size);
    const horizontal = style.alignment?.horizontal;
    const textX = horizontal === "right" ? x + width - PADDING - textWidth : horizontal === "center" ? x + (width - textWidth) / 2 : x + PADDING;
    const textY = y + height - PADDING - size - index * size * 1.3 - offset;
    trackDrawnText(font, line);
    page.drawText(line, { x: textX, y: textY, font, size, color: colour });
    if (style.font?.underline) page.drawLine({ start: { x: textX, y: textY - 1 }, end: { x: textX + textWidth, y: textY - 1 }, thickness: 0.4, color: colour });
  });
  if (cell.link && lines.some(Boolean)) {
    const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y, x + width, y + height], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: lib.PDFString.of(cell.link) } });
    page.node.addAnnot(pdf.context.register(annotation));
  }
}

async function renderSheet(pdf: PDFDocument, sheet: WorkSheet, name: string, XLSX: Opened["XLSX"], meta: ExcelSheetMetadata | undefined, fonts: Fonts, lib: PdfLib, progress: (fraction: number) => void, cancelled: (() => boolean) | undefined, graphics: ExcelGraphic[], imageCache: Map<string, PDFImage>, fontCache: Map<string, Uint8Array>) {
  const cellRange = visibleContentRange(sheet, XLSX.utils.decode_cell);
  const geometry = excelGeometry(sheet, meta);
  const range = graphicsContentRange(cellRange, graphics, geometry);
  if (!range) return;
  if ((range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1) > 1_000_000) throw new Error(`The sheet “${name}” is too spread out to print safely. Move distant cells closer together or export a smaller sheet.`);
  const columns = Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) => range.s.c + i).filter(c => !sheet["!cols"]?.[c]?.hidden);
  const rows = Array.from({ length: range.e.r - range.s.r + 1 }, (_, i) => range.s.r + i).filter(r => !sheet["!rows"]?.[r]?.hidden);
  const widths = columns.map(c => columnWidth(sheet, c, meta));
  const rawGraphics = graphics.map(g => positionExcelGraphic(g, geometry)).filter(g => g.rect.width > 0 && g.rect.height > 0);
  const originX = Math.min(geometry.x(range.s.c), ...rawGraphics.map(g => g.bounds.x));
  const totalWidth = Math.max(geometry.x(range.e.c + 1), ...rawGraphics.map(g => g.bounds.x + g.bounds.width)) - originX;
  let paperWidth = 595.28, paperHeight = 841.89;
  if (meta?.paperSize === 1) { paperWidth = 612; paperHeight = 792; }
  if (meta?.paperSize === 5) { paperWidth = 612; paperHeight = 1008; }
  if (meta?.paperSize === 8) { paperWidth = 841.89; paperHeight = 1190.55; }
  if (meta?.orientation === "landscape" || (meta?.orientation !== "portrait" && totalWidth > paperWidth - MARGIN * 2)) [paperWidth, paperHeight] = [paperHeight, paperWidth];
  // Keep wide tables together. A wide PDF canvas is preferable to unreadably
  // tiny text or unrelated horizontal page fragments that lose row context.
  const scale = Math.min(1, Math.max(0.65, (paperWidth - MARGIN * 2) / totalWidth));
  const pageWidth = Math.max(paperWidth, totalWidth * scale + MARGIN * 2);
  if (pageWidth > 14400) throw new Error(`The sheet “${name}” has too many wide columns. Split it into smaller sheets before converting.`);
  const contentHeight = paperHeight - TOP - MARGIN;
  const xs: number[] = [];
  widths.forEach((width, index) => { xs[index] = index ? xs[index - 1] + widths[index - 1] * scale : MARGIN + (geometry.x(range.s.c) - originX) * scale; });
  const merges = sheet["!merges"] || [];
  const groups: RowGroup[] = [];
  const measuredRows = new Map<number, number>();
  for (let index = 0; index < rows.length;) {
    checkCancelled(cancelled);
    const first = rows[index];
    let end = first;
    // Connected vertical merges must be laid out as one block, not duplicated
    // once per covered cell or sliced at an arbitrary row boundary.
    for (let changed = true; changed;) {
      changed = false;
      for (const merge of merges) {
        if (merge.s.r <= end && merge.e.r >= first && merge.s.c <= range.e.c && merge.e.c >= range.s.c) {
          const nextEnd = Math.min(range.e.r, merge.e.r);
          if (nextEnd > end) { end = nextEnd; changed = true; }
        }
      }
    }
    const groupRows: number[] = [];
    while (index < rows.length && rows[index] <= end) groupRows.push(rows[index++]);
    const heights = groupRows.map(r => Math.max(3, sheet["!rows"]?.[r]?.hpt ?? ((sheet["!rows"]?.[r]?.hpx ?? (meta?.defaultHeight || 15) / 0.75) * 0.75)) * scale);
    const cells: PreparedCell[] = [];
    for (let ri = 0; ri < groupRows.length; ri++) {
      const row = groupRows[ri];
      for (let ci = 0; ci < columns.length; ci++) {
        const column = columns[ci];
        const merge = merges.find(m => row >= m.s.r && row <= m.e.r && column >= m.s.c && column <= m.e.c);
        if (merge && (row !== merge.s.r || column !== merge.s.c)) continue;
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = sheet[address] as CellObject | undefined;
        const text = cellText(cell, XLSX);
        const style = excelCellStyle(meta, address, row, column);
        // Drawing bounds extend printing, not the worksheet's formatting tail.
        // Do not invent a grey cell grid around a chart-only/picture-only sheet.
        if (!text && !style.fill && !Object.keys(style.borders || {}).length && (!cellRange || row < cellRange.s.r || row > cellRange.e.r || column < cellRange.s.c || column > cellRange.e.c)) continue;
        if (!style.alignment?.horizontal && (cell?.t === "n" || cell?.t === "d")) style.alignment = { ...style.alignment, horizontal: "right" };
        const size = Math.max(1, style.font?.size || 11) * scale;
        if (size * 1.3 + PADDING * 2 > contentHeight) throw new Error(`A font in “${name}” is taller than a PDF page. Reduce its font size before converting.`);
        const font = resolveFont(fonts, text, Boolean(style.font?.bold), Boolean(style.font?.italic));
        const lastColumn = merge ? columns.findLastIndex(c => c <= merge.e.c) : ci;
        const width = widths.slice(ci, lastColumn + 1).reduce((a, b) => a + b, 0) * scale;
        const lines = wrapExcelText(text, value => font.widthOfTextAtSize(value, size), Math.max(1, width - PADDING * 2));
        if (lines.some(line => font.widthOfTextAtSize(line, size) > width - PADDING * 2 + 0.01)) throw new Error(`Cell ${address} in “${name}” is too narrow for its text. Widen that column or reduce its font size before converting.`);
        const endRow = merge ? groupRows.findLastIndex(r => r <= merge.e.r) : ri;
        const currentHeight = heights.slice(ri, endRow + 1).reduce((a, b) => a + b, 0);
        heights[endRow] += Math.max(0, lines.length * size * 1.3 + PADDING * 2 - currentHeight);
        const link = safeExcelLink(cell?.l?.Target) || safeExcelLink(text);
        cells.push({ x: xs[ci], width, top: 0, height: 0, lines, font, size, style, link, row: ri, endRow });
      }
    }
    for (const cell of cells) {
      cell.top = heights.slice(0, cell.row).reduce((a, b) => a + b, 0);
      cell.height = heights.slice(cell.row, cell.endRow + 1).reduce((a, b) => a + b, 0);
    }
    groupRows.forEach((row, ri) => measuredRows.set(row, heights[ri] / scale));
    groups.push({ height: heights.reduce((a, b) => a + b, 0), cells, rowCount: groupRows.length });
    if (index % 25 === 0) { progress(0.2 * index / rows.length); await yieldToBrowser(); }
  }
  let page: PDFPage | undefined, cursor = 0;
  const newPage = () => {
    if (pdf.getPageCount() >= 1000) throw new Error("This workbook would exceed 1,000 PDF pages. Convert fewer sheets at a time.");
    page = pdf.addPage([pageWidth, paperHeight]); cursor = paperHeight - TOP;
    const font = resolveFont(fonts, name, true, false);
    const titleSize = Math.min(12, (pageWidth - MARGIN * 2) / Math.max(1, font.widthOfTextAtSize(name, 1)));
    trackDrawnText(font, name);
    page.drawText(name, { x: MARGIN, y: paperHeight - 28, size: titleSize, font, color: pdfColour(lib, "111827") });
  };
  if (rawGraphics.length) {
    const laidOut = excelGeometry(sheet, meta, measuredRows), originY = laidOut.y(range.s.r);
    const placed = graphics.map(g => positionExcelGraphic(g, laidOut, geometry)).filter(g => g.rect.width > 0 && g.rect.height > 0).map(g => ({
      ...g,
      rect: { x: MARGIN + (g.rect.x - originX) * scale, y: (g.rect.y - originY) * scale, width: g.rect.width * scale, height: g.rect.height * scale },
      bounds: { x: MARGIN + (g.bounds.x - originX) * scale, y: (g.bounds.y - originY) * scale, width: g.bounds.width * scale, height: g.bounds.height * scale },
    }));
    const paddingTop = Math.max(0, -Math.min(...placed.map(g => g.bounds.y)));
    placed.forEach(g => { g.rect.y += paddingTop; g.bounds.y += paddingTop; });
    let sheetHeight = paddingTop;
    const locatedGroups = groups.map(group => { const start = sheetHeight; sheetHeight += group.height; return { ...group, start, end: sheetHeight }; });
    sheetHeight = Math.max(sheetHeight, ...placed.map(g => g.bounds.y + g.bounds.height));
    // A page boundary may not bisect a picture, chart or merged row group.
    // Connected objects become one print block. Exceptionally tall blocks get
    // a taller PDF page instead of being clipped, shrunk to illegibility, or lost.
    const boundaries = [...new Set([...locatedGroups.map(g => g.end), sheetHeight])].sort((a, b) => a - b);
    const blocks: { start: number; end: number }[] = [];
    let start = 0;
    for (const end of boundaries) {
      if (placed.some(g => g.bounds.y < end - 0.01 && g.bounds.y + g.bounds.height > end + 0.01)) continue;
      blocks.push({ start, end }); start = end;
    }
    paperHeight = Math.max(paperHeight, ...blocks.map(b => b.end - b.start + TOP + MARGIN));
    if (paperHeight > 14400) throw new Error(`Overlapping drawings in “${name}” form a block taller than the PDF page limit. Separate those drawings before converting.`);
    let rendered = 0;
    for (const block of blocks) {
      checkCancelled(cancelled);
      if (!page || cursor - (block.end - block.start) < MARGIN - 0.01) newPage();
      for (const group of locatedGroups.filter(g => g.start >= block.start - 0.01 && g.end <= block.end + 0.01)) {
        for (const cell of group.cells) drawCell(pdf, page!, cell, cursor - (group.start - block.start) - cell.top - cell.height, cell.height, cell.lines, lib);
      }
      // Worksheet XML order is the drawing z-order. Repeated media is embedded
      // once per PDF, even when the same picture appears on multiple sheets.
      for (const item of placed.filter(g => g.bounds.y >= block.start - 0.01 && g.bounds.y + g.bounds.height <= block.end + 0.01)) {
        await yieldToBrowser(); checkCancelled(cancelled);
        const image = await prepareExcelGraphic(pdf, item.graphic, item.rect, imageCache, fontCache, (format, value) => XLSX.SSF.format(format, value));
        checkCancelled(cancelled);
        drawExcelGraphic(pdf, page!, item.graphic, image, { ...item.rect, y: cursor - (item.rect.y - block.start) - item.rect.height }, lib);
        rendered++;
      }
      cursor -= block.end - block.start;
      progress(0.2 + 0.8 * block.end / sheetHeight);
      await yieldToBrowser();
    }
    if (rendered !== placed.length) throw new Error("A spreadsheet graphic could not be placed completely. No partial PDF has been downloaded.");
    return;
  }
  for (let i = 0; i < groups.length; i++) {
    checkCancelled(cancelled);
    const group = groups[i];
    if (!page) newPage();
    if (group.height <= contentHeight) {
      if (cursor - group.height < MARGIN) newPage();
      for (const cell of group.cells) drawCell(pdf, page!, cell, cursor - cell.top - cell.height, cell.height, cell.lines, lib);
      cursor -= group.height;
    } else {
      if (group.rowCount > 1) throw new Error(`A vertically merged block in “${name}” is taller than a PDF page. Split that merge or reduce its font size before converting.`);
      // Long cells continue across as many pages as needed, with no 8-line or
      // 90-point truncation. Every column advances its own text cursor.
      const offsets = group.cells.map(() => 0);
      do {
        checkCancelled(cancelled);
        if (cursor - MARGIN < Math.max(...group.cells.map(c => c.size * 1.3 + PADDING * 2))) newPage();
        const available = cursor - MARGIN;
        const fragments = group.cells.map((cell, j) => cell.lines.slice(offsets[j], offsets[j] + Math.max(1, Math.floor((available - PADDING * 2) / (cell.size * 1.3)))));
        const height = Math.min(available, Math.max(PADDING * 2, ...fragments.map((lines, j) => lines.length * group.cells[j].size * 1.3 + PADDING * 2)));
        group.cells.forEach((cell, j) => { drawCell(pdf, page!, cell, cursor - height, height, fragments[j], lib, true); offsets[j] += fragments[j].length; });
        cursor -= height;
        if (group.cells.some((cell, j) => offsets[j] < cell.lines.length)) newPage();
        await yieldToBrowser();
      } while (group.cells.some((cell, j) => offsets[j] < cell.lines.length));
    }
    progress(0.2 + 0.8 * (i + 1) / groups.length);
    if (i % 20 === 0) await yieldToBrowser();
  }
}

export async function convertExcelFileToPdf(file: File, selectedSheets: string[] | undefined, onProgress?: (percent: number) => void, cancelled?: () => boolean, fontByteCache?: Map<string, Uint8Array>): Promise<Blob> {
  onProgress?.(2);
  const { XLSX, workbook, metadata } = await openWorkbook(file);
  checkCancelled(cancelled);
  const names = [...new Set(selectedSheets ?? workbook.SheetNames)];
  if (!names.length) throw new Error("Select at least one sheet to convert.");
  if (names.some(name => !workbook.SheetNames.includes(name))) throw new Error("A selected sheet no longer exists. Reload the workbook and choose its sheets again.");
  const graphics = new Map(names.map(name => [name, readExcelGraphics(workbook, name, metadata.get(name), XLSX)]));
  const allText = names.map(name => {
    const sheet = workbook.Sheets[name] || {};
    return [name, ...graphics.get(name)!.filter(g => g.kind === "chart").map(g => g.chart.text), ...Object.keys(sheet).filter(key => {
      if (!/^[A-Z]+[1-9][0-9]*$/.test(key)) return false;
      const { r, c } = XLSX.utils.decode_cell(key);
      return !sheet["!rows"]?.[r]?.hidden && !sheet["!cols"]?.[c]?.hidden;
    }).map(key => cellText(sheet[key], XLSX))].join(" ");
  }).join(" ");
  const lib = await import("pdf-lib");
  const pdf = await lib.PDFDocument.create();
  const fontCache = fontByteCache || new Map<string, Uint8Array>();
  const fonts = await loadUnicodeFonts(pdf, allText, fontCache);
  const imageCache = new Map<string, PDFImage>();
  onProgress?.(10);
  for (let i = 0; i < names.length; i++) {
    checkCancelled(cancelled);
    const name = names[i];
    await renderSheet(pdf, workbook.Sheets[name] || {}, name, XLSX, metadata.get(name), fonts, lib, fraction => onProgress?.(10 + 85 * (i + fraction) / names.length), cancelled, graphics.get(name)!, imageCache, fontCache);
  }
  checkCancelled(cancelled);
  if (!pdf.getPageCount()) throw new Error("The selected sheets do not contain printable cells, pictures or charts.");
  patchToUnicodeCmaps(fonts);
  const bytes = await pdf.save({ useObjectStreams: true });
  checkCancelled(cancelled);
  onProgress?.(100);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
