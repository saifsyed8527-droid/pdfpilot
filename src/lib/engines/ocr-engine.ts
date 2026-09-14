/**
 * OCR Engine — wraps tesseract.js (verified real: v7.0.0, actively
 * maintained, 38k+ GitHub stars, `createWorker`/`worker.recognize` publicly
 * typed in node_modules/tesseract.js/src/index.d.ts). Loaded dynamically,
 * consistent with every other heavy library in this project.
 *
 * tesseract.js's `recognize()` accepts a File/Blob/HTMLCanvasElement
 * directly (its own `ImageLike` type) — no separate decode step needed
 * here, unlike the Image Engine, which has to produce a canvas itself for
 * format conversion.
 *
 * By default tesseract.js fetches its worker script, WASM core, and
 * language data from cdn.jsdelivr.net — the site's Content-Security-Policy
 * blocks that (verified: this was a real bug, not a hypothetical one —
 * first live test threw "Error running OCR: undefined" with no network
 * failure logged, because CSP silently blocks the fetch before it's even
 * attempted). Fixed the same way pdfjs's worker already is in this
 * project (see src/lib/pdfjs.ts, workerSrc: "/pdf.worker.min.js"): all
 * three assets are copied into public/tesseract/ and referenced by
 * `workerPath`/`corePath`/`langPath` below, so OCR needs zero third-party
 * network access and the CSP stays exactly as strict as it already was.
 */

const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract/tesseract-core-simd-lstm.wasm.js";
const LANG_PATH = "/tesseract";

export interface OcrResult {
  text: string;
  confidence: number;
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
export async function createOcrWorker(): Promise<OcrWorker> {
  const { createWorker } = await import("tesseract.js");
  let activeProgress: ((progress: number) => void) | undefined;
  const worker: TesseractWorker = await createWorker("eng", undefined, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    logger: (message) => {
      if (message.status === "recognizing text" && activeProgress) {
        activeProgress(message.progress * 100);
      }
    },
  });

  return {
    async recognize(image, onProgress) {
      activeProgress = onProgress;
      try {
        const {
          data: { text, confidence },
        } = await worker.recognize(image);
        return { text, confidence };
      } finally {
        activeProgress = undefined;
      }
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

/** Runs OCR on a single image (File/Blob) or canvas and returns the
 *  recognized text plus tesseract's own confidence score (0-100). English
 *  only for now — tesseract.js supports other languages via its `langs`
 *  parameter, but each language is a separate downloaded model; scoping to
 *  English keeps the first OCR tool's download size and behavior honest
 *  and predictable rather than silently attempting every language. */
export async function recognizeText(
  image: File | Blob | HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const worker = await createOcrWorker();
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

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const [, base64] = dataUrl.split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function sanitizePdfText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = sanitizePdfText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function createSearchableOcrPdf(
  file: Blob,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean
): Promise<SearchableOcrPdfResult | null> {
  const [{ PDFDocument, StandardFonts, rgb }, { renderPdfPages }] = await Promise.all([
    import("pdf-lib"),
    import("./pdf-render-engine"),
  ]);
  const renderedPages = await renderPdfPages(file, {
    scale: 2,
    onProgress: (pageNumber, totalPages) => {
      onProgress?.((pageNumber / totalPages) * 8);
    },
  });
  if (isCancelled?.()) return null;

  const worker = await createOcrWorker();
  const outputPdf = await PDFDocument.create();
  const font = await outputPdf.embedFont(StandardFonts.Helvetica);
  const allText: string[] = [];

  try {
    for (let index = 0; index < renderedPages.length; index++) {
      if (isCancelled?.()) return null;

      const { canvas, pageNumber } = renderedPages[index];
      const pageStart = 8 + (index / renderedPages.length) * 82;
      const pageSpan = 82 / renderedPages.length;
      const { text } = await worker.recognize(canvas, (pageProgress) => {
        onProgress?.(pageStart + (pageProgress / 100) * pageSpan);
      });
      const cleanText = text.trim();
      allText.push(cleanText ? `--- Page ${pageNumber} ---\n${cleanText}` : "");

      if (isCancelled?.()) return null;

      const imageBytes = dataUrlToUint8Array(canvas.toDataURL("image/jpeg", 0.92));
      const pageImage = await outputPdf.embedJpg(imageBytes);
      const width = canvas.width / 2;
      const height = canvas.height / 2;
      const pdfPage = outputPdf.addPage([width, height]);
      pdfPage.drawImage(pageImage, { x: 0, y: 0, width, height });

      const textLines = wrapText(cleanText, 110);
      const fontSize = Math.max(6, Math.min(10, height / Math.max(textLines.length + 4, 24)));
      const lineHeight = fontSize * 1.25;
      let y = height - 18;
      for (const line of textLines) {
        if (y < 14) break;
        pdfPage.drawText(line, {
          x: 18,
          y,
          size: fontSize,
          font,
          color: rgb(1, 1, 1),
          opacity: 0.01,
        });
        y -= lineHeight;
      }

      onProgress?.(90 + ((index + 1) / renderedPages.length) * 8);
    }
  } finally {
    await worker.terminate();
  }

  const recognizedText = allText.join("\n\n").trim();
  if (!recognizedText.replace(/--- Page \d+ ---/g, "").trim()) {
    throw new Error(
      "No text could be recognized in this PDF. It may be blank, or the scan quality may be too low."
    );
  }

  const bytes = await outputPdf.save();
  const blobPart = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobPart).set(bytes);
  onProgress?.(100);
  return {
    blob: new Blob([blobPart], { type: "application/pdf" }),
    pageCount: renderedPages.length,
    recognizedText,
  };
}
