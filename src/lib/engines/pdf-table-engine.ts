import { loadPdfjs } from "@/lib/pdfjs";

export type ExcelSheetLayout = "one-sheet" | "multiple-sheets";

export interface ExtractedPdfTablePage {
  pageNumber: number;
  rows: string[][];
}

interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextRow {
  y: number;
  height: number;
  items: PositionedText[];
}

const MIN_TABLE_COLUMNS = 2;
const MIN_TABLE_ROWS = 2;

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
}

function outputName(file: File, extension: string) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "converted";
  return `${base}.${extension}`;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function isDuplicatePaint(current: PositionedText, previous: PositionedText | null) {
  if (!previous) return false;
  return (
    current.text === previous.text &&
    current.text.length > 0 &&
    Math.abs(current.y - previous.y) < 1 &&
    Math.abs(current.x - previous.x) < Math.max(current.width, previous.width) * 0.5
  );
}

function extractPositionedItems(items: unknown[]): PositionedText[] {
  const positioned: PositionedText[] = [];
  let previous: PositionedText | null = null;

  for (const raw of items) {
    if (!raw || typeof raw !== "object" || !("str" in raw) || !("transform" in raw)) continue;
    const item = raw as { str: string; transform: number[]; width: number; height: number };
    const text = item.str.replace(/\s+/g, " ").trim();
    if (!text) continue;

    const current = {
      text,
      x: Number(item.transform[4]) || 0,
      y: Number(item.transform[5]) || 0,
      width: Number(item.width) || text.length * 4,
      height: Number(item.height) || Math.abs(Number(item.transform[3])) || 10,
    };

    if (!isDuplicatePaint(current, previous)) {
      positioned.push(current);
      previous = current;
    }
  }

  return positioned;
}

function groupRows(items: PositionedText[]) {
  const heights = items.map((item) => item.height).filter((height) => height > 0);
  const yTolerance = Math.max(2.5, median(heights) * 0.55);
  const rows: TextRow[] = [];

  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= yTolerance);
    if (row) {
      row.items.push(item);
      const count = row.items.length;
      row.y = (row.y * (count - 1) + item.y) / count;
      row.height = Math.max(row.height, item.height);
    } else {
      rows.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  return rows
    .map((row) => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y);
}

function buildColumnAnchors(rows: TextRow[]) {
  const rowGapSamples = rows.flatMap((row) => {
    const gaps: number[] = [];
    for (let i = 1; i < row.items.length; i++) {
      const previous = row.items[i - 1];
      const current = row.items[i];
      gaps.push(current.x - (previous.x + previous.width));
    }
    return gaps.filter((gap) => gap > 0);
  });
  const gapTolerance = Math.max(8, Math.min(28, median(rowGapSamples) * 0.35 || 14));
  const anchors: { x: number; count: number }[] = [];

  for (const item of rows.flatMap((row) => row.items).sort((a, b) => a.x - b.x)) {
    const anchor = anchors.find((candidate) => Math.abs(candidate.x - item.x) <= gapTolerance);
    if (anchor) {
      anchor.x = (anchor.x * anchor.count + item.x) / (anchor.count + 1);
      anchor.count += 1;
    } else {
      anchors.push({ x: item.x, count: 1 });
    }
  }

  const minimumRepeats = rows.length >= 4 ? 2 : 1;
  return anchors
    .filter((anchor) => anchor.count >= minimumRepeats)
    .sort((a, b) => a.x - b.x)
    .map((anchor) => anchor.x);
}

function nearestColumn(x: number, columns: number[]) {
  let index = 0;
  let distance = Number.POSITIVE_INFINITY;
  columns.forEach((columnX, columnIndex) => {
    const nextDistance = Math.abs(columnX - x);
    if (nextDistance < distance) {
      distance = nextDistance;
      index = columnIndex;
    }
  });
  return index;
}

function rowsToGrid(rows: TextRow[], columns: number[]) {
  return rows
    .map((row) => {
      const cells = Array.from({ length: columns.length }, () => "");
      for (const item of row.items) {
        const column = nearestColumn(item.x, columns);
        cells[column] = cells[column] ? `${cells[column]} ${item.text}` : item.text;
      }
      return cells.map((cell) => cell.trim());
    })
    .filter((row) => row.some(Boolean));
}

function hasTableShape(rows: string[][]) {
  if (rows.length < MIN_TABLE_ROWS) return false;
  const rowsWithColumns = rows.filter((row) => row.filter(Boolean).length >= MIN_TABLE_COLUMNS);
  return rowsWithColumns.length >= MIN_TABLE_ROWS;
}

export async function extractPdfTables(file: File, onProgress?: (page: number, total: number) => void): Promise<ExtractedPdfTablePage[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: ExtractedPdfTablePage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = groupRows(extractPositionedItems(content.items));
    const columns = buildColumnAnchors(rows);
    const grid = columns.length >= MIN_TABLE_COLUMNS ? rowsToGrid(rows, columns) : [];

    if (hasTableShape(grid)) {
      pages.push({ pageNumber, rows: grid });
    }
    onProgress?.(pageNumber, pdf.numPages);
  }

  return pages;
}

export async function createExcelFromPdfTables(file: File, layout: ExcelSheetLayout, onProgress?: (page: number, total: number) => void) {
  const pages = await extractPdfTables(file, onProgress);
  if (pages.length === 0) {
    throw new Error("No table-like structure was detected. Try a PDF that has selectable table text, or use OCR first for scanned pages.");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  if (layout === "one-sheet") {
    const rows: string[][] = [];
    pages.forEach((page, index) => {
      if (index > 0) rows.push([]);
      if (pages.length > 1) rows.push([`Page ${page.pageNumber}`]);
      rows.push(...page.rows);
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "PDF tables");
  } else {
    pages.forEach((page) => {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(page.rows), sanitizeSheetName(`Page ${page.pageNumber}`));
    });
  }

  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return {
    blob: new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: outputName(file, "xlsx"),
    tablePageCount: pages.length,
    totalRows: pages.reduce((sum, page) => sum + page.rows.length, 0),
  };
}
