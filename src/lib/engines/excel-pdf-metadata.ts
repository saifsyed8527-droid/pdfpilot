import type { Range, WorkBook } from "xlsx";
import { excelPackage, relationshipId } from "./excel-package";

export type ExcelStyle = {
  fill?: string;
  font?: { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; color?: string };
  alignment?: { horizontal?: string; vertical?: string };
  borders?: Record<string, { color: string; width: number }>;
};
type TableStyle = { range: Range; header: boolean; stripes: boolean; styles: Map<string, ExcelStyle> };
export type ExcelSheetMetadata = {
  styles: Map<string, ExcelStyle>;
  tables: TableStyle[];
  defaultWidth: number;
  defaultHeight: number;
  orientation?: string;
  paperSize?: number;
  partPath?: string;
};
const elements = (el: Element | null | undefined) => Array.from(el?.childNodes || []).filter(node => node.nodeType === 1) as Element[];
const child = (el: Element | null | undefined, tag: string) => elements(el).find(c => c.localName === tag);
const children = (el: Element | null | undefined, tag: string) => elements(el).filter(c => c.localName === tag);
const on = (el: Element | undefined) => Boolean(el && el.getAttribute("val") !== "0" && el.getAttribute("val") !== "false");

export function readExcelMetadata(workbook: WorkBook, decodeRange: (ref: string) => Range): Map<string, ExcelSheetMetadata> {
  const pkg = excelPackage(workbook), read = pkg.xml;
  const relationships = (path: string) => new Map([...pkg.relations(path)].filter(([, rel]) => !rel.external).map(([id, rel]) => [id, rel.path]));
  const theme = read("xl/theme/theme1.xml");
  const scheme = child(child(theme, "themeElements"), "clrScheme");
  const themeColors = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map(key => {
    const color = elements(child(scheme, key))[0];
    return color?.getAttribute("lastClr") || color?.getAttribute("val") || "000000";
  });
  const palette = (
    "000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF " +
    "000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF " +
    "800000 008000 000080 808000 800080 008080 C0C0C0 808080 " +
    "9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF " +
    "000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF " +
    "00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 " +
    "3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 " +
    "003366 339966 003300 333300 993300 993366 333399 333333 " +
    "000000 FFFFFF"
  ).split(" ");
  const color = (el?: Element): string | undefined => {
    if (!el) return undefined;
    let value = el.getAttribute("rgb");
    if (!value && el.hasAttribute("theme")) value = themeColors[Number(el.getAttribute("theme"))];
    if (!value && el.hasAttribute("indexed")) {
      const index = Number(el.getAttribute("indexed"));
      value = children(child(child(stylesXml, "colors"), "indexedColors"), "rgbColor")[index]?.getAttribute("rgb") || palette[index];
    }
    if (!value || !/^[a-f\d]{6}([a-f\d]{2})?$/i.test(value)) return undefined;
    value = value.slice(-6);
    const tint = Number(el.getAttribute("tint") || 0);
    return value.match(/../g)!.map(v => { const n = parseInt(v, 16); return Math.round(tint < 0 ? n * (1 + tint) : n + (255 - n) * tint).toString(16).padStart(2, "0"); }).join("");
  };
  const style = (el?: Element | null): ExcelStyle => {
    if (!el) return {};
    const font = child(el, "font"), fill = child(child(el, "fill"), "patternFill"), alignment = child(el, "alignment");
    const borders: ExcelStyle["borders"] = {};
    for (const side of ["left", "right", "top", "bottom"]) {
      const edge = child(child(el, "border"), side), kind = edge?.getAttribute("style");
      if (kind) borders[side] = { color: color(child(edge, "color")) || "000000", width: kind === "thick" ? 2 : kind === "medium" ? 1 : 0.5 };
    }
    return {
      ...(font && { font: { ...(child(font, "sz") && { size: Number(child(font, "sz")?.getAttribute("val")) }), ...(child(font, "b") && { bold: on(child(font, "b")) }), ...(child(font, "i") && { italic: on(child(font, "i")) }), ...(child(font, "u") && { underline: on(child(font, "u")) }), ...(child(font, "color") && { color: color(child(font, "color")) }) } }),
      ...(fill?.getAttribute("patternType") === "solid" && { fill: color(child(fill, "fgColor")) }),
      ...(alignment && { alignment: { horizontal: alignment.getAttribute("horizontal") || undefined, vertical: alignment.getAttribute("vertical") || undefined } }),
      ...(Object.keys(borders).length && { borders }),
    };
  };
  const stylesXml = read("xl/styles.xml");
  const fonts = children(child(stylesXml, "fonts"), "font"), fills = children(child(stylesXml, "fills"), "fill"), borders = children(child(stylesXml, "borders"), "border");
  const cellStyles = children(child(stylesXml, "cellXfs"), "xf").map(xf => {
    const combined = xf.cloneNode(true) as Element;
    for (const el of [fonts[Number(xf.getAttribute("fontId") || 0)], fills[Number(xf.getAttribute("fillId") || 0)], borders[Number(xf.getAttribute("borderId") || 0)]]) if (el) combined.appendChild(el.cloneNode(true));
    return style(combined);
  });
  const diffs = children(child(stylesXml, "dxfs"), "dxf").map(style);
  const tableStyles = new Map(children(child(stylesXml, "tableStyles"), "tableStyle").map(table => [table.getAttribute("name"), new Map(children(table, "tableStyleElement").map(e => [e.getAttribute("type") || "", diffs[Number(e.getAttribute("dxfId"))] || {}]))]));
  const bookXml = read("xl/workbook.xml"), bookRelations = relationships("xl/workbook.xml");
  const output = new Map<string, ExcelSheetMetadata>();
  for (const item of children(child(bookXml, "sheets"), "sheet")) {
    const path = bookRelations.get(relationshipId(item));
    if (!path) continue;
    const xml = read(path), format = child(xml, "sheetFormatPr"), setup = child(xml, "pageSetup");
    const rels = relationships(path);
    const sheet: ExcelSheetMetadata = { styles: new Map(), tables: [], defaultWidth: Number(format?.getAttribute("defaultColWidth") || 8.43), defaultHeight: Number(format?.getAttribute("defaultRowHeight") || 15), orientation: setup?.getAttribute("orientation") || undefined, paperSize: Number(setup?.getAttribute("paperSize") || 9), partPath: path };
    for (const row of children(child(xml, "sheetData"), "row")) for (const cell of children(row, "c")) sheet.styles.set(cell.getAttribute("r") || "", cellStyles[Number(cell.getAttribute("s") || 0)] || {});
    for (const part of children(child(xml, "tableParts"), "tablePart")) {
      const tablePath = rels.get(relationshipId(part)), table = tablePath ? read(tablePath) : null;
      const info = child(table, "tableStyleInfo"), ref = table?.getAttribute("ref");
      if (ref) sheet.tables.push({ range: decodeRange(ref), header: table?.getAttribute("headerRowCount") !== "0", stripes: info?.getAttribute("showRowStripes") === "1", styles: tableStyles.get(info?.getAttribute("name") || "") || new Map() });
    }
    output.set(item.getAttribute("name") || "", sheet);
  }
  return output;
}

export function excelCellStyle(meta: ExcelSheetMetadata | undefined, address: string, row: number, col: number): ExcelStyle {
  const explicit = meta?.styles.get(address) || {};
  let base: ExcelStyle = {};
  for (const table of meta?.tables || []) {
    if (row < table.range.s.r || row > table.range.e.r || col < table.range.s.c || col > table.range.e.c) continue;
    base = { ...table.styles.get("wholeTable"), ...(table.stripes ? table.styles.get((row - table.range.s.r - (table.header ? 1 : 0)) % 2 ? "secondRowStripe" : "firstRowStripe") : {}), ...(table.header && row === table.range.s.r ? table.styles.get("headerRow") : {}) };
  }
  return { ...base, ...explicit, font: { ...base.font, ...explicit.font }, borders: { ...base.borders, ...explicit.borders } };
}
