import type { WorkBook } from "xlsx";

export const EXCEL_FORMATS = ["xml", "csv", "ods", "xls", "pdf"] as const;
export type ExcelFormat = typeof EXCEL_FORMATS[number];
export interface ExcelOptions {
  format: ExcelFormat;
  password: string;
  sheets?: string[];
  headerRow: boolean;
}
export interface ExcelInspection {
  sheets: { name: string; rows: number; columns: number }[];
  preview: string[][];
}
export interface ExcelOutput { name: string; blob: Blob }
export const DEFAULT_EXCEL_OPTIONS: ExcelOptions = { format: "xml", password: "", headerRow: true };
const MAX_CELLS = 250_000;
const MAX_BYTES = 100 * 1024 * 1024;

export function outputBase(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim().slice(0, 100) || "workbook";
}

async function openExcel(file: File, password: string) {
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error("Choose an XLSX or XLS workbook.");
  if (!file.size || file.size > MAX_BYTES) throw new Error("Choose a non-empty workbook up to 100MB.");
  if (password.length > 255) throw new Error("The password must be 255 characters or fewer.");
  let bytes = new Uint8Array(await file.arrayBuffer());
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const compound = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (!zip && !compound) throw new Error("This file is not a valid Excel workbook. Check the file, not just its extension.");
  if (compound && /\.xlsx$/i.test(file.name)) {
    if (!password) throw new Error("This workbook is encrypted. Enter its password in File settings.");
    try {
      const { default: XlsxPopulate } = await import("xlsx-populate/browser/xlsx-populate.min.js");
      const decrypted = await XlsxPopulate.fromDataAsync(bytes, { password });
      bytes = await decrypted.outputAsync({ type: "uint8array", password: undefined });
    } catch {
      throw new Error("Could not unlock this XLSX. Check the password. Only Agile-encrypted XLSX files are supported; other encryption types must be unlocked in Excel first.");
    }
  }
  const XLSX = await import("xlsx");
  let workbook: WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array", password, cellStyles: true, cellFormula: true });
  } catch (error) {
    if (/password|encrypt|decrypt/i.test(String(error))) {
      throw new Error("Could not unlock this XLS file. Check its password. Newer XLS encryption must be removed in Excel first.");
    }
    throw new Error("This workbook could not be read. Open it in Excel and save a new copy.");
  }
  if (!workbook.SheetNames.length) throw new Error("This workbook has no worksheets.");
  let cells = 0;
  for (const name of workbook.SheetNames) {
    const ref = workbook.Sheets[name]?.["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    cells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    if (!Number.isSafeInteger(cells) || cells > MAX_CELLS) throw new Error("This workbook is too large to process here (250,000 cells maximum). Split it into smaller workbooks.");
  }
  return { XLSX, workbook, bytes };
}

export async function inspectExcel(file: File, password = ""): Promise<ExcelInspection> {
  const { workbook, XLSX } = await openExcel(file, password);
  const sheets = workbook.SheetNames.map((name) => {
    const ref = workbook.Sheets[name]["!ref"];
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    return { name, rows: range ? range.e.r - range.s.r + 1 : 0, columns: range ? range.e.c - range.s.c + 1 : 0 };
  });
  const first = sheets.find((sheet) => sheet.rows);
  let preview: string[][] = [];
  if (first) {
    const sheet = workbook.Sheets[first.name];
    const range = XLSX.utils.decode_range(sheet["!ref"]!);
    range.e.r = Math.min(range.e.r, range.s.r + 5);
    range.e.c = Math.min(range.e.c, range.s.c + 5);
    preview = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "", range });
  }
  return { sheets, preview };
}

export function buildSheetXml(rows: string[][], headerRow: boolean): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const used = new Set<string>();
  const headers = Array.from({ length: width }, (_, index) => {
    let base = headerRow ? (rows[0]?.[index] ?? "").trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_.-]/gu, "") : "";
    if (!base) base = `field_${index + 1}`;
    if (!/^[\p{L}_]/u.test(base) || /^xml/i.test(base)) base = `_${base}`;
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
    used.add(name);
    return name;
  });
  const escape = (text: string) => {
    // XML 1.0 cannot represent these control characters, even as entities.
    if (/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(text)) {
      throw new Error("A cell contains a character XML cannot represent. Remove control characters from the workbook and try again.");
    }
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;");
  };
  const body = rows.slice(headerRow ? 1 : 0).map((row) => `  <row>\n${headers.map((name, index) => `    <${name}>${escape(String(row[index] ?? ""))}</${name}>`).join("\n")}\n  </row>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${body}\n</rows>\n`;
}

export async function convertExcel(file: File, options: ExcelOptions, progress: (value: number) => void = () => {}): Promise<ExcelOutput[]> {
  if (!EXCEL_FORMATS.includes(options.format)) throw new Error("Choose a supported output format.");
  const { workbook, XLSX, bytes } = await openExcel(file, options.password);
  const names = options.sheets ?? workbook.SheetNames;
  if (!names.length) throw new Error("Select at least one worksheet.");
  if (names.some((name) => !Object.hasOwn(workbook.Sheets, name))) throw new Error("A selected sheet no longer exists. Reload the workbook.");
  if (options.format !== "pdf" && !names.some((name) => workbook.Sheets[name]["!ref"])) throw new Error("The selected worksheets are empty.");
  const base = outputBase(file.name);
  progress(20);
  if (options.format === "pdf") {
    const { convertExcelFileToPdf } = await import("./excel-to-pdf-engine");
    // Re-serializing through the cell-only writer drops drawing/media parts.
    // Keep the original (or decrypted) OOXML package for PDF conversion.
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("For a PDF with pictures and charts, first save this older XLS file as XLSX in Excel.");
    const blob = await convertExcelFileToPdf(new File([bytes as BlobPart], `${base}.xlsx`), names, (value) => progress(20 + value * 0.8));
    return [{ name: `${base}.pdf`, blob }];
  }
  if (options.format === "xls" || options.format === "ods") {
    const selected = XLSX.utils.book_new();
    for (const name of names) {
      const sheet = workbook.Sheets[name];
      if (options.format === "xls" && sheet["!ref"]) {
        const range = XLSX.utils.decode_range(sheet["!ref"]!);
        if (range.e.r >= 65536 || range.e.c >= 256) throw new Error("XLS supports up to 65,536 rows and 256 columns. Choose ODS or XML for this workbook.");
      }
      XLSX.utils.book_append_sheet(selected, sheet, name);
    }
    const bytes = XLSX.write(selected, { type: "array", bookType: options.format === "xls" ? "biff8" : "ods" });
    progress(100);
    return [{ name: `${base}.${options.format}`, blob: new Blob([bytes], { type: options.format === "xls" ? "application/vnd.ms-excel" : "application/vnd.oasis.opendocument.spreadsheet" }) }];
  }
  return names.map((name, index) => {
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false, blankrows: true });
    const content = options.format === "xml" ? buildSheetXml(rows, options.headerRow) : "\ufeff" + XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: true });
    progress(20 + (index + 1) / names.length * 80);
    const suffix = names.length > 1 ? `_${index + 1}_${outputBase(name)}` : "";
    return { name: `${base}${suffix}.${options.format}`, blob: new Blob([content], { type: options.format === "xml" ? "application/xml;charset=utf-8" : "text/csv;charset=utf-8" }) };
  });
}

export async function bundleExcelOutputs(outputs: ExcelOutput[]): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const output of outputs) {
    let name = output.name;
    for (let i = 2; Object.hasOwn(entries, name); i++) name = output.name.replace(/(\.[^.]+)$/, `_${i}$1`);
    entries[name] = new Uint8Array(await output.blob.arrayBuffer());
  }
  return new Blob([zipSync(entries) as BlobPart], { type: "application/zip" });
}
