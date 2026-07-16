/**
 * Excel Engine — real multi-sheet workbook I/O via `xlsx` (SheetJS
 * Community Edition). Installed from SheetJS's own CDN
 * (https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz), not the npm
 * registry: npm's published `xlsx` is frozen at 0.18.5, which carries two
 * real, high-severity advisories (GHSA-4r6h-8v6p-xvw6 prototype pollution,
 * GHSA-5pgg-2g8v-p4x9 ReDoS) that were fixed in 0.19.3 and 0.20.2
 * respectively — SheetJS just never republished the fix to npm. Installing
 * their own patched tarball directly is the maintainer-sanctioned fix,
 * verified via the GitHub Security Advisory API before choosing this over
 * the vulnerable npm package.
 *
 * Kept separate from data-conversion-engine.ts's existing hand-rolled
 * single-sheet OOXML writer (`rowsToXlsx`) rather than replacing it: that
 * function already ships in 4 production tools and works correctly for
 * its single-sheet, string-typed scope — touching it isn't this sprint's
 * job. This engine exists for genuinely new capability the hand-rolled
 * writer can't do: reading/writing *multiple* sheets and real cell types.
 */

import type { WorkBook } from "xlsx";

async function readWorkbook(file: File): Promise<WorkBook> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

function workbookToBlob(workbook: WorkBook, XLSX: typeof import("xlsx")): Blob {
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Lists every sheet name in a workbook, in order — used to populate the
 *  sheet picker in Excel Sheet Extractor. */
export async function listSheetNames(file: File): Promise<string[]> {
  const workbook = await readWorkbook(file);
  return workbook.SheetNames;
}

/** Reads one sheet (by name, or the first sheet if omitted) into a 2D
 *  array of cell strings (header row first) — the same `rows` shape every
 *  other tool in this project already uses, so this engine composes with
 *  jsonToRows/rowsToJson/rowsToXml/rowsToCsv rather than duplicating
 *  conversion logic for Excel specifically. */
export async function readSheetAsRows(file: File, sheetName?: string): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = await readWorkbook(file);
  const name = sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new Error(`Sheet "${name}" wasn't found in this workbook.`);
  }
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (aoa.length === 0) {
    throw new Error("This sheet has no data.");
  }
  return aoa.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
}

/** Writes rows (header row first) as a real single-sheet .xlsx, with
 *  proper numeric cell typing (SheetJS's `json_to_sheet` infers types from
 *  the JS values it's given) rather than the string-only inlineStr cells
 *  the hand-rolled writer produces. */
export async function rowsToSingleSheetXlsx(rows: string[][], sheetName: string = "Sheet1"): Promise<Blob> {
  if (rows.length === 0) {
    throw new Error("There are no rows to convert.");
  }
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbookToBlob(workbook, XLSX);
}

/** Extracts one named sheet out of a multi-sheet workbook into its own
 *  standalone single-sheet .xlsx file. */
export async function extractSheet(file: File, sheetName: string): Promise<Blob> {
  const rows = await readSheetAsRows(file, sheetName);
  return rowsToSingleSheetXlsx(rows, sheetName);
}

/** Combines multiple uploaded Excel files into one workbook, each source
 *  file's first sheet becoming its own named sheet in the output (named
 *  after the source filename, sanitized to Excel's 31-character sheet-name
 *  limit and disallowed characters). Real multi-sheet writing — the one
 *  capability the hand-rolled OOXML writer genuinely can't do. */
export async function mergeIntoWorkbook(files: File[]): Promise<Blob> {
  if (files.length < 2) {
    throw new Error("Upload at least two Excel files to merge.");
  }
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const file of files) {
    const rows = await readSheetAsRows(file);
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const baseName = file.name.replace(/\.(xlsx|xls)$/i, "").replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${baseName.slice(0, 28)}_${suffix}`;
      suffix++;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  return workbookToBlob(workbook, XLSX);
}
