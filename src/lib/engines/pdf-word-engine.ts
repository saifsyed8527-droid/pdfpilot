import type { ExtractedPage, PdfTextOptions } from "../pdf-text-extraction";
import type { OcrWorker } from "./ocr-engine";
import {
  ocrLanguages,
  ocrPages,
  normalizeOcrText,
  type OcrOptions,
} from "./ocr-options";
import { PdfWordInputError } from "./conversion-input-errors";

export type PdfWordMode = "auto" | "ocr" | "text";
export interface PdfWordResult {
  blob: Blob;
  usedOcr: boolean;
  unrecognizedPages: number[];
  sourcePages: number;
  processedPages: number[];
  pageReports: {
    page: number;
    ocr: boolean;
    characters: number;
    confidence?: number;
    uncertainWords?: number;
    imagesNotTranscribed: boolean;
  }[];
}
export interface PdfWordOptions {
  mode: PdfWordMode;
  languages?: string[];
  pages?: string;
  dpi?: 150 | 300;
  isCancelled?: () => boolean;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  onStatus?: (status: string) => void;
}

interface PageRenderer {
  pageCount: number;
  render: (pageNumber: number) => Promise<HTMLCanvasElement>;
  destroy: () => Promise<void>;
}

/** Dependencies are replaceable so the orchestration can be exercised with
 * real PDF/OCR libraries in Node as well as the browser. */
export interface PdfWordDependencies {
  extractText: (
    file: File,
    options?: PdfTextOptions,
  ) => Promise<ExtractedPage[]>;
  openRenderer: (
    file: File,
    options?: Pick<PdfWordOptions, "signal" | "dpi">,
  ) => Promise<PageRenderer>;
  createWorker: (
    signal?: AbortSignal,
    options?: OcrOptions,
  ) => Promise<OcrWorker>;
}

const browserDependencies: PdfWordDependencies = {
  async extractText(file, options) {
    const { extractPdfText } = await import("../pdf-text-extraction");
    return extractPdfText(file, options);
  },
  async openRenderer(file, options = {}) {
    const { loadPdfjs } = await import("../pdfjs");
    const pdfjs = await loadPdfjs();
    if (options.signal?.aborted)
      throw new DOMException("Conversion cancelled", "AbortError");
    const data = await file.arrayBuffer();
    if (options.signal?.aborted)
      throw new DOMException("Conversion cancelled", "AbortError");
    const loadingTask = pdfjs.getDocument({
      data,
      stopAtErrors: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      cMapUrl: "/pdfjs-assets/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs-assets/standard_fonts/",
      wasmUrl: "/pdfjs-assets/wasm/",
    });
    let rendering: import("pdfjs-dist").RenderTask | undefined,
      timedOut = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      rendering?.cancel();
      void loadingTask.destroy().catch(() => {});
    };
    const heartbeat = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        abort();
      }, 180_000);
    };
    const destroy = async () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      await loadingTask.destroy().catch(() => {});
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    heartbeat();
    let pdf: Awaited<typeof loadingTask.promise>;
    try {
      pdf = await loadingTask.promise;
      if (pdf.isPureXfa)
        throw new PdfWordInputError(
          "Export this XFA form as a standard PDF first.",
        );
      if (pdf.numPages > 2000)
        throw new PdfWordInputError("Choose a PDF with 1–2,000 pages.");
    } catch (error) {
      await destroy();
      if (timedOut)
        throw new PdfWordInputError(
          "Reading this PDF took too long. Try fewer pages or Repair PDF.",
        );
      throw error;
    }
    clearTimeout(timer);
    return {
      pageCount: pdf.numPages,
      async render(pageNumber) {
        heartbeat();
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: (options.dpi ?? 150) / 72 });
        const canvas = document.createElement("canvas");
        try {
          const width = Math.ceil(viewport.width),
            height = Math.ceil(viewport.height);
          if (
            ![width, height].every(
              (v) => Number.isFinite(v) && v > 0 && v <= 8192,
            ) ||
            width * height > 16_000_000
          )
            throw new PdfWordInputError(
              `Page ${pageNumber} exceeds the 16-megapixel OCR limit. Try 150 DPI or a smaller page range.`,
            );
          canvas.width = width;
          canvas.height = height;
          rendering = page.render({
            canvas,
            viewport,
            background: "#ffffff",
            annotationMode: pdfjs.AnnotationMode.ENABLE,
          });
          await rendering.promise;
          rendering = undefined;
          return canvas;
        } catch (error) {
          canvas.width = canvas.height = 0;
          if (timedOut)
            throw new PdfWordInputError(
              `Rendering page ${pageNumber} took too long. Try 150 DPI or Repair PDF.`,
            );
          throw error;
        } finally {
          clearTimeout(timer);
          page.cleanup();
        }
      },
      destroy,
    };
  },
  async createWorker(signal, options) {
    const { createOcrWorker } = await import("./ocr-engine");
    return createOcrWorker(signal, options);
  },
};

export async function createWordFromPages(
  pages: ExtractedPage[],
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } =
    await import("docx");
  const headingLevel = {
    heading1: HeadingLevel.HEADING_1,
    heading2: HeadingLevel.HEADING_2,
    body: undefined,
  } as const;
  const children: InstanceType<typeof Paragraph>[] = [];
  pages.forEach((page, pageIndex) => {
    if (pageIndex)
      children.push(new Paragraph({ children: [new PageBreak()] }));
    page.paragraphs.forEach((text, index) => {
      const rtl =
        (text.match(/[\p{Script=Arabic}\p{Script=Hebrew}]/gu)?.length ?? 0) >
        (text.match(/\p{L}/gu)?.length ?? 0) / 2;
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text,
              rightToLeft: rtl,
              font: {
                ascii: "Arial",
                hAnsi: "Arial",
                cs: "Arial",
                eastAsia: "Arial",
              },
            }),
          ],
          bidirectional: rtl,
          heading: headingLevel[page.paragraphStyles[index]],
          spacing: { after: 180 },
        }),
      );
    });
  });
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

/** Auto chooses text extraction/OCR PER PAGE. A selectable cover must never
 * prevent scanned attachments from reaching the downloaded Word document.
 * Rendering is sequential and each canvas is released after recognition. */
export async function convertPdfToWord(
  file: File,
  options: PdfWordOptions,
  dependencies: PdfWordDependencies = browserDependencies,
): Promise<PdfWordResult | null> {
  const cancelled = () =>
    Boolean(options.signal?.aborted || options.isCancelled?.());
  const progress = (value: number) => {
    if (!cancelled()) options.onProgress?.(value);
  };
  const status = (value: string) => {
    if (!cancelled()) options.onStatus?.(value);
  };
  if (cancelled()) return null;
  if (!file.size || file.size > 100 * 1024 * 1024)
    throw new PdfWordInputError("Choose a non-empty PDF up to 100MB.");
  if (!["auto", "ocr", "text"].includes(options.mode))
    throw new PdfWordInputError("Choose Auto, Free OCR or No OCR.");
  if (options.dpi !== undefined && ![150, 300].includes(options.dpi))
    throw new PdfWordInputError("Choose 150 or 300 DPI.");
  let languages: string[];
  try {
    languages =
      options.mode === "text" ? ["eng"] : ocrLanguages(options.languages);
  } catch (error) {
    throw new PdfWordInputError((error as Error).message);
  }
  let renderer: PageRenderer | undefined;
  let worker: OcrWorker | undefined;
  let pages: ExtractedPage[];
  const unrecognizedPages: number[] = [];
  let usedOcr = false;
  const ocrReports = new Map<
    number,
    { confidence: number; uncertainWords: number }
  >();
  try {
    if (options.mode === "ocr") {
      renderer = await dependencies.openRenderer(file, options);
      pages = Array.from({ length: renderer.pageCount }, (_, index) => ({
        pageNumber: index + 1,
        paragraphs: [],
        paragraphStyles: [],
      }));
    } else {
      status("Reading selectable text…");
      pages = await dependencies.extractText(file, {
        pages: options.pages,
        signal: options.signal,
        onProgress: (value) => progress(value * 0.24),
      });
    }
    if (cancelled()) return null;
    if (!pages.length) throw new Error("This PDF has no pages.");
    const sourcePages =
      pages[0].sourcePages ??
      renderer?.pageCount ??
      Math.max(...pages.map((page) => page.pageNumber));
    let selected: number[];
    try {
      selected = ocrPages(options.pages, sourcePages);
    } catch (error) {
      throw new PdfWordInputError((error as Error).message);
    }
    pages = pages.filter((page) => selected.includes(page.pageNumber - 1));
    let characters = pages.reduce(
      (sum, page) => sum + page.paragraphs.join("\n").length,
      0,
    );
    if (characters > 2_000_000)
      throw new PdfWordInputError(
        "The selected pages exceed two million text characters. Choose fewer pages.",
      );
    progress(24);
    const missingPages = pages.filter(
      (page) => !page.paragraphs.some((text) => text.trim()),
    );
    if (options.mode === "text" && missingPages.length) {
      throw new Error(
        `No selectable text on page${missingPages.length === 1 ? "" : "s"} ${missingPages.map((page) => page.pageNumber).join(", ")}. Choose Auto or Free OCR to avoid missing scanned content.`,
      );
    }
    if (missingPages.length) {
      renderer ??= await dependencies.openRenderer(file, options);
      if (cancelled()) return null;
      // Sparse text recognition also reads isolated captions and footers that
      // automatic paragraph segmentation can discard. Keep the user's primary
      // language first; mixed-script recognition is sensitive to this order.
      worker = await dependencies.createWorker(options.signal, {
        languages,
        segmentation: "sparse",
      });
      if (cancelled()) return null;
      usedOcr = true;
      for (const [index, page] of missingPages.entries()) {
        if (cancelled()) return null;
        status(
          `Recognizing text on page ${page.pageNumber} of ${sourcePages}…`,
        );
        const canvas = await renderer.render(page.pageNumber);
        try {
          if (cancelled()) return null;
          const recognized = await worker.recognize(canvas, (value) =>
            progress(24 + ((index + value / 100) / missingPages.length) * 66),
          );
          if (cancelled()) return null;
          characters += recognized.text.length;
          if (
            characters > 2_000_000 ||
            (recognized.words?.length ?? 0) > 100_000
          )
            throw new PdfWordInputError(
              "The selected pages contain too much text. Choose fewer or simpler pages.",
            );
          page.paragraphs = normalizeOcrText(recognized.text, languages)
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          page.paragraphStyles = page.paragraphs.map(() => "body");
          ocrReports.set(page.pageNumber, {
            confidence: recognized.confidence,
            uncertainWords: (recognized.words ?? []).filter(
              (word) => word.confidence !== undefined && word.confidence < 60,
            ).length,
          });
          if (!page.paragraphs.length) unrecognizedPages.push(page.pageNumber);
        } finally {
          canvas.width = canvas.height = 0;
        }
      }
    }
    if (cancelled()) return null;
    if (!pages.some((page) => page.paragraphs.length))
      throw new PdfWordInputError(
        "No readable text was found. Check the document languages or try a clearer, upright scan.",
      );
    status("Creating editable Word document…");
    const blob = await createWordFromPages(pages);
    if (blob.size > 100 * 1024 * 1024)
      throw new PdfWordInputError(
        "The Word document exceeds 100MB. Choose fewer pages.",
      );
    if (cancelled()) return null;
    progress(100);
    return {
      blob,
      usedOcr,
      unrecognizedPages,
      sourcePages,
      processedPages: pages.map((page) => page.pageNumber),
      pageReports: pages.map((page) => ({
        page: page.pageNumber,
        ocr: ocrReports.has(page.pageNumber),
        ...ocrReports.get(page.pageNumber),
        characters: page.paragraphs.join("\n").length,
        imagesNotTranscribed:
          !!page.containsImages && !ocrReports.has(page.pageNumber),
      })),
    };
  } catch (error) {
    // The shared OCR worker rejects pending startup/recognition on abort.
    // Cancellation is an empty result, never a conversion failure or download.
    if (cancelled()) return null;
    throw error;
  } finally {
    try {
      await worker?.terminate();
    } finally {
      await renderer?.destroy();
    }
  }
}
