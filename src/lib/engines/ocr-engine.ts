import { ocrLanguages, ocrPages, normalizeOcrText, type OcrOptions } from "./ocr-options";
import { createOcrTextLayer } from "./ocr-text-layer";

/** Browser-local OCR using bundled Tesseract worker, core and language
 *  assets. Searchable PDF output preserves the input pages and adds an invisible,
 *  positioned text layer; image and DOCX consumers share the reusable worker. */

const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract";
const LANG_PATH = "/tesseract";

export interface OcrResult {
  text: string;
  confidence: number;
  /** Word positions in the source canvas, used for a correctly aligned text layer. */
  words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; line?: number }[];
}

export interface SearchableOcrPdfResult {
  blob: Blob;
  pageCount: number;
  recognizedText: string;
  processedPages: number[];
  pageResults: { page: number; confidence: number; words: number; text: string }[];
}

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

export interface OcrWorker {
  recognize: (
    image: File | Blob | HTMLCanvasElement,
    onProgress?: (progress: number) => void
  ) => Promise<OcrResult>;
  terminate: () => Promise<void>;
}

/** Creates one reusable Tesseract worker for multi-page OCR jobs. Spinning
 *  up the WASM worker and loading the English model is the expensive part;
 *  PDF-to-Word and OCR PDF can have dozens of pages, so reusing the same
 *  worker keeps free OCR practical instead of paying that startup cost once
 *  per page. */
function abortError(): DOMException {
  return new DOMException("OCR cancelled", "AbortError");
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(abortError()); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("OCR took too long. Try fewer pages, fewer languages or the standard resolution.")); }, 180_000);
    signal?.addEventListener("abort", abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal?.aborted) abort();
  });
}

export async function createOcrWorker(signal?: AbortSignal, options: OcrOptions = {}): Promise<OcrWorker> {
  const languages = ocrLanguages(options.languages);
  if (signal?.aborted) throw abortError();
  const { createWorker } = await import("tesseract.js");
  let activeProgress: ((progress: number) => void) | undefined;
  let worker: TesseractWorker | undefined;
  let terminated = false, abandoned = false;
  const terminate = async () => {
    if (terminated || !worker) return;
    terminated = true;
    signal?.removeEventListener("abort", onAbort);
    await worker.terminate();
  };
  const onAbort = () => { void terminate(); };
  signal?.addEventListener("abort", onAbort, { once: true });
  let rejectWorkerError: (error: Error) => void = () => {};
  const workerError = new Promise<never>((_, reject) => { rejectWorkerError = reject; });
  const creating = createWorker(options.languages ? languages : "eng", 1, {
    workerPath: WORKER_PATH,
    workerBlobURL: false,
    corePath: CORE_PATH,
    langPath: options.languages ? `${LANG_PATH}/lang-v1` : LANG_PATH,
    logger: (message) => {
      if (!signal?.aborted && message.status === "recognizing text") {
        activeProgress?.(message.progress * 100);
      }
    },
    // Tesseract rejects its operation promises too; avoid a second uncaught
    // error in the worker message handler so the tool can show its retry UI.
    errorHandler: (error) => rejectWorkerError(error instanceof Error ? error : new Error(String(error))),
  }).then(async (created) => {
    worker = created;
    // Tesseract exposes the worker only after initialization. A cancellation
    // during startup must dispose it as soon as it becomes available.
    if (signal?.aborted || abandoned) {
      await terminate();
      throw abortError();
    }
    return created;
  });
  try {
    await withAbort(Promise.race([creating, workerError]), signal);
  } catch (error) {
    abandoned = true;
    await terminate();
    signal?.removeEventListener("abort", onAbort);
    throw error;
  }

  return {
    async recognize(image, onProgress) {
      if (signal?.aborted || terminated) throw abortError();
      activeProgress = onProgress;
      try {
        const { data } = await withAbort(Promise.race([worker!.recognize(image, {}, { text: true, blocks: true }), workerError]), signal);
        let lineIndex = 0;
        const words = data.blocks?.flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.flatMap((line) => { const lineNumber = lineIndex++; return line.words.map(({ text, bbox }) => ({ text, bbox, line: lineNumber })); })
          )
        ) ?? [];
        return { text: normalizeOcrText(data.text, languages), confidence: data.confidence, words };
      } catch (error) {
        await terminate(); throw error;
      } finally {
        activeProgress = undefined;
      }
    },
    terminate,
  };
}

/** English recognition using the bundled model; no file leaves the browser. */
export async function recognizeText(
  image: File | Blob | HTMLCanvasElement,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<OcrResult> {
  const worker = await createOcrWorker(signal);
  try {
    return await worker.recognize(image, onProgress);
  } finally {
    await worker.terminate();
  }
}

export type OcrExportFormat = "txt" | "docx";

/** Packages recognized OCR text as a downloadable file in the chosen
 *  format. DOCX output reuses the same `docx` library (Document/Paragraph/
 *  Packer.toBlob) already verified real and in production use for PDF to
 *  Word — one paragraph per non-empty line, the same honest "text and
 *  structure, not layout" scope every conversion tool in this project
 *  discloses. */
export async function exportOcrResult(text: string, format: OcrExportFormat): Promise<Blob> {
  if (format === "txt") {
    return new Blob([text], { type: "text/plain" });
  }

  const { Document, Packer, Paragraph } = await import("docx");
  const paragraphs = text
    .split("\n")
    .map((line) => new Paragraph({ text: line, bidirectional: /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(line) }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}

/** Keep original streams, scans, annotations and geometry. Add only invisible
 * Unicode text; selected pages are recognized, all original pages are retained. */
export async function createSearchableOcrPdf(
  file: Blob,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean,
  signal?: AbortSignal,
  options: OcrOptions = {}
): Promise<SearchableOcrPdfResult | null> {
  const cancelled = () => signal?.aborted || isCancelled?.();
  if (cancelled()) return null;
  ocrLanguages(options.languages);
  if (file.size > 100 * 1024 * 1024) throw new Error("Choose a PDF up to 100MB.");
  const dpi = options.dpi ?? 144;
  if (![144, 150, 300].includes(dpi)) throw new Error("Choose standard or high OCR resolution.");
  const [{ PDFDocument, PDFName, PDFDict }, { loadPdfjs }] = await Promise.all([import("pdf-lib"), import("../pdfjs")]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (cancelled()) return null;
  const outputPdf = await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => { throw new Error("This PDF is damaged or password-protected. Choose an unlocked, readable copy."); });
  const form = outputPdf.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (form?.has(PDFName.of("XFA"))) throw new Error("Export this XFA form as a standard PDF before OCR.");
  if (outputPdf.catalog.has(PDFName.of("Perms")) || outputPdf.context.enumerateIndirectObjects().some(([, value]) => value instanceof PDFDict && (value.get(PDFName.of("FT"))?.toString() === "/Sig" || value.has(PDFName.of("ByteRange"))))) throw new Error("This PDF contains a signature or certification. OCR an unsigned copy to keep the original signature intact.");
  const selected = ocrPages(options.pages, outputPdf.getPageCount());
  const pdfjs = await loadPdfjs(), loading = pdfjs.getDocument({ data: bytes.slice() });
  const abortLoading = () => { void loading.destroy(); }; signal?.addEventListener("abort", abortLoading, { once: true });
  let worker: OcrWorker | undefined;
  const pageResults: SearchableOcrPdfResult["pageResults"] = [];
  let characters = 0, wordCount = 0;
  try {
    const inputPdf = await loading.promise;
    if (cancelled()) return null;
    const layer = await createOcrTextLayer(outputPdf, signal);
    worker = await createOcrWorker(signal, options);
    for (const [position, index] of selected.entries()) {
      if (cancelled()) return null;
      const page = await inputPdf.getPage(index + 1), original = page.getViewport({ scale: 1 });
      if (![original.width, original.height].every(n => Number.isFinite(n) && n > 0 && n <= 14400)) throw new Error(`Page ${index + 1} has unsupported dimensions. Export it at a standard page size first.`);
      const scale = Math.min(dpi / 72, Math.sqrt(20_000_000 / (original.width * original.height)), 8192 / original.width, 8192 / original.height);
      const viewport = page.getViewport({ scale }), content = await page.getTextContent();
      if (content.items.length > 100_000) throw new Error("A page contains too many text objects. Split or simplify this PDF first.");
      const nativeText = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const [a, b, c, d, x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
        const baseline = Math.hypot(a, b) || 1, vertical = Math.hypot(c, d) || 1;
        const width = item.width * viewport.scale, height = item.height * viewport.scale;
        const points = [[x, y], [x + a / baseline * width, y + b / baseline * width]];
        points.push(...points.map(([px, py]) => [px + c / vertical * height, py + d / vertical * height]));
        return [{ text: item.str.normalize("NFKC").toLocaleLowerCase(), left: Math.min(...points.map(([px]) => px)) - 2, right: Math.max(...points.map(([px]) => px)) + 2, top: Math.min(...points.map(([, py]) => py)) - 2, bottom: Math.max(...points.map(([, py]) => py)) + 2 }];
      });
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const render = page.render({ canvas, viewport, background: "rgb(255,255,255)" }), abortRender = () => render.cancel();
      signal?.addEventListener("abort", abortRender, { once: true });
      try {
        await render.promise; if (cancelled()) return null;
        const { text, confidence, words = [] } = await worker.recognize(canvas, p => onProgress?.(((position + p / 100) / selected.length) * 95));
        if (cancelled()) return null;
        if (text.trim() && !words.length) throw new Error(`Recognized text on page ${index + 1} could not be positioned. Try another scan resolution.`);
        characters += text.length; wordCount += words.length;
        if (characters > 2_000_000 || wordCount > 100_000) throw new Error("Too much recognized text. OCR fewer pages at a time.");
        pageResults.push({ page: index + 1, text: text.trim(), confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0, words: words.length });
        const outputPage = outputPdf.getPage(index);
        const lines = new Map<number, NonNullable<OcrResult["words"]>>();
        for (const [order, word] of words.entries()) {
          const text = word.text.replace(/[\u0000-\u001f\u007f]/g, ""), { x0, y0, x1, y1 } = word.bbox;
          if (!text.trim() || ![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) continue;
          const centerX = (x0 + x1) / 2, centerY = (y0 + y1) / 2;
          if (nativeText.some(item => item.text.includes(text.normalize("NFKC").toLocaleLowerCase()) && centerX >= item.left && centerX <= item.right && centerY >= item.top && centerY <= item.bottom)) continue;
          const id = word.line ?? order, line = lines.get(id) ?? []; line.push({ ...word, text }); lines.set(id, line);
        }
        // RTL phrases need one bidi pass; CJK phrases must not gain Latin word
        // separators. Their selection box follows the complete OCR line.
        const cjk = options.languages?.some(code => ["chi_sim", "chi_tra", "jpn"].includes(code));
        const drawingWords = [...lines.values()].flatMap(line => line.some(word => /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(word.text) || cjk && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word.text)) ? [{ text: normalizeOcrText(line.map(word => word.text).join(" "), options.languages ?? ["eng"]), bbox: { x0: Math.min(...line.map(w => w.bbox.x0)), y0: Math.min(...line.map(w => w.bbox.y0)), x1: Math.max(...line.map(w => w.bbox.x1)), y1: Math.max(...line.map(w => w.bbox.y1)) } }] : line);
        for (const [wordIndex, word] of drawingWords.entries()) {
          if (wordIndex % 250 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); if (cancelled()) return null; }
          const wordText = word.text.replace(/[\u0000-\u001f\u007f]/g, "");
          if (!wordText.trim()) continue;
          const { x0, y0, x1, y1 } = word.bbox;
          if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) continue;
          layer.draw(outputPage, wordText, viewport.convertToPdfPoint(x0, y1), viewport.convertToPdfPoint(x1, y1), viewport.convertToPdfPoint(x0, y0));
        }
      } finally { signal?.removeEventListener("abort", abortRender); canvas.width = 0; canvas.height = 0; page.cleanup(); }
      onProgress?.(((position + 1) / selected.length) * 95);
    }
    const recognizedText = pageResults.filter(p => p.text).map(p => `--- Page ${p.page} ---\n${p.text}`).join("\n\n");
    if (!recognizedText) throw new Error("No text was recognized. Check the selected languages and pages, or try a clearer, upright scan.");
    if (cancelled()) return null;
    layer.finish();
    const outputBytes = await outputPdf.save({ updateFieldAppearances: false });
    if (cancelled()) return null;
    onProgress?.(100);
    return { blob: new Blob([new Uint8Array(outputBytes).buffer], { type: "application/pdf" }), pageCount: inputPdf.numPages, processedPages: selected.map(i => i + 1), pageResults, recognizedText };
  } catch (error) { if (cancelled()) return null; throw error; }
  finally { signal?.removeEventListener("abort", abortLoading); await worker?.terminate(); await loading.destroy(); }
}
