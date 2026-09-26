import type { CellObject, Range, WorkSheet } from "xlsx";

export type CellPosition = { r: number; c: number };

export function visibleContentRange(sheet: WorkSheet, decode: (address: string) => CellPosition): Range | null {
  let range: Range | null = null;
  const populated = new Set<string>();
  for (const address of Object.keys(sheet)) {
    if (!/^[A-Z]+[1-9][0-9]*$/.test(address)) continue;
    const cell = sheet[address] as CellObject;
    if (!cell || (cell.v === undefined || cell.v === null || cell.v === "") && !cell.f) continue;
    const { r, c } = decode(address);
    if (sheet["!rows"]?.[r]?.hidden || sheet["!cols"]?.[c]?.hidden) continue;
    populated.add(`${r}:${c}`);
    if (!range) range = { s: { r, c }, e: { r, c } };
    else {
      range.s.r = Math.min(range.s.r, r); range.s.c = Math.min(range.s.c, c);
      range.e.r = Math.max(range.e.r, r); range.e.c = Math.max(range.e.c, c);
    }
  }
  if (!range) return null;
  // A populated merged cell owns its entire visible rectangle. Style-only
  // cells, stale !ref dimensions and empty table tails do not extend printing.
  for (const merge of sheet["!merges"] || []) {
    if (populated.has(`${merge.s.r}:${merge.s.c}`)) {
      range.e.r = Math.max(range.e.r, merge.e.r); range.e.c = Math.max(range.e.c, merge.e.c);
    }
  }
  return range;
}

/** Wrap URLs and unbroken strings as well as ordinary words, without ellipses. */
export function wrapExcelText(text: string, measure: (text: string) => number, width: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let line = "";
    for (const character of Array.from(paragraph)) {
      if (line && measure(line + character) > width) {
        const space = line.lastIndexOf(" ");
        if (space > line.length / 2) {
          lines.push(line.slice(0, space)); line = line.slice(space + 1);
        } else { lines.push(line); line = ""; }
      }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

export function safeExcelLink(target: string | undefined): string | null {
  if (!target || !/^(https?:\/\/|mailto:)/i.test(target.trim())) return null;
  try {
    const url = new URL(target.trim());
    return url.username || url.password ? null : url.href;
  } catch { return null; }
}

/** XLSX widths use the normal font's digit width, not points or screen DPI. */
export function excelColumnPoints(width: number, digitPixels = 7): number {
  return Math.max(3, Math.floor((256 * width + Math.floor(128 / digitPixels)) / 256 * digitPixels) * 0.75);
}

export function checkExcelArchiveEntry(name: string, bytes: number, count: number, total: number) {
  if (count > 10000 || !Number.isSafeInteger(bytes) || bytes < 0 || bytes > 64 * 1024 * 1024 || total > 256 * 1024 * 1024 || name.startsWith("/") || name.split("/").includes("..")) {
    throw new Error("This workbook is too large or has an invalid archive structure. Export a smaller XLSX workbook and try again.");
  }
}
