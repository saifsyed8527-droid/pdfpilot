import type { Range, WorkBook, WorkSheet } from "xlsx";
import type { ExcelSheetMetadata } from "./excel-pdf-metadata";
import { excelColumnPoints, safeExcelLink } from "./excel-pdf-layout";
import { excelPackage, relationshipId, xmlChild as child, xmlDescendants as descendants, xmlElements as elements } from "./excel-package";
import { readExcelChart, type ExcelChart } from "./excel-chart-model";

const EMU = 12700; // OOXML uses 914400 EMU per inch; PDF uses 72 points.
type Marker = { row: number; col: number; x: number; y: number };
type Anchor = { kind: string; from?: Marker; to?: Marker; x: number; y: number; width: number; height: number; editAs: string };
export type ExcelGraphic = {
  name: string; anchor: Anchor; rotation: number; flipH: boolean; flipV: boolean; link: string | null;
} & ({ kind: "image"; bytes: Uint8Array; path: string; crop: { left: number; top: number; right: number; bottom: number } } | { kind: "chart"; chart: ExcelChart });
export type GraphicRect = { x: number; y: number; width: number; height: number };
export type PositionedGraphic = { graphic: ExcelGraphic; rect: GraphicRect; bounds: GraphicRect };

function checkedNumber(value: string | null | undefined, fallback = 0) {
  const n = value == null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw new Error("A spreadsheet drawing has invalid dimensions.");
  return n;
}
function marker(el?: Element): Marker {
  if (!el) throw new Error("A spreadsheet drawing is missing its cell anchor.");
  const row = checkedNumber(child(el, "row")?.textContent), col = checkedNumber(child(el, "col")?.textContent);
  if (!Number.isInteger(row) || row < 0 || row >= 1048576 || !Number.isInteger(col) || col < 0 || col >= 16384) throw new Error("A drawing is anchored outside the worksheet.");
  return { row, col, x: checkedNumber(child(el, "colOff")?.textContent) / EMU, y: checkedNumber(child(el, "rowOff")?.textContent) / EMU };
}
function anchor(el: Element): Anchor {
  const ext = child(el, "ext"), pos = child(el, "pos");
  return { kind: el.localName, ...(el.localName !== "absoluteAnchor" && { from: marker(child(el, "from")) }), ...(el.localName === "twoCellAnchor" && { to: marker(child(el, "to")) }), x: checkedNumber(pos?.getAttribute("x")) / EMU, y: checkedNumber(pos?.getAttribute("y")) / EMU, width: checkedNumber(ext?.getAttribute("cx")) / EMU, height: checkedNumber(ext?.getAttribute("cy")) / EMU, editAs: el.getAttribute("editAs") || "twoCell" };
}
function compatibleChildren(el: Element): Element[] {
  return elements(el).flatMap(item => {
    if (item.localName !== "AlternateContent") return [item];
    // Office supplies a compatible visual fallback for newer extensions.
    const fallback = child(item, "Fallback") || child(item, "Choice");
    return fallback ? compatibleChildren(fallback) : [];
  });
}

export function readExcelGraphics(workbook: WorkBook, name: string, meta: ExcelSheetMetadata | undefined, XLSX: typeof import("xlsx")): ExcelGraphic[] {
  if (!meta?.partPath) return [];
  const pkg = excelPackage(workbook), sheet = pkg.xml(meta.partPath), sheetRels = pkg.relations(meta.partPath);
  if (descendants(child(sheet, "oleObjects"), "oleObject").length || child(sheet, "controls")) throw new Error(`“${name}” contains an embedded application object or form control. Use Excel's PDF export to preserve it.`);
  // In-cell rich-data images and legacy VML need separate decoders; never
  // accept the sheet while quietly omitting those pictures.
  if (descendants(sheet, "c").some(c => c.hasAttribute("vm")) || descendants(sheet, "f").some(f => /(?:_xlfn\.)?(?:_xlws\.)?(IMAGE|DISPIMG)\s*\(/i.test(f.textContent || ""))) throw new Error(`“${name}” uses in-cell IMAGE/rich-data pictures. Change them to pictures over cells in Excel, or use Excel's PDF export.`);
  for (const legacy of elements(sheet).filter(n => /^(legacyDrawing|legacyDrawingHF|picture)$/.test(n.localName))) {
    const rel = sheetRels.get(relationshipId(legacy)), vml = rel && !rel.external ? pkg.xml(rel.path) : null;
    if (legacy.localName !== "legacyDrawing" || descendants(vml, "imagedata").length) throw new Error(`“${name}” contains a legacy or header/background picture. Use Excel's PDF export to keep it.`);
  }
  const result: ExcelGraphic[] = [];
  for (const drawing of elements(sheet).filter(n => n.localName === "drawing")) {
    const relation = sheetRels.get(relationshipId(drawing));
    if (!relation || relation.external) throw new Error(`“${name}” has a missing or linked drawing part. Embed its pictures and save a new XLSX copy.`);
    const root = pkg.xml(relation.path), rels = pkg.relations(relation.path);
    if (!root) throw new Error(`A drawing part is missing from “${name}”. Save a new XLSX copy.`);
    for (const container of compatibleChildren(root)) {
      if (!/^(oneCellAnchor|twoCellAnchor|absoluteAnchor)$/.test(container.localName)) {
        if (container.localName === "extLst") continue;
        throw new Error(`A drawing in “${name}” uses an unsupported anchor format.`);
      }
      if (["0", "false"].includes(child(container, "clientData")?.getAttribute("fPrintsWithSheet") || "")) continue;
      const objects = compatibleChildren(container).filter(n => !["from", "to", "pos", "ext", "clientData"].includes(n.localName));
      for (const object of objects) {
        const props = descendants(object, "cNvPr")[0];
        if (["1", "true"].includes(props?.getAttribute("hidden") || "")) continue;
        const objectName = props?.getAttribute("name") || `Drawing ${result.length + 1}`;
        const xfrm = child(child(object, "spPr"), "xfrm") || child(object, "xfrm");
        const linkRel = rels.get(relationshipId(child(props, "hlinkClick")));
        const common = { name: objectName, anchor: anchor(container), rotation: checkedNumber(xfrm?.getAttribute("rot")) / 60000, flipH: ["1", "true"].includes(xfrm?.getAttribute("flipH") || ""), flipV: ["1", "true"].includes(xfrm?.getAttribute("flipV") || ""), link: linkRel?.external ? safeExcelLink(linkRel.path) : null };
        if (sheet?.localName === "chartsheet" && object.localName === "graphicFrame" && common.anchor.kind === "absoluteAnchor" && !common.anchor.width && !common.anchor.height) {
          // A chart sheet uses a zero-extent absolute anchor to mean "fill the
          // printable page", not "invisible chart" (Excel/openpyxl convention).
          const paper = meta.paperSize === 1 ? [612, 792] : meta.paperSize === 5 ? [612, 1008] : meta.paperSize === 8 ? [841.89, 1190.55] : [595.28, 841.89];
          const portrait = meta.orientation === "portrait";
          common.anchor.width = (portrait ? Math.min(...paper) : Math.max(...paper)) - 48;
          common.anchor.height = (portrait ? Math.max(...paper) : Math.min(...paper)) - 72;
        }
        if (object.localName === "pic") {
          const fill = child(object, "blipFill"), blip = child(fill, "blip"), svg = descendants(blip, "svgBlip")[0];
          // Prefer Office's embedded raster preview when one accompanies SVG.
          const imageRel = rels.get(relationshipId(blip, "embed")) || rels.get(relationshipId(svg, "embed"));
          if (!imageRel || imageRel.external) throw new Error(`The picture “${objectName}” in “${name}” is linked, not embedded. Embed it in the workbook first. No picture URLs are uploaded or fetched.`);
          const bytes = pkg.bytes(imageRel.path);
          if (!bytes?.length) throw new Error(`The picture “${objectName}” is missing from this workbook.`);
          const src = child(fill, "srcRect");
          const crop = { left: checkedNumber(src?.getAttribute("l")) / 100000, top: checkedNumber(src?.getAttribute("t")) / 100000, right: checkedNumber(src?.getAttribute("r")) / 100000, bottom: checkedNumber(src?.getAttribute("b")) / 100000 };
          if (crop.left + crop.right >= 1 || crop.top + crop.bottom >= 1) throw new Error(`The picture “${objectName}” has an invalid crop rectangle.`);
          result.push({ ...common, kind: "image", bytes, path: imageRel.path, crop });
        } else if (object.localName === "graphicFrame") {
          const ref = descendants(object, "chart")[0], chartRel = rels.get(relationshipId(ref));
          if (!chartRel || chartRel.external) throw new Error(`“${objectName}” in “${name}” is a newer chart, SmartArt or embedded object. Use Excel's PDF export to preserve it.`);
          const chartXml = pkg.xml(chartRel.path);
          if (!chartXml) throw new Error(`Chart data is missing for “${objectName}”.`);
          result.push({ ...common, kind: "chart", chart: readExcelChart(chartXml, workbook, XLSX, pkg, name) });
        } else {
          throw new Error(`“${objectName}” in “${name}” is a drawing shape/group rather than a picture or chart. Export from Excel to preserve this object.`);
        }
        if (result.length > 512) throw new Error("A sheet contains more than 512 drawing objects. Convert a smaller sheet.");
      }
    }
  }
  return result;
}

export function excelGeometry(sheet: WorkSheet, meta?: ExcelSheetMetadata, measuredRows?: Map<number, number>) {
  const columnWidth = (i: number) => sheet["!cols"]?.[i]?.hidden ? 0 : sheet["!cols"]?.[i]?.width !== undefined ? excelColumnPoints(sheet["!cols"]![i].width!) : Math.max(3, sheet["!cols"]?.[i]?.wpx !== undefined ? sheet["!cols"]![i].wpx! * 0.75 : excelColumnPoints(meta?.defaultWidth || 8.43));
  const rowHeight = (i: number) => sheet["!rows"]?.[i]?.hidden ? 0 : measuredRows?.get(i) ?? Math.max(3, sheet["!rows"]?.[i]?.hpt ?? (sheet["!rows"]?.[i]?.hpx !== undefined ? sheet["!rows"]![i].hpx! * 0.75 : meta?.defaultHeight || 15));
  const xs = [0], ys = [0];
  const offset = (list: number[], index: number, size: (i: number) => number, limit: number) => {
    if (index > limit) throw new Error("A drawing is too far from the printable worksheet. Move it closer to the data before converting.");
    while (list.length <= index) list.push(list[list.length - 1] + size(list.length - 1));
    return list[index];
  };
  const x = (index: number) => offset(xs, index, columnWidth, 16384), y = (index: number) => offset(ys, index, rowHeight, 100000);
  const at = (value: number, position: (i: number) => number, limit: number) => {
    let hi = 1;
    while (position(hi) <= value && hi < limit) hi = Math.min(limit, hi * 2);
    if (position(hi) <= value) throw new Error("A drawing extends beyond the printable worksheet limits.");
    let lo = 0;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (position(mid) <= value) lo = mid; else hi = mid; }
    return lo;
  };
  return { x, y, columnWidth, rowHeight, columnAt: (v: number) => at(Math.max(0, v), x, 16384), rowAt: (v: number) => at(Math.max(0, v), y, 100000) };
}
type Geometry = ReturnType<typeof excelGeometry>;
export function positionExcelGraphic(graphic: ExcelGraphic, geometry: Geometry, original = geometry): PositionedGraphic {
  const a = graphic.anchor;
  const start = a.from ? { x: geometry.x(a.from.col) + a.from.x, y: geometry.y(a.from.row) + a.from.y } : { x: a.x, y: a.y };
  let width = a.width, height = a.height;
  if (a.to && a.from) {
    const relative = a.editAs === "twoCell" ? geometry : original;
    width = relative.x(a.to.col) + a.to.x - relative.x(a.from.col) - a.from.x;
    height = relative.y(a.to.row) + a.to.y - relative.y(a.from.row) - a.from.y;
    if (a.editAs === "absolute") { start.x = original.x(a.from.col) + a.from.x; start.y = original.y(a.from.row) + a.from.y; }
  }
  if (![start.x, start.y, width, height].every(Number.isFinite) || width < 0 || height < 0 || width > 14400 || height > 14400) throw new Error(`“${graphic.name}” has invalid or oversized drawing dimensions.`);
  const rect = { ...start, width, height };
  const angle = graphic.rotation * Math.PI / 180;
  const bw = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)), bh = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
  return { graphic, rect, bounds: { x: start.x + (width - bw) / 2, y: start.y + (height - bh) / 2, width: bw, height: bh } };
}

export function graphicsContentRange(range: Range | null, graphics: ExcelGraphic[], geometry: Geometry): Range | null {
  let out = range ? { s: { ...range.s }, e: { ...range.e } } : null;
  for (const graphic of graphics) {
    const { bounds } = positionExcelGraphic(graphic, geometry);
    if (!bounds.width || !bounds.height) continue;
    const start = { c: geometry.columnAt(bounds.x), r: geometry.rowAt(bounds.y) }, end = { c: geometry.columnAt(bounds.x + bounds.width - 0.001), r: geometry.rowAt(bounds.y + bounds.height - 0.001) };
    if (!out) out = { s: start, e: end };
    else { out.s.c = Math.min(out.s.c, start.c); out.s.r = Math.min(out.s.r, start.r); out.e.c = Math.max(out.e.c, end.c); out.e.r = Math.max(out.e.r, end.r); }
  }
  return out;
}
