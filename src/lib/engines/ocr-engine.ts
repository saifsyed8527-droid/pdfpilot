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
