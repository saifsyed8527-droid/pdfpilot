import type { WorkBook } from "xlsx";
import type { ExcelSheetMetadata } from "./excel-pdf-metadata";

export function excelSheetChoices(workbook: WorkBook) {
  const hidden = new Set(workbook.Workbook?.Sheets?.filter(sheet => sheet.Hidden).map(sheet => sheet.name));
  return workbook.SheetNames.map(name => ({ name, hidden: hidden.has(name) }));
}

const damaged = "This XLS workbook is damaged or incomplete. Open it in Excel and save a new copy.";
const unsupported = "This XLS sheet contains drawings, charts or other non-cell objects. Select a different sheet or save the workbook as XLSX in Excel to preserve those objects.";

/** SheetJS reads BIFF8 cells and cached values. Inspect the original records
 * first because its cell model omits pictures and other drawing objects. */
export function openLegacyExcelPdf(bytes: Uint8Array, XLSX: typeof import("xlsx")) {
  let container;
  try { container = XLSX.CFB.read(bytes, { type: "array" }); }
  catch { throw new Error(damaged); }
  if (XLSX.CFB.find(container, "/EncryptedPackage") || XLSX.CFB.find(container, "/EncryptionInfo")) {
    throw new Error("This workbook is encrypted. Remove its password in Excel before converting to PDF.");
  }
  const entry = XLSX.CFB.find(container, "/Workbook") || XLSX.CFB.find(container, "/Book");
  if (!entry?.content) throw new Error("This file is not an Excel 97–2003 XLS workbook. Open the original file and save it as XLSX.");
  const stream: Uint8Array = entry.content instanceof Uint8Array ? entry.content : Uint8Array.from(entry.content);
  if (stream.length < 20 || stream.length !== entry.size) throw new Error(damaged);
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  if (u16(0) !== 0x0809 || u16(4) !== 0x0600 || u16(6) !== 0x0005) {
    throw new Error("This older Excel format needs to be saved as Excel 97–2003 XLS or XLSX first.");
  }
  const sheetAt = new Map<number, string>();
  const visited = new Set<number>();
  const unsupportedSheets = new Set<string>();
  const metadata = new Map<string, ExcelSheetMetadata>();
  const scopes: (string | undefined)[] = [];
  for (let offset = 0; offset < stream.length;) {
    // Excel writers may pad the stream with zeroes after its last EOF.
    if (!scopes.length && stream[offset] === 0 && stream.subarray(offset).every(value => value === 0)) break;
    if (offset + 4 > stream.length) throw new Error(damaged);
    const id = u16(offset), length = u16(offset + 2), data = offset + 4, end = data + length;
    if (end > stream.length) throw new Error(damaged);
    if (id === 0x002f) throw new Error("This XLS workbook is encrypted. Remove its password in Excel before converting to PDF.");
    if (id === 0x0085) { // BoundSheet8 maps a sheet's name to its BOF offset.
      if (length < 8) throw new Error(damaged);
      const start = u32(data), chars = stream[data + 6], wide = stream[data + 7] & 1;
      if (!chars || chars > 31 || 8 + chars * (wide + 1) > length || start < end || start + 8 > stream.length || sheetAt.has(start)) throw new Error(damaged);
      let name = "";
      for (let i = 0; i < chars; i++) name += String.fromCharCode(wide ? u16(data + 8 + i * 2) : stream[data + 8 + i]);
      sheetAt.set(start, name);
      if (stream[data + 5] !== 0) unsupportedSheets.add(name); // Chart, macro or module sheet.
    }
    if (id === 0x0809) {
      if (length < 4 || scopes.length > 16) throw new Error(damaged);
      const sheet = sheetAt.get(offset) ?? scopes.at(-1);
      scopes.push(sheet);
      if (sheetAt.has(offset)) visited.add(offset);
      if (sheet && u16(data + 2) !== 0x0010) unsupportedSheets.add(sheet);
    } else if (!scopes.length) throw new Error(damaged);
    const sheet = scopes.at(-1);
    if (id === 0x00a1 && sheet && length >= 12) { // Setup print settings.
      const flags = u16(data + 10);
      if (!(flags & 0x04)) metadata.set(sheet, {
        styles: new Map(), tables: [], defaultWidth: 8.43, defaultHeight: 15,
        paperSize: u16(data), orientation: flags & 0x40 ? undefined : flags & 0x02 ? "portrait" : "landscape",
      });
    }
    // A drawing container with a single group root is emitted even for empty
    // drawings by some writers. Any actual shape, object or continuation of
    // a drawing that we cannot identify must not silently disappear.
    const emptyDrawing = id === 0x00ec && length >= 24 && u16(data + 2) === 0xf002
      && u32(data + 4) === length - 8 && u16(data + 10) === 0xf008 && u32(data + 12) === 8 && u32(data + 16) === 1;
    if ((id === 0x00ec && !emptyDrawing) || id === 0x005d || id === 0x007f || id === 0x00e9 || id === 0x0866
      || (id === 0x0081 && length >= 2 && (u16(data) & 0x10))) {
      if (!sheet) throw new Error(unsupported);
      unsupportedSheets.add(sheet);
    }
    if (id === 0x000a) scopes.pop();
    offset = end;
  }
  if (scopes.length || !sheetAt.size || visited.size !== sheetAt.size) throw new Error(damaged);
  let workbook: WorkBook;
  try { workbook = XLSX.read(stream, { type: "array", cellFormula: true, cellStyles: true, cellText: true, cellDates: true }); }
  catch { throw new Error(damaged); }
  if (workbook.SheetNames.length !== sheetAt.size) throw new Error(damaged);
  return { workbook, unsupportedSheets, metadata };
}

export function checkLegacyExcelSheets(names: string[], unsupportedSheets?: Set<string>) {
  const first = names.find(name => unsupportedSheets?.has(name));
  if (first) throw new Error(`“${first}” — ${unsupported}`);
}
