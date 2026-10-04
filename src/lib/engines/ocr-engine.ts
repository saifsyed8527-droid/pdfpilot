/** Browser-local English OCR using bundled Tesseract worker, core and language
 *  assets. Searchable PDF output preserves the input pages and adds an invisible,
 *  positioned text layer; image and DOCX consumers share the reusable worker. */

const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract/tesseract-core-simd-lstm.wasm.js";
const LANG_PATH = "/tesseract";

export interface OcrResult {
  text: string;
  confidence: number;
  /** Word positions in the source canvas, used for a correctly aligned text layer. */
  words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
}

export interface SearchableOcrPdfResult {
  blob: Blob;
  pageCount: number;
  recognizedText: string;
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
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function createOcrWorker(signal?: AbortSignal): Promise<OcrWorker> {
  if (signal?.aborted) throw abortError();
  const { createWorker } = await import("tesseract.js");
  let activeProgress: ((progress: number) => void) | undefined;
  let worker: TesseractWorker | undefined;
  let terminated = false;
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
  const creating = createWorker("eng", undefined, {
    workerPath: WORKER_PATH,
    workerBlobURL: false,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
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
    if (signal?.aborted) {
      await terminate();
      throw abortError();
    }
    return created;
  });
  try {
    await withAbort(Promise.race([creating, workerError]), signal);
  } catch (error) {
    signal?.removeEventListener("abort", onAbort);
    throw error;
  }

  return {
    async recognize(image, onProgress) {
      if (signal?.aborted || terminated) throw abortError();
      activeProgress = onProgress;
      try {
        const { data } = await withAbort(worker!.recognize(image, {}, { text: true, blocks: true }), signal);
        const words = data.blocks?.flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.flatMap((line) => line.words.map(({ text, bbox }) => ({ text, bbox })))
          )
        ) ?? [];
        return { text: data.text, confidence: data.confidence, words };
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
    .filter((line) => line.trim())
    .map((line) => new Paragraph({ text: line }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}

/** Keep original page streams, images, annotations and page geometry. Only
 *  add invisible text at the recognition boxes; do not re-encode the scan. */
export async function createSearchableOcrPdf(
  file: Blob,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean,
  signal?: AbortSignal
): Promise<SearchableOcrPdfResult | null> {
  const cancelled = () => signal?.aborted || isCancelled?.();
  if (cancelled()) return null;
  const [{ PDFDocument, degrees }, { loadPdfjs }, fontkitModule] = await Promise.all([
    import("pdf-lib"), import("../pdfjs"), import("fontkit"),
  ]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const outputPdf = await PDFDocument.load(bytes);
  const pdfjs = await loadPdfjs();
  const loading = pdfjs.getDocument({ data: bytes.slice() });
  const inputPdf = await loading.promise;
  let worker: OcrWorker | undefined;
  const allText: string[] = [];
  try {
    if (cancelled()) return null;
    const fontResponse = await fetch("/fonts/NotoSans-Regular.ttf", { signal });
    if (!fontResponse.ok) throw new Error("The OCR text font could not be loaded. Please try again.");
    outputPdf.registerFontkit((fontkitModule.default ?? fontkitModule) as unknown as Parameters<typeof outputPdf.registerFontkit>[0]);
    const font = await outputPdf.embedFont(await fontResponse.arrayBuffer());
    worker = await createOcrWorker(signal);
    for (let index = 0; index < inputPdf.numPages; index++) {
      if (cancelled()) return null;
      const page = await inputPdf.getPage(index + 1);
      const viewport = page.getViewport({ scale: 2 });
      // Mixed documents can already contain native headers or other text.
      // Avoid overlaying a second copy of words at the same position.
      const nativeText = (await page.getTextContent()).items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const [a, b, c, d, x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
        const baseline = Math.hypot(a, b) || 1;
        const vertical = Math.hypot(c, d) || 1;
        const width = item.width * viewport.scale;
        const height = item.height * viewport.scale;
        const points = [[x, y], [x + a / baseline * width, y + b / baseline * width]];
        points.push(...points.map(([px, py]) => [px + c / vertical * height, py + d / vertical * height]));
        return [{ text: item.str.normalize("NFKC").toLocaleLowerCase(),
          left: Math.min(...points.map(([px]) => px)) - 2, right: Math.max(...points.map(([px]) => px)) + 2,
          top: Math.min(...points.map(([, py]) => py)) - 2, bottom: Math.max(...points.map(([, py]) => py)) + 2 }];
      });
      // One canvas at a time bounds memory even for multi-page documents.
      if (viewport.width * viewport.height > 40_000_000) {
        throw new Error("A page is too large for browser OCR. Please use a smaller scan.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const render = page.render({ canvas, viewport });
      const abortRender = () => render.cancel();
      signal?.addEventListener("abort", abortRender, { once: true });
      try {
        await render.promise;
        if (cancelled()) return null;
        const { text, words = [] } = await worker.recognize(canvas, (progress) => {
          onProgress?.(((index + progress / 100) / inputPdf.numPages) * 95);
        });
        if (cancelled()) return null;
        allText.push(text.trim() ? `--- Page ${index + 1} ---\n${text.trim()}` : "");
        const outputPage = outputPdf.getPage(index);
        for (const word of words) {
          // Preserve accents and punctuation. Only unsupported control
          // characters are discarded; the embedded font supplies Unicode.
          const wordText = word.text.replace(/[\u0000-\u001f\u007f]/g, "");
          if (!wordText.trim()) continue;
          const { x0, y0, x1, y1 } = word.bbox;
          const centerX = (x0 + x1) / 2, centerY = (y0 + y1) / 2;
          if (nativeText.some((item) => item.text.includes(wordText.normalize("NFKC").toLocaleLowerCase())
            && centerX >= item.left && centerX <= item.right && centerY >= item.top && centerY <= item.bottom)) continue;
          const [x, y] = viewport.convertToPdfPoint(x0, y1);
          const [endX, endY] = viewport.convertToPdfPoint(x1, y1);
          const [topX, topY] = viewport.convertToPdfPoint(x0, y0);
          const width = Math.hypot(endX - x, endY - y);
          const height = Math.hypot(topX - x, topY - y);
          if (width <= 0 || height <= 0) continue;
          const naturalWidth = font.widthOfTextAtSize(wordText, 1);
          const size = Math.min(height / font.heightAtSize(1, { descender: false }), width / naturalWidth);
          outputPage.drawText(wordText, {
            x, y, font, size, rotate: degrees(Math.atan2(endY - y, endX - x) * 180 / Math.PI),
            opacity: 0,
          });
        }
      } finally {
        signal?.removeEventListener("abort", abortRender);
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
      onProgress?.(((index + 1) / inputPdf.numPages) * 95);
    }
    const recognizedText = allText.join("\n\n").trim();
    if (!recognizedText.replace(/--- Page \d+ ---/g, "").trim()) {
      throw new Error("No text could be recognized in this PDF. It may be blank, or the scan quality may be too low.");
    }
    if (cancelled()) return null;
    const outputBytes = await outputPdf.save();
    if (cancelled()) return null;
    const blobPart = new ArrayBuffer(outputBytes.byteLength);
    new Uint8Array(blobPart).set(outputBytes);
    onProgress?.(100);
    return { blob: new Blob([blobPart], { type: "application/pdf" }), pageCount: inputPdf.numPages, recognizedText };
  } catch (error) {
    if (cancelled()) return null;
    throw error;
  } finally {
    await worker?.terminate();
    await loading.destroy();
  }
}
