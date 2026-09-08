"use client";

import type { CellObject, WorkBook, WorkSheet } from "xlsx";
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { loadUnicodeFonts, patchToUnicodeCmaps, resolveFont, trackDrawnText } from "./unicode-fonts";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const PAGE_MARGIN = 24;
const TABLE_TOP = PAGE_HEIGHT - 52;
const TABLE_BOTTOM = 24;
const DEFAULT_ROW_HEIGHT = 20;
const FONT_SIZE = 8;
const CELL_PADDING = 4;
const MAX_COLUMN_WIDTH = 220;
const MIN_COLUMN_WIDTH = 44;

type Colour = { rgb?: string; indexed?: number; theme?: number };
type CellStyle = {
  // SheetJS Community Edition exposes fills directly on `cell.s` while
  // some styled-workbook producers keep them under `fill`. Support both.
  patternType?: string;
  fgColor?: Colour;
  bgColor?: Colour;
  fill?: { patternType?: string; fgColor?: Colour; bgColor?: Colour };
  font?: { bold?: boolean; italic?: boolean; sz?: number; color?: Colour };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: Record<string, { style?: string; color?: Colour }>;
};

function readColour(colour: Colour | undefined, fallback: string): string {
  const rgb = colour?.rgb?.replace(/^FF/i, "");
  if (rgb && /^[0-9a-f]{6}$/i.test(rgb)) return rgb;
  const indexed: Record<number, string> = {
    0: "000000", 1: "FFFFFF", 2: "FF0000", 3: "00FF00", 4: "0000FF",
    5: "FFFF00", 6: "FF00FF", 7: "00FFFF", 8: "000000", 9: "FFFFFF",
    10: "FF0000", 11: "00FF00", 12: "0000FF", 13: "FFFF00", 14: "FF00FF", 15: "00FFFF",
  };
  if (colour?.indexed !== undefined && indexed[colour.indexed]) return indexed[colour.indexed];
  return fallback;
}

function pdfColour(rgb: typeof import("pdf-lib").rgb, hex: string) {
  const clean = hex.replace("#", "").padStart(6, "0").slice(-6);
  return rgb(parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255);
}

async function openWorkbook(file: File): Promise<{ XLSX: typeof import("xlsx"); workbook: WorkBook }> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellFormula: true,
    cellStyles: true,
    cellText: true,
    cellDates: true,
    dense: false,
  });
  if (!workbook.SheetNames.length) throw new Error("This workbook does not contain any sheets.");
  return { XLSX, workbook };
}

export async function inspectExcelWorkbook(file: File): Promise<string[]> {
  const { workbook } = await openWorkbook(file);
  return workbook.SheetNames;
}

function cellText(cell: CellObject | undefined, XLSX: typeof import("xlsx")): string {
  if (!cell) return "";
  if (cell.t === "e") {
    return cell.f ? `=${cell.f}` : (cell.w || "Formula error");
  }
  if (cell.w !== undefined && cell.w !== "") return String(cell.w);
  if (cell.v !== undefined && cell.v !== null) {
    try { return XLSX.utils.format_cell(cell); } catch { return String(cell.v); }
  }
  return cell.f ? `=${cell.f}` : "";
}

function columnWidth(sheet: WorkSheet, column: number): number {
  const info = sheet["!cols"]?.[column] as { wpx?: number; wch?: number } | undefined;
  const guessed = info?.wpx ?? (info?.wch !== undefined ? info.wch * 7 + 8 : 76);
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, guessed));
}

function splitLines(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 8): string[] {
  if (!text) return [];
  const output: string[] = [];
  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words.length ? words : [""]) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        output.push(line);
        line = word;
      } else {
        line = candidate;
      }
      if (output.length >= maxLines) break;
    }
    if (line && output.length < maxLines) output.push(line);
    if (output.length >= maxLines) break;
  }
  if (output.length === maxLines && output[maxLines - 1].length > 3) {
    output[maxLines - 1] = `${output[maxLines - 1].slice(0, -3)}...`;
  }
  return output;
}

function horizontalChunks(widths: number[], availableWidth: number): Array<{ start: number; end: number; scale: number }> {
  const chunks: Array<{ start: number; end: number; scale: number }> = [];
  let start = 0;
  while (start < widths.length) {
    let end = start;
    let total = 0;
    while (end < widths.length && (total + widths[end] <= availableWidth || end === start)) {
      total += widths[end];
      end += 1;
    }
    chunks.push({ start, end, scale: Math.min(1, availableWidth / Math.max(total, 1)) });
    start = end;
  }
  return chunks;
}

function drawCellText(page: PDFPage, font: PDFFont, lines: string[], x: number, y: number, width: number, height: number, size: number, colour: ReturnType<typeof import("pdf-lib").rgb>, alignment?: string) {
  const lineHeight = size * 1.25;
  const maxVisible = Math.max(1, Math.floor((height - CELL_PADDING * 2) / lineHeight));
  lines.slice(0, maxVisible).forEach((line, index) => {
    trackDrawnText(font, line);
    const textWidth = font.widthOfTextAtSize(line, size);
    const textX = alignment === "right"
      ? x + width - CELL_PADDING - textWidth
      : alignment === "center"
        ? x + Math.max(CELL_PADDING, (width - textWidth) / 2)
        : x + CELL_PADDING;
    page.drawText(line, { x: Math.max(x + 1, textX), y: y + height - CELL_PADDING - size - index * lineHeight, size, font, color: colour });
  });
}

async function renderSheet(
  pdf: PDFDocument,
  sheet: WorkSheet,
  sheetName: string,
  XLSX: typeof import("xlsx"),
  fonts: Awaited<ReturnType<typeof loadUnicodeFonts>>,
  rgb: typeof import("pdf-lib").rgb,
  onPage: () => void,
  cancelled?: () => boolean
) {
  const ref = sheet["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const widths = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => columnWidth(sheet, range.s.c + index));
  const chunks = horizontalChunks(widths, PAGE_WIDTH - PAGE_MARGIN * 2);

  for (const chunk of chunks) {
    let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = TABLE_TOP;
    const createPage = () => {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = TABLE_TOP;
    };
    const drawHeading = () => {
      const titleFont = resolveFont(fonts, sheetName, true, false);
      trackDrawnText(titleFont, sheetName);
      page.drawText(sheetName, { x: PAGE_MARGIN, y: PAGE_HEIGHT - 30, size: 13, font: titleFont, color: pdfColour(rgb, "111827") });
      page.drawText(`Columns ${XLSX.utils.encode_col(range.s.c + chunk.start)}–${XLSX.utils.encode_col(range.s.c + chunk.end - 1)}`, { x: PAGE_WIDTH - 145, y: PAGE_HEIGHT - 29, size: 7, font: fonts.notoRegular, color: pdfColour(rgb, "64748B") });
    };
    drawHeading();

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      if (cancelled?.()) return;
      const rowInfo = sheet["!rows"]?.[row] as { hpt?: number; hpx?: number; hidden?: boolean } | undefined;
      if (rowInfo?.hidden) continue;
      let rowHeight = Math.max(DEFAULT_ROW_HEIGHT, Math.min(90, rowInfo?.hpt ?? rowInfo?.hpx ?? DEFAULT_ROW_HEIGHT));

      for (let localColumn = chunk.start; localColumn < chunk.end; localColumn += 1) {
        const column = range.s.c + localColumn;
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })] as CellObject | undefined;
        const text = cellText(cell, XLSX);
        if (!text) continue;
        const style = (cell?.s ?? {}) as CellStyle;
        const size = Math.max(6, Math.min(12, style.font?.sz ?? FONT_SIZE));
        const font = resolveFont(fonts, text, Boolean(style.font?.bold || row === range.s.r), Boolean(style.font?.italic));
        const lines = splitLines(text, font, size, widths[localColumn] * chunk.scale - CELL_PADDING * 2);
        rowHeight = Math.max(rowHeight, Math.min(90, lines.length * size * 1.25 + CELL_PADDING * 2));
      }

      if (cursorY - rowHeight < TABLE_BOTTOM) {
        createPage();
        drawHeading();
      }

      let cursorX = PAGE_MARGIN;
      for (let localColumn = chunk.start; localColumn < chunk.end; localColumn += 1) {
        const column = range.s.c + localColumn;
        const width = widths[localColumn] * chunk.scale;
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = sheet[address] as CellObject | undefined;
        const style = (cell?.s ?? {}) as CellStyle;
        const fillColour = style.fill?.fgColor ?? style.fgColor;
        const hasVisibleFill = (style.fill?.patternType ?? style.patternType) !== "none" && Boolean(fillColour);
        const fill = hasVisibleFill
          ? readColour(fillColour, row === range.s.r ? "E2E8F0" : "FFFFFF")
          : row === range.s.r ? "E2E8F0" : "FFFFFF";
        page.drawRectangle({ x: cursorX, y: cursorY - rowHeight, width, height: rowHeight, color: pdfColour(rgb, fill), borderColor: pdfColour(rgb, "CBD5E1"), borderWidth: 0.45 });

        const text = cellText(cell, XLSX);
        if (text) {
          const size = Math.max(6, Math.min(12, style.font?.sz ?? FONT_SIZE));
          const font = resolveFont(fonts, text, Boolean(style.font?.bold || row === range.s.r), Boolean(style.font?.italic));
          const colour = cell?.l ? "2563EB" : readColour(style.font?.color, "111827");
          const lines = splitLines(text, font, size, width - CELL_PADDING * 2);
          drawCellText(page, font, lines, cursorX, cursorY - rowHeight, width, rowHeight, size, pdfColour(rgb, colour), style.alignment?.horizontal);
        }
        cursorX += width;
      }
      cursorY -= rowHeight;
      onPage();
    }
  }
}

export async function convertExcelFileToPdf(
  file: File,
  selectedSheets: string[] | undefined,
  onProgress?: (percent: number) => void,
  cancelled?: () => boolean,
  fontByteCache?: Map<string, Uint8Array>
): Promise<Blob> {
  const { XLSX, workbook } = await openWorkbook(file);
  const names = (selectedSheets?.length ? selectedSheets : workbook.SheetNames).filter((name) => workbook.Sheets[name]);
  if (!names.length) throw new Error("Select at least one sheet to convert.");

  const allText = names.flatMap((name) => {
    const sheet = workbook.Sheets[name];
    return Object.keys(sheet).filter((key) => !key.startsWith("!")).map((key) => cellText(sheet[key] as CellObject, XLSX));
  }).join(" ");

  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fonts = await loadUnicodeFonts(pdf, allText, fontByteCache);
  const totalRows = names.reduce((sum, name) => {
    const ref = workbook.Sheets[name]["!ref"];
    if (!ref) return sum;
    const range = XLSX.utils.decode_range(ref);
    return sum + Math.max(1, range.e.r - range.s.r + 1);
  }, 0);
  let rowsDone = 0;

  for (const name of names) {
    await renderSheet(pdf, workbook.Sheets[name], name, XLSX, fonts, rgb, () => {
      rowsDone += 1;
      onProgress?.(Math.min(98, (rowsDone / Math.max(totalRows, 1)) * 100));
    }, cancelled);
    if (cancelled?.()) throw new Error("Cancelled");
  }
  if (pdf.getPageCount() === 0) throw new Error("The selected sheets do not contain printable cells.");
  patchToUnicodeCmaps(fonts);
  const bytes = await pdf.save({ useObjectStreams: true });
  onProgress?.(100);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
