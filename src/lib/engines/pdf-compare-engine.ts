import { loadPdfjs } from "../pdfjs";
import { assertNotCancelled } from "./pdf-visual-page";

export interface ComparisonOptions {
  ignoreWhitespace?: boolean; ignoreCase?: boolean; alignPages?: boolean;
  pixelThreshold?: number; signal?: AbortSignal; isCancelled?: () => boolean;
}
export interface ComparisonSegment { value: string; added: boolean; removed: boolean }
export interface ComparisonPage {
  originalPage: number | null; revisedPage: number | null;
  originalText: string; revisedText: string; segments: ComparisonSegment[];
  originalImage: string | null; revisedImage: string | null; overlayImage: string;
  width: number; height: number; changedPixels: number; pixelCount: number;
  textChanged: boolean; sizeChanged: boolean; changed: boolean; hasText: boolean;
  coarseTextDiff: boolean;
}
export interface ComparisonResult {
  pages: ComparisonPage[]; originalCount: number; revisedCount: number;
  pixelThreshold: number; ignoreWhitespace: boolean; ignoreCase: boolean; alignPages: boolean;
}
interface PageText { text: string; width: number; height: number }
const MAX_PAGES = 200, MAX_TEXT = 2_000_000, MAX_PREVIEW_CHARS = 128 * 1024 * 1024;
function check(options: ComparisonOptions) {
  if (options.signal?.aborted) throw new Error("Comparison cancelled.");
  assertNotCancelled(options.isCancelled);
}
function normalize(text: string, options: ComparisonOptions) {
  const spaced = options.ignoreWhitespace ? text.replace(/\s+/gu, " ").trim() : text;
  return options.ignoreCase ? spaced.toLocaleLowerCase() : spaced;
}

/** Exact text anchors retain page correspondence when a page is inserted.
 * Unmatched gaps are paired in order; scanned/blank pages use their order. */
export async function alignComparisonPages(a: string[], b: string[], options: ComparisonOptions = {}): Promise<[number | null, number | null][]> {
  if (!options.alignPages) return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [i < a.length ? i : null, i < b.length ? i : null]);
  const { diffArrays } = await import("diff");
  const pieces = diffArrays(a.map(value => normalize(value, options)), b.map(value => normalize(value, options)), { timeout: 1000, maxEditLength: 800 });
  if (!pieces) throw new Error("Page alignment took too long. Turn off automatic page alignment and compare again.");
  const pairs: [number | null, number | null][] = []; let ai = 0, bi = 0, pendingA: number[] = [], pendingB: number[] = [];
  const flush = () => { for (let i = 0; i < Math.max(pendingA.length, pendingB.length); i++) pairs.push([pendingA[i] ?? null, pendingB[i] ?? null]); pendingA = []; pendingB = []; };
  for (const piece of pieces) {
    if (piece.removed) for (let i = 0; i < piece.value.length; i++) pendingA.push(ai++);
    else if (piece.added) for (let i = 0; i < piece.value.length; i++) pendingB.push(bi++);
    else { flush(); for (let i = 0; i < piece.value.length; i++) pairs.push([ai++, bi++]); }
  }
  flush(); return pairs;
}

export function comparePagePixels(a: Uint8ClampedArray, b: Uint8ClampedArray, threshold = 16) {
  if (a.length !== b.length || a.length % 4 || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error("Choose a valid visual comparison sensitivity.");
  const pixels = new Uint8ClampedArray(a.length); let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    const difference = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (difference > threshold) {
      changed++;
      const before = (a[i] + a[i + 1] + a[i + 2]) / 3, after = (b[i] + b[i + 1] + b[i + 2]) / 3;
      const color = before + 12 < after ? [220, 38, 38] : after + 12 < before ? [22, 163, 74] : [147, 51, 234];
      pixels.set(color, i);
    } else {
      const gray = Math.round((a[i] + a[i + 1] + a[i + 2]) / 3 * 0.5 + 127.5);
      pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
    }
    pixels[i + 3] = 255;
  }
  return { pixels, changed };
}

export async function comparePdfDocuments(original: Blob, revised: Blob, options: ComparisonOptions = {}, onProgress?: (percent: number) => void): Promise<ComparisonResult> {
  check(options);
  const threshold = options.pixelThreshold ?? 16;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error("Choose a valid visual comparison sensitivity.");
  const pdfjs = await loadPdfjs();
  const tasks: import("pdfjs-dist").PDFDocumentLoadingTask[] = [];
  let activeRender: import("pdfjs-dist").RenderTask | undefined, passwordRequired = false;
  const abort = () => { activeRender?.cancel(); tasks.forEach(task => void task.destroy()); };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const docs: import("pdfjs-dist").PDFDocumentProxy[] = [];
    for (const file of [original, revised]) {
      const data = new Uint8Array(await file.arrayBuffer()); check(options);
      const task = pdfjs.getDocument({ data }); tasks.push(task);
      task.onPassword = () => { passwordRequired = true; void task.destroy(); };
      const pdf = await task.promise; check(options);
      if (!pdf.numPages || pdf.numPages > MAX_PAGES) throw new Error(`Compare PDFs with 1–${MAX_PAGES} pages each. Split longer files first.`);
      if (pdf.isPureXfa) throw new Error("Export XFA forms as standard PDFs before comparing them.");
      docs.push(pdf);
    }
    const texts: PageText[][] = [[], []]; let characters = 0, extracted = 0;
    for (let side = 0; side < 2; side++) for (let n = 1; n <= docs[side].numPages; n++) {
      check(options); const page = await docs[side].getPage(n), viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let text = content.items.filter(item => "str" in item).map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      const fields = (await page.getAnnotations()).filter(annotation => annotation.subtype === "Widget" && ["Tx", "Ch"].includes(annotation.fieldType));
      for (const field of fields) { const value = Array.isArray(field.fieldValue) ? field.fieldValue.join(", ") : field.fieldValue; if (typeof value === "string" && value) text += `\n${field.fieldName || "Form field"}: ${value}`; }
      characters += text.length;
      if (characters > MAX_TEXT) throw new Error("These PDFs contain too much text for one browser comparison. Compare smaller sections.");
      texts[side].push({ text, width: viewport.width, height: viewport.height });
      onProgress?.(++extracted / (docs[0].numPages + docs[1].numPages) * 25);
    }
    const pairs = await alignComparisonPages(texts[0].map(p => p.text), texts[1].map(p => p.text), options);
    const pages: ComparisonPage[] = []; let previewCharacters = 0;
    const { diffWordsWithSpace } = await import("diff");
    for (const [pairIndex, [a, b]] of pairs.entries()) {
      check(options);
      const first = a === null ? null : texts[0][a], second = b === null ? null : texts[1][b];
      const width = Math.max(first?.width ?? 0, second?.width ?? 0), height = Math.max(first?.height ?? 0, second?.height ?? 0);
      if (!Number.isFinite(width * height) || width < 1 || height < 1 || width > 14400 || height > 14400) throw new Error("A PDF page has unsupported dimensions. Crop or split it before comparing.");
      const scale = Math.min(1.5, Math.sqrt(2_000_000 / (width * height))), pixelWidth = Math.ceil(width * scale), pixelHeight = Math.ceil(height * scale);
      const surfaces: HTMLCanvasElement[] = [];
      try {
        for (const [side, index] of [[0, a], [1, b]] as const) {
          const canvas = document.createElement("canvas"); canvas.width = pixelWidth; canvas.height = pixelHeight; surfaces.push(canvas);
          const context = canvas.getContext("2d"); if (!context) throw new Error("This browser cannot render PDF pages.");
          context.fillStyle = "#ffffff"; context.fillRect(0, 0, pixelWidth, pixelHeight);
          if (index !== null) {
            const page = await docs[side].getPage(index + 1); check(options);
            activeRender = page.render({ canvas, viewport: page.getViewport({ scale }), background: "rgb(255,255,255)" });
            try { await activeRender.promise; } finally { activeRender = undefined; page.cleanup(); }
          }
        }
        check(options);
        const before = surfaces[0].getContext("2d")!.getImageData(0, 0, pixelWidth, pixelHeight), after = surfaces[1].getContext("2d")!.getImageData(0, 0, pixelWidth, pixelHeight);
        const difference = comparePagePixels(before.data, after.data, threshold);
        const overlay = document.createElement("canvas"); overlay.width = pixelWidth; overlay.height = pixelHeight; surfaces.push(overlay);
        const context = overlay.getContext("2d")!; const image = context.createImageData(pixelWidth, pixelHeight); image.data.set(difference.pixels); context.putImageData(image, 0, 0);
        const originalImage = a === null ? null : surfaces[0].toDataURL("image/png"), revisedImage = b === null ? null : surfaces[1].toDataURL("image/png"), overlayImage = overlay.toDataURL("image/png");
        previewCharacters += (originalImage?.length ?? 0) + (revisedImage?.length ?? 0) + overlayImage.length;
        if (previewCharacters > MAX_PREVIEW_CHARS) throw new Error("The comparison previews exceed this browser's memory limit. Compare smaller sections.");
        const originalText = first?.text ?? "", revisedText = second?.text ?? "", left = normalize(originalText, options), right = normalize(revisedText, options);
        const diff = diffWordsWithSpace(left, right, { timeout: 1000, maxEditLength: 10000 });
        const segments = (diff ?? [{ value: left, removed: true, added: false }, { value: right, added: true, removed: false }]).map(part => ({ value: part.value, added: !!part.added, removed: !!part.removed }));
        const textChanged = left !== right, sizeChanged = !!first && !!second && (Math.abs(first.width - second.width) > 0.01 || Math.abs(first.height - second.height) > 0.01);
        pages.push({ originalPage: a === null ? null : a + 1, revisedPage: b === null ? null : b + 1, originalText, revisedText, segments, originalImage, revisedImage, overlayImage, width, height, changedPixels: difference.changed, pixelCount: pixelWidth * pixelHeight, textChanged, sizeChanged, changed: textChanged || sizeChanged || difference.changed > 0 || a === null || b === null, hasText: !!(left.trim() || right.trim()), coarseTextDiff: !diff });
      } finally { for (const canvas of surfaces) { canvas.width = 1; canvas.height = 1; } }
      onProgress?.(25 + (pairIndex + 1) / pairs.length * 75);
    }
    check(options);
    return { pages, originalCount: docs[0].numPages, revisedCount: docs[1].numPages, pixelThreshold: threshold, ignoreWhitespace: !!options.ignoreWhitespace, ignoreCase: !!options.ignoreCase, alignPages: !!options.alignPages };
  } catch (error) {
    check(options);
    if (passwordRequired) throw new Error("A PDF is password-protected. Unlock it before comparing.");
    throw error;
  } finally { options.signal?.removeEventListener("abort", abort); await Promise.all(tasks.map(task => task.destroy())); }
}

export function comparisonTextReport(result: ComparisonResult): string {
  const lines = ["PDFPilot comparison report", `Original: ${result.originalCount} pages; revised: ${result.revisedCount} pages`, `Changed page pairs: ${result.pages.filter(p => p.changed).length} of ${result.pages.length}`, `Pixel threshold: ${result.pixelThreshold}; ignore whitespace: ${result.ignoreWhitespace}; ignore case: ${result.ignoreCase}; align pages: ${result.alignPages}`, "Text extraction does not OCR scans. Visual comparison excludes hidden metadata and attachments.", ""];
  for (const page of result.pages) {
    lines.push(`--- Original page ${page.originalPage ?? "absent"} / Revised page ${page.revisedPage ?? "absent"} ---`, `Text changed: ${page.textChanged}; page size changed: ${page.sizeChanged}; changed pixels: ${page.changedPixels}/${page.pixelCount}`);
    if (!page.hasText) lines.push("No selectable text. Review the visual comparison.");
    if (page.coarseTextDiff) lines.push("Detailed text matching exceeded its limit; full before/after blocks are shown.");
    for (const part of page.segments) lines.push(`[${part.added ? "ADDED" : part.removed ? "REMOVED" : "UNCHANGED"}] ${part.value}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** The PDF report embeds the compared page images, so source glyphs remain
 * visible regardless of the report viewer's installed language fonts. */
export async function comparisonPdfReport(result: ComparisonResult, isCancelled?: () => boolean): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle("PDF comparison report"); pdf.setCreator("PDFPilot");
  const summary = pdf.addPage([595.28, 841.89]);
  const lines = ["PDF comparison report", `Original: ${result.originalCount} pages | Revised: ${result.revisedCount} pages`, `${result.pages.filter(page => page.changed).length} changed page pairs of ${result.pages.length}`, `Visual sensitivity threshold: ${result.pixelThreshold} (0 is strictest)`, `Ignore whitespace: ${result.ignoreWhitespace} | Ignore case: ${result.ignoreCase}`, `Automatic page alignment: ${result.alignPages}`, "", "Each pair includes the original, revised page and difference overlay.", "Red = darker in original. Green = darker in revised. Purple = color change.", "Unchanged content is gray. Page sizes are compared separately.", "", "Download the separate text report for the full added/removed text.", "Scans are compared visually; no OCR is performed.", "Hidden metadata, attachments and digital signatures are not compared."];
  lines.forEach((line, i) => summary.drawText(line, { x: 36, y: 792 - i * 26, size: i ? 10 : 22, font: i ? font : bold }));
  for (const [index, item] of result.pages.entries()) {
    assertNotCancelled(isCancelled);
    const label = `Pair ${index + 1}: original ${item.originalPage ?? "absent"} / revised ${item.revisedPage ?? "absent"}`;
    const page = pdf.addPage([841.89, 595.28]);
    page.drawText(label, { x: 28, y: 565, size: 13, font: bold });
    page.drawText(`Text changes: ${item.textChanged} | Size changes: ${item.sizeChanged} | Changed pixels: ${(item.changedPixels / item.pixelCount * 100).toFixed(3)}%`, { x: 28, y: 546, size: 9, font });
    for (const [column, [title, source]] of [["Original", item.originalImage], ["Revised", item.revisedImage], ["Difference overlay", item.overlayImage]].entries()) {
      const x = 28 + column * 266; page.drawText(title!, { x, y: 519, size: 11, font: bold });
      if (source) {
        const image = await pdf.embedPng(source), scale = Math.min(252 / image.width, 470 / image.height);
        page.drawImage(image, { x, y: 500 - image.height * scale, width: image.width * scale, height: image.height * scale });
      } else page.drawText("Page absent", { x, y: 470, size: 11, font, color: rgb(0.5, 0.5, 0.5) });
    }
  }
  assertNotCancelled(isCancelled); const bytes = await pdf.save(); assertNotCancelled(isCancelled);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
