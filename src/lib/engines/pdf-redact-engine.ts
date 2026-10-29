import { loadPdfjs } from "../pdfjs";
import { assertNotCancelled } from "./pdf-visual-page";

/** Fractions of the visible, rotated page, measured from its top-left. */
export interface RedactionArea { id: string; pageIndex: number; x: number; y: number; width: number; height: number; label?: string }
export type RedactionSearch = "text" | "email" | "phone" | "card";
export interface RedactionMatch { id: string; pageIndex: number; text: string; areas: RedactionArea[] }
export interface RedactionOptions { dpi?: 150 | 300; color?: string; isCancelled?: () => boolean; signal?: AbortSignal }
const MAX_PIXELS = 32_000_000, MAX_OUTPUT_BYTES = 128 * 1024 * 1024;

function check(options: RedactionOptions) {
  if (options.signal?.aborted) throw new Error("Processing cancelled.");
  assertNotCancelled(options.isCancelled);
}
export function redactionPageSelection(scope: "current" | "all" | "odd" | "even" | "range", current: number, count: number, range = ""): number[] {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(current) || current < 0 || current >= count) throw new Error("Choose a valid PDF page.");
  if (scope === "current") return [current];
  if (["all", "odd", "even"].includes(scope)) return Array.from({ length: count }, (_, i) => i).filter(i => scope === "all" || (i + 1) % 2 === (scope === "odd" ? 1 : 0));
  const pages = new Set<number>();
  for (const piece of range.split(",")) {
    const match = piece.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    const start = Number(match?.[1]), end = Number(match?.[2] ?? match?.[1]);
    if (!match || start < 1 || end < start || end > count) throw new Error(`Enter pages between 1 and ${count}, for example 1, 3-5.`);
    for (let page = start; page <= end; page++) pages.add(page - 1);
  }
  return [...pages].sort((a, b) => a - b);
}
function validateAreas(areas: RedactionArea[], count: number) {
  if (!areas.length) throw new Error("Mark at least one area before redacting.");
  if (areas.length > 5000) throw new Error("This document has too many marked areas. Redact it in smaller sections.");
  for (const area of areas) {
    if (!Number.isInteger(area.pageIndex) || area.pageIndex < 0 || area.pageIndex >= count || ![area.x, area.y, area.width, area.height].every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0 || area.x + area.width > 1.000001 || area.y + area.height > 1.000001) throw new Error("A marked area is outside its page. Adjust or remove it before saving.");
  }
}

/** Rebuild from masked RGB pixels only. Never copy a source PDF object,
 * metadata stream, attachment, text layer, annotation or incremental history. */
export async function redactPdf(file: Blob, areas: RedactionArea[], options: RedactionOptions = {}, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const dpi = options.dpi ?? 150, color = options.color ?? "#000000";
  if (![150, 300].includes(dpi) || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose a valid redaction color and 150 or 300 DPI.");
  check(options);
  const [pdfjs, { PDFDocument, pushGraphicsState, concatTransformationMatrix, drawObject, popGraphicsState }] = await Promise.all([loadPdfjs(), import("pdf-lib")]);
  const data = new Uint8Array(await file.arrayBuffer());
  check(options);
  const task = pdfjs.getDocument({ data });
  let passwordRequired = false;
  task.onPassword = () => { passwordRequired = true; void task.destroy(); };
  let rendering: import("pdfjs-dist").RenderTask | undefined;
  const abort = () => { rendering?.cancel(); void task.destroy(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const source = await task.promise;
    if (source.isPureXfa) throw new Error("Export this XFA form as a standard PDF before redacting it.");
    validateAreas(areas, source.numPages);
    const output = await PDFDocument.create();
    output.setTitle("Redacted document"); output.setCreator("PDFPilot"); output.setProducer("PDFPilot redaction");
    let compressedBytes = 0;
    for (let n = 1; n <= source.numPages; n++) {
      check(options);
      const page = await source.getPage(n), physical = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: dpi / 72 });
      const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
      if (width * height > MAX_PIXELS || physical.width > 14400 || physical.height > 14400) throw new Error(`Page ${n} is too large at this resolution. Choose 150 DPI or split/crop the PDF first.`);
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      try {
        const context = canvas.getContext("2d", { colorSpace: "srgb" });
        if (!context) throw new Error("This browser cannot render PDF pages.");
        rendering = page.render({ canvas, viewport, background: "rgb(255,255,255)" });
        await rendering.promise; rendering = undefined; check(options);
        context.fillStyle = color;
        // Outward rounding plus two pixels covers antialiased boundary pixels.
        for (const area of areas.filter(a => a.pageIndex === n - 1)) {
          const left = Math.floor(area.x * viewport.width) - 2, top = Math.floor(area.y * viewport.height) - 2;
          const right = Math.ceil((area.x + area.width) * viewport.width) + 2, bottom = Math.ceil((area.y + area.height) * viewport.height) + 2;
          context.fillRect(left, top, right - left, bottom - top);
        }
        const pixels = context.getImageData(0, 0, width, height).data, rgb = new Uint8Array(width * height * 3);
        for (let input = 0, target = 0; input < pixels.length; input += 4) {
          const alpha = pixels[input + 3] / 255;
          for (let c = 0; c < 3; c++) rgb[target++] = Math.round(pixels[input + c] * alpha + 255 * (1 - alpha));
        }
        check(options);
        const stream = output.context.flateStream(rgb, { Type: "XObject", Subtype: "Image", Width: width, Height: height, BitsPerComponent: 8, ColorSpace: "DeviceRGB", Interpolate: false });
        compressedBytes += stream.getContentsSize();
        if (compressedBytes > MAX_OUTPUT_BYTES) throw new Error("The redacted copy exceeds the 128 MB browser output limit. Choose 150 DPI or split the PDF first.");
        const outputPage = output.addPage([physical.width, physical.height]);
        const name = outputPage.node.newXObject("RedactedPage", output.context.register(stream));
        outputPage.pushOperators(pushGraphicsState(), concatTransformationMatrix(physical.width, 0, 0, physical.height, 0, 0), drawObject(name), popGraphicsState());
      } finally { canvas.width = 1; canvas.height = 1; page.cleanup(); }
      onProgress?.(n, source.numPages);
    }
    check(options);
    const bytes = await output.save({ addDefaultPage: false });
    check(options);
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  } catch (error) {
    check(options);
    if (passwordRequired) throw new Error("This PDF is password-protected. Unlock it before redacting.");
    throw error;
  } finally { options.signal?.removeEventListener("abort", abort); await task.destroy(); }
}

function cardNumberIsValid(text: string) {
  const digits = text.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 1, double = false; i >= 0; i--, double = !double) {
    let n = Number(digits[i]); if (double) { n *= 2; if (n > 9) n -= 9; } sum += n;
  }
  return sum % 10 === 0;
}
export function redactionPattern(kind: RedactionSearch, query: string) {
  if (kind === "email") return /[a-z0-9._%+-]+\s*@\s*(?:[a-z0-9-]+\s*\.\s*)+[a-z]{2,63}/giu;
  if (kind === "phone") return /\+?\d[\d ().-]{5,}\d/g;
  if (kind === "card") return /\b\d(?:[ -]?\d){12,18}\b/g;
  if (!query.trim() || query.length > 200) throw new Error("Enter between 1 and 200 characters to find.");
  return new RegExp(query.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "giu");
}

/** Finds candidates in selectable text. Entire intersecting text blocks are
 * marked so unusual font encodings/kerning cannot leave a partial word. */
export async function findRedactionMatches(pdf: import("pdfjs-dist").PDFDocumentProxy, kind: RedactionSearch, query: string, isCancelled?: () => boolean, onProgress?: (done: number, total: number) => void): Promise<RedactionMatch[]> {
  const pattern = redactionPattern(kind, query), matches: RedactionMatch[] = [];
  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    assertNotCancelled(isCancelled);
    const page = await pdf.getPage(pageIndex + 1), viewport = page.getViewport({ scale: 1 }), text = await page.getTextContent();
    const blocks: { start: number; end: number; area: RedactionArea }[] = [];
    let joined = "";
    for (const item of text.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [a, b, c, d, e, f] = viewport.transform, t = item.transform;
      const vx = a * t[0] + c * t[1], vy = b * t[0] + d * t[1], angle = Math.atan2(vy, vx);
      const size = Math.hypot(a * t[2] + c * t[3], b * t[2] + d * t[3]) || item.height || 10;
      const ux = Math.cos(angle), uy = Math.sin(angle), baselineX = a * t[4] + c * t[5] + e, baselineY = b * t[4] + d * t[5] + f;
      const style = text.styles[item.fontName], above = size * Math.max(1, style?.ascent ?? 0.9), below = size * Math.max(0.35, -(style?.descent ?? -0.25));
      const length = Math.max(item.width * viewport.scale, size * 0.2);
      const corners = [[0, -above], [length, -above], [length, below], [0, below]].map(([x, y]) => ({ x: baselineX + ux * x - uy * y, y: baselineY + uy * x + ux * y }));
      const x = Math.max(0, Math.min(...corners.map(p => p.x)) - 1), y = Math.max(0, Math.min(...corners.map(p => p.y)) - 1);
      const right = Math.min(viewport.width, Math.max(...corners.map(p => p.x)) + 1), bottom = Math.min(viewport.height, Math.max(...corners.map(p => p.y)) + 1);
      const start = joined.length; joined += item.str; const end = joined.length; joined += " ";
      if (right > x && bottom > y) blocks.push({ start, end, area: { id: `text-${pageIndex}-${blocks.length}`, pageIndex, x: x / viewport.width, y: y / viewport.height, width: (right - x) / viewport.width, height: (bottom - y) / viewport.height } });
    }
    // AcroForm values are not included in getTextContent. Include the whole
    // visible widget so sensitive filled-in text is not missed by search.
    for (const annotation of await page.getAnnotations()) {
      if (annotation.subtype !== "Widget" || !["Tx", "Ch"].includes(annotation.fieldType)) continue;
      const value = Array.isArray(annotation.fieldValue) ? annotation.fieldValue.join(" ") : annotation.fieldValue;
      if (typeof value !== "string" || !value.trim() || !Array.isArray(annotation.rect)) continue;
      const [a, b, c, d, e, f] = viewport.transform, sourceRect = annotation.rect;
      const rect = [a * sourceRect[0] + c * sourceRect[1] + e, b * sourceRect[0] + d * sourceRect[1] + f, a * sourceRect[2] + c * sourceRect[3] + e, b * sourceRect[2] + d * sourceRect[3] + f];
      const x = Math.max(0, Math.min(rect[0], rect[2]) - 1), y = Math.max(0, Math.min(rect[1], rect[3]) - 1);
      const right = Math.min(viewport.width, Math.max(rect[0], rect[2]) + 1), bottom = Math.min(viewport.height, Math.max(rect[1], rect[3]) + 1);
      const start = joined.length; joined += value; const end = joined.length; joined += " ";
      if (right > x && bottom > y) blocks.push({ start, end, area: { id: `field-${pageIndex}-${blocks.length}`, pageIndex, x: x / viewport.width, y: y / viewport.height, width: (right - x) / viewport.width, height: (bottom - y) / viewport.height } });
    }
    pattern.lastIndex = 0;
    for (const found of joined.matchAll(pattern)) {
      if (kind === "card" && !cardNumberIsValid(found[0])) continue;
      if (kind === "phone" && (found[0].replace(/\D/g, "").length < 7 || found[0].replace(/\D/g, "").length > 15)) continue;
      const start = found.index ?? 0, end = start + found[0].length;
      const areas = blocks.filter(block => block.end > start && block.start < end).map(block => block.area);
      if (!areas.length) continue;
      matches.push({ id: `match-${pageIndex}-${start}`, pageIndex, text: found[0].trim(), areas });
      if (matches.length > 1000) throw new Error("More than 1,000 matches were found. Use a narrower search or split the PDF.");
    }
    onProgress?.(pageIndex + 1, pdf.numPages);
  }
  assertNotCancelled(isCancelled);
  return matches;
}
