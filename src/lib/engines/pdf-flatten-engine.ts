import {
  PDFAcroTerminal, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRef, PDFSignature, PDFStream,
  concatTransformationMatrix, drawObject, popGraphicsState, pushGraphicsState,
} from "pdf-lib";

export interface FlattenResult {
  blob: Blob;
  pageCount: number;
  fieldCount: number;
  annotationCount: number;
  unchanged: boolean;
}
export interface FlattenOptions { signal?: AbortSignal; onProgress?: (percent: number) => void }
function check(options: FlattenOptions) { if (options.signal?.aborted) throw new Error("Flattening cancelled."); }
async function checkpoint(options: FlattenOptions) { await new Promise(resolve => setTimeout(resolve, 0)); check(options); }
const SAFE_ERROR = "This form's appearance could not be preserved safely. Open and save it in a PDF editor first, then retry. No partial output was downloaded.";

function numbers(array: PDFArray | undefined, fallback?: number[]): number[] {
  if (!array) { if (fallback) return fallback; throw new Error(SAFE_ERROR); }
  return array.asArray().map(value => {
    if (!(value instanceof PDFNumber) || !Number.isFinite(value.asNumber())) throw new Error(SAFE_ERROR);
    return value.asNumber();
  });
}

/** Flatten form widgets only. Keep original text, images, fonts and annotations. */
export async function flattenPdfSafely(file: File, options: FlattenOptions = {}): Promise<FlattenResult> {
  check(options); options.onProgress?.(2);
  if (file.size > 100 * 1024 * 1024) throw new Error("Each PDF must be 100MB or smaller.");
  const bytes = await file.arrayBuffer();
  check(options);
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => {
    throw new Error("This PDF is damaged or password-protected. Use an unlocked, readable copy.");
  });
  await checkpoint(options); options.onProgress?.(15);
  if (pdf.isEncrypted) throw new Error("Unlock this PDF before flattening.");
  const pageCount = pdf.getPageCount();
  if (!pageCount) throw new Error("This PDF has no pages.");
  const acroForm = pdf.catalog.AcroForm();
  if (acroForm?.has(PDFName.of("XFA"))) throw new Error("XFA forms are not supported. Export a standard PDF form first.");
  const form = pdf.getForm();
  const fields = form.getFields();
  if (fields.some(field => field instanceof PDFSignature) || pdf.catalog.has(PDFName.of("Perms"))) {
    throw new Error("This file contains signature fields or certification. Flattening could invalidate a digital signature; use an unsigned copy.");
  }
  // A viewer may show a regenerated value instead of the saved appearance. Never
  // burn in potentially stale values while claiming to preserve what users see.
  if (acroForm?.get(PDFName.of("NeedAppearances"))?.toString() === "true") {
    throw new Error("This form asks the PDF viewer to regenerate its appearance. Open and save it in a PDF editor before flattening.");
  }
  const pages = pdf.getPages();
  let annotationCount = 0;
  const widgetPages = new Map<PDFDict, typeof pages[number]>();
  let inspectedWidgets = 0;
  for (const [pageIndex, page] of pages.entries()) {
    if (pageIndex % 10 === 0) await checkpoint(options); options.onProgress?.(15 + 20 * (pageIndex + 1) / pages.length);
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      if (++inspectedWidgets % 100 === 0) await checkpoint(options);
      const annotation = pdf.context.lookup(ref, PDFDict);
      if (annotation.get(PDFName.of("Subtype")) === PDFName.of("Widget")) {
        if (widgetPages.has(annotation)) throw new Error(SAFE_ERROR);
        widgetPages.set(annotation, page);
      } else annotationCount += 1;
    }
  }
  // pdf-lib ignores unrecognized field types: refuse rather than drop them.
  if (form.acroForm.getAllFields().filter(([field]) => field instanceof PDFAcroTerminal).length !== fields.length) throw new Error(SAFE_ERROR);
  if (!fields.length && !widgetPages.size) { check(options); options.onProgress?.(100); return { blob: new Blob([bytes], { type: "application/pdf" }), pageCount, fieldCount: 0, annotationCount, unchanged: true }; }
  try {
    form.updateFieldAppearances();
    const flattened = new Set<PDFDict>();
    let completedWidgets = 0;
    for (const [fieldIndex, field] of fields.entries()) {
      if (fieldIndex % 10 === 0) await checkpoint(options); options.onProgress?.(35 + 45 * (fieldIndex + 1) / fields.length);
      for (const widget of field.acroField.getWidgets()) {
        if (++completedWidgets % 20 === 0) await checkpoint(options);
        const page = widgetPages.get(widget.dict);
        if (!page || flattened.has(widget.dict)) throw new Error(SAFE_ERROR);
        flattened.add(widget.dict);
        const flags = widget.getFlags();
        // Conditional visibility cannot be represented by ordinary page content.
        if ((flags & (8 | 16 | 32 | 256)) || widget.dict.has(PDFName.of("OC"))) throw new Error(SAFE_ERROR);
        // Invisible (bit 1) applies only to unknown annotation types; Widget is
        // recognized, so its appearance remains visible. Only Hidden hides it.
        if (flags & 2) continue;
        let appearance = widget.AP()?.get(PDFName.of("N"));
        const normal = pdf.context.lookup(appearance);
        if (normal instanceof PDFDict) {
          const state = widget.getAppearanceState();
          if (!state) throw new Error(SAFE_ERROR);
          appearance = normal.get(state);
        }
        const stream = pdf.context.lookup(appearance);
        if (!(stream instanceof PDFStream)) throw new Error(SAFE_ERROR);
        const ref = appearance instanceof PDFRef ? appearance : pdf.context.register(stream);
        const box = numbers(stream.dict.lookupMaybe(PDFName.of("BBox"), PDFArray));
        const matrix = numbers(stream.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray), [1, 0, 0, 1, 0, 0]);
        if (box.length !== 4 || matrix.length !== 6) throw new Error(SAFE_ERROR);
        const [a, b, c, d, e, f] = matrix;
        const points = [[box[0], box[1]], [box[0], box[3]], [box[2], box[1]], [box[2], box[3]]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
        const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
        const width = Math.max(...points.map(p => p[0])) - minX, height = Math.max(...points.map(p => p[1])) - minY;
        const rect = widget.getRectangle();
        if (width <= 0 || height <= 0 || rect.width <= 0 || rect.height <= 0) throw new Error(SAFE_ERROR);
        const sx = rect.width / width, sy = rect.height / height;
        // PDF annotation appearance mapping: transform BBox by its own Matrix,
        // then fit those bounds into Rect. The XObject applies Matrix itself.
        const key = page.node.newXObject("FlatWidget", ref);
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(sx, 0, 0, sy, rect.x - minX * sx, rect.y - minY * sy), drawObject(key), popGraphicsState());
      }
    }
    if (flattened.size !== widgetPages.size) throw new Error(SAFE_ERROR);
    for (const page of pages) {
      const annotations = page.node.Annots();
      if (!annotations) continue;
      for (let index = annotations.size() - 1; index >= 0; index -= 1) {
        if (flattened.has(pdf.context.lookup(annotations.get(index), PDFDict))) annotations.remove(index);
      }
    }
    pdf.catalog.delete(PDFName.of("AcroForm"));
    await checkpoint(options); options.onProgress?.(85);
    const output = await pdf.save({ updateFieldAppearances: false });
    check(options); options.onProgress?.(95);
    const verified = await PDFDocument.load(output, { updateMetadata: false });
    if (verified.catalog.AcroForm() || verified.getPageCount() !== pageCount) throw new Error(SAFE_ERROR);
    check(options); options.onProgress?.(100);
    return { blob: new Blob([output as BlobPart], { type: "application/pdf" }), pageCount, fieldCount: fields.length, annotationCount, unchanged: false };
  } catch {
    check(options); throw new Error(SAFE_ERROR);
  }
}

export function flattenedFilename(name: string): string {
  return (name.replace(/\.pdf$/i, "").replace(/[\\/\u0000-\u001f]/g, "_") || "document") + "_flattened.pdf";
}

/** Numeric prefixes avoid duplicate names and path traversal in ZIP readers. */
export async function flattenArchiveEntries(entries: { name: string; blob: Blob }[], signal?: AbortSignal): Promise<Record<string, Uint8Array>> {
  check({ signal });
  if (entries.reduce((n, entry) => n + entry.blob.size, 0) > 200 * 1024 * 1024) throw new Error("Results exceed 200MB. Download the PDFs individually.");
  const result: Record<string, Uint8Array> = Object.create(null);
  for (const [index, entry] of entries.entries()) { check({ signal }); result[`${index + 1}_${flattenedFilename(entry.name)}`] = new Uint8Array(await entry.blob.arrayBuffer()); }
  check({ signal });
  return result;
}

/** Build the download before presenting success; cancellation terminates ZIP work. */
export async function createFlattenZip(entries: { name: string; blob: Blob }[], signal?: AbortSignal): Promise<Blob> {
  const files = await flattenArchiveEntries(entries, signal), { zip } = await import("fflate"); check({ signal });
  return new Promise((resolve, reject) => {
    const abort = () => { terminate(); reject(new Error("Flattening cancelled.")); };
    const terminate = zip(files, { level: 0 }, (error, bytes) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) return;
      if (error) reject(new Error("Could not prepare the ZIP. Download the PDFs individually."));
      else resolve(new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" }));
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
