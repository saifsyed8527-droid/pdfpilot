import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import type { ExcelGraphic, GraphicRect } from "./excel-pdf-graphics";
import { excelChartOption } from "./excel-chart-model";

const MAX_PIXELS = 32_000_000;
const checkSize = (w: number, h: number) => {
  if (!(w > 0 && h > 0 && w * h <= MAX_PIXELS && w <= 32768 && h <= 32768)) throw new Error("A spreadsheet image is too large to decode safely. Resize that image before converting.");
};
export function excelImageFormat(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    if (bytes.length < 24) throw new Error("An embedded PNG is damaged.");
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); checkSize(v.getUint32(16), v.getUint32(20)); return "png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Bound JPEG decoding before pdf-lib allocates pixel data.
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) break;
      const marker = bytes[at + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = (bytes[at + 2] << 8) | bytes[at + 3];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) { checkSize((bytes[at + 7] << 8) | bytes[at + 8], (bytes[at + 5] << 8) | bytes[at + 6]); return "jpeg"; }
      if (length < 2) break; at += length + 2;
    }
    throw new Error("An embedded JPEG has an invalid size header.");
  }
  const head = new TextDecoder().decode(bytes.slice(0, 512));
  if (head.startsWith("GIF8")) { checkSize(bytes[6] | bytes[7] << 8, bytes[8] | bytes[9] << 8); return "gif"; }
  if (head.startsWith("BM")) {
    if (bytes.length < 26) throw new Error("An embedded BMP is damaged.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(14, true) === 12) checkSize(view.getUint16(18, true), view.getUint16(20, true));
    else checkSize(view.getInt32(18, true), Math.abs(view.getInt32(22, true)));
    return "bmp";
  }
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") {
    const u24 = (at: number) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16;
    if (bytes.length < 30) throw new Error("An embedded WebP is damaged.");
    const kind = head.slice(12, 16);
    if (kind === "VP8X") checkSize(1 + u24(24), 1 + u24(27));
    else if (kind === "VP8L") checkSize(1 + ((bytes[21] | bytes[22] << 8) & 16383), 1 + ((bytes[22] >> 6 | bytes[23] << 2 | bytes[24] << 10) & 16383));
    else if (kind === "VP8 ") checkSize((bytes[26] | bytes[27] << 8) & 16383, (bytes[28] | bytes[29] << 8) & 16383);
    else throw new Error("An embedded WebP has an unknown size header.");
    return "webp";
  }
  if (/<svg(?:\s|>)/i.test(head)) return "svg+xml";
  return null;
}
export function validateExcelSvg(bytes: Uint8Array) {
  const source = new TextDecoder().decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("An SVG picture contains an unsafe declaration.");
  const root = new DOMParser().parseFromString(source, "image/svg+xml");
  if (root.getElementsByTagName("parsererror").length || root.documentElement.localName !== "svg") throw new Error("An SVG picture has invalid XML.");
  const width = parseFloat(root.documentElement.getAttribute("width") || "300"), height = parseFloat(root.documentElement.getAttribute("height") || "150");
  if (Number.isFinite(width) && Number.isFinite(height)) checkSize(width, height);
  const styles: string[] = [];
  for (const el of Array.from(root.getElementsByTagName("*"))) {
    if (/^(script|foreignObject|iframe|object|embed|animate|set)$/i.test(el.localName)) throw new Error("An SVG picture contains active content. Export a static PNG copy of that picture.");
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || /(?:href|src)$/i.test(attr.name) && !/^(#|data:image\/(png|jpeg|gif|webp);base64,)/i.test(attr.value)) throw new Error("An SVG picture references external or active content. Embed a static picture first.");
      styles.push(attr.value);
    }
    if (el.localName === "style") styles.push(el.textContent || "");
  }
  // Inspect XML-decoded values, including quoted local gradient/filter IDs.
  const css = styles.join("\n");
  if (/@import/i.test(css) || [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(match => !match[2].trim().startsWith("#"))) throw new Error("An SVG picture references an external resource. Embed a static picture first.");
}
async function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not render the spreadsheet graphic.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}
async function browserPicture(bytes: Uint8Array, format: string): Promise<Uint8Array> {
  if (typeof document === "undefined") throw new Error("This image format requires the browser renderer.");
  if (format === "svg+xml") validateExcelSvg(bytes);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: `image/${format}` }));
  const image = new Image();
  try {
    image.src = url; await image.decode();
    checkSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    try { const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("The browser could not create an image canvas."); ctx.drawImage(image, 0, 0); return await canvasPng(canvas); }
    finally { canvas.width = canvas.height = 0; }
  } catch (error) {
    if (error instanceof Error && /spreadsheet|SVG|large|static/.test(error.message)) throw error;
    throw new Error(`The browser could not decode an embedded ${format.split("+")[0].toUpperCase()} picture. Save it as PNG or JPEG in the workbook.`);
  } finally { URL.revokeObjectURL(url); image.src = ""; }
}

const loadedChartFonts = new Map<string, Promise<void>>();
async function chartFonts(cache: Map<string, Uint8Array>) {
  for (const [path, data] of cache) {
    if (!path.startsWith("/fonts/")) continue;
    if (!loadedChartFonts.has(path)) loadedChartFonts.set(path, (async () => {
      const family = path.includes("Devanagari") ? "PDFPilotChartDevanagari" : path.includes("Arabic") ? "PDFPilotChartArabic" : path.includes("Symbols") ? "PDFPilotChartSymbols" : "PDFPilotChart";
      const font = new FontFace(family, data.slice().buffer, { weight: path.includes("Bold") ? "700" : "400", style: path.includes("Italic") ? "italic" : "normal" });
      await font.load(); document.fonts.add(font);
    })().catch(error => { loadedChartFonts.delete(path); throw error; }));
    await loadedChartFonts.get(path);
  }
}

export async function prepareExcelGraphic(pdf: PDFDocument, graphic: ExcelGraphic, rect: GraphicRect, cache: Map<string, PDFImage>, fontCache: Map<string, Uint8Array>, formatNumber: (code: string, value: number) => string): Promise<PDFImage> {
  if (graphic.kind === "image") {
    const cached = cache.get(graphic.path); if (cached) return cached;
    const format = excelImageFormat(graphic.bytes);
    if (!format) throw new Error(`“${graphic.name}” uses ${graphic.path.split(".").pop()?.toUpperCase() || "an unknown image format"}. Replace that picture with PNG/JPEG in Excel; no partial PDF will be downloaded.`);
    const image = format === "png" ? await pdf.embedPng(graphic.bytes) : format === "jpeg" ? await pdf.embedJpg(graphic.bytes) : await pdf.embedPng(await browserPicture(graphic.bytes, format));
    cache.set(graphic.path, image); return image;
  }
  if (typeof document === "undefined") throw new Error("Charts are painted locally by the browser renderer.");
  await chartFonts(fontCache);
  const echarts = await import("echarts/core");
  const charts = await import("echarts/charts"), components = await import("echarts/components"), renderers = await import("echarts/renderers");
  echarts.use([charts.BarChart, charts.LineChart, charts.PieChart, charts.ScatterChart, charts.RadarChart, charts.CandlestickChart, components.GridComponent, components.LegendComponent, components.TitleComponent, components.DatasetComponent, renderers.CanvasRenderer]);
  const width = Math.max(120, Math.min(2400, rect.width * 4 / 3)), height = Math.max(90, Math.min(2400, rect.height * 4 / 3));
  const canvas = document.createElement("canvas");
  const instance = echarts.init(canvas, undefined, { renderer: "canvas", width, height, devicePixelRatio: 2 });
  try {
    const option = excelChartOption(graphic.chart, width, height, formatNumber);
    option.textStyle = { ...(option.textStyle as object), fontFamily: "PDFPilotChart, PDFPilotChartDevanagari, PDFPilotChartArabic, PDFPilotChartSymbols, Arial, sans-serif" };
    instance.setOption(option, { lazyUpdate: false });
    return await pdf.embedPng(await canvasPng(canvas));
  } finally { instance.dispose(); canvas.width = canvas.height = 0; }
}

export function drawExcelGraphic(pdf: PDFDocument, page: PDFPage, graphic: ExcelGraphic, image: PDFImage, rect: GraphicRect, lib: typeof import("pdf-lib")) {
  const { x, y, width, height } = rect, angle = -graphic.rotation * Math.PI / 180;
  const crop = graphic.kind === "image" ? graphic.crop : { left: 0, right: 0, top: 0, bottom: 0 };
  const fullWidth = width / (1 - crop.left - crop.right), fullHeight = height / (1 - crop.top - crop.bottom);
  page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(1, 0, 0, 1, x + width / 2, y + height / 2), lib.concatTransformationMatrix(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0), lib.concatTransformationMatrix(graphic.flipH ? -1 : 1, 0, 0, graphic.flipV ? -1 : 1, -width / 2 * (graphic.flipH ? -1 : 1), -height / 2 * (graphic.flipV ? -1 : 1)), lib.rectangle(0, 0, width, height), lib.clip(), lib.endPath());
  page.drawImage(image, { x: -crop.left * fullWidth, y: -crop.bottom * fullHeight, width: fullWidth, height: fullHeight });
  page.pushOperators(lib.popGraphicsState());
  if (graphic.link) {
    const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y, x + width, y + height], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: lib.PDFString.of(graphic.link) } });
    page.node.addAnnot(pdf.context.register(annotation));
  }
}
