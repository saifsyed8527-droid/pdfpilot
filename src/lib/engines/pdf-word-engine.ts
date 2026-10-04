import type { ExtractedPage } from "../pdf-text-extraction";
import type { OcrWorker } from "./ocr-engine";

export type PdfWordMode = "auto" | "ocr" | "text";
export interface PdfWordResult {
  blob: Blob;
  usedOcr: boolean;
  unrecognizedPages: number[];
}

interface PageRenderer {
  pageCount: number;
  render: (pageNumber: number) => Promise<HTMLCanvasElement>;
  destroy: () => Promise<void>;
}

/** Dependencies are replaceable so the orchestration can be exercised with
 * real PDF/OCR libraries in Node as well as the browser. */
export interface PdfWordDependencies {
  extractText: (file: File) => Promise<ExtractedPage[]>;
  openRenderer: (file: File) => Promise<PageRenderer>;
  createWorker: () => Promise<OcrWorker>;
}

const browserDependencies: PdfWordDependencies = {
  async extractText(file) {
    const { extractPdfText } = await import("../pdf-text-extraction");
    return extractPdfText(file);
  },
  async openRenderer(file) {
    const { loadPdfjs } = await import("../pdfjs");
    const pdfjs = await loadPdfjs();
    const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const pdf = await loadingTask.promise;
    return {
      pageCount: pdf.numPages,
      async render(pageNumber) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2.6 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvas, viewport }).promise;
          return canvas;
        } catch (error) {
          canvas.width = canvas.height = 0;
          throw error;
        } finally {
          page.cleanup();
        }
      },
      async destroy() { await loadingTask.destroy(); },
    };
  },
  async createWorker() {
    const { createOcrWorker } = await import("./ocr-engine");
    return createOcrWorker();
  },
};

export async function createWordFromPages(pages: ExtractedPage[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import("docx");
  const headingLevel = { heading1: HeadingLevel.HEADING_1, heading2: HeadingLevel.HEADING_2, body: undefined } as const;
  const children: InstanceType<typeof Paragraph>[] = [];
  pages.forEach((page, pageIndex) => {
    if (pageIndex) children.push(new Paragraph({ children: [new PageBreak()] }));
    page.paragraphs.forEach((text, index) => children.push(new Paragraph({
      children: [new TextRun(text)],
      heading: headingLevel[page.paragraphStyles[index]],
      spacing: { after: 180 },
    })));
  });
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

/** Auto chooses text extraction/OCR PER PAGE. A selectable cover must never
 * prevent scanned attachments from reaching the downloaded Word document.
 * Rendering is sequential and each canvas is released after recognition. */
export async function convertPdfToWord(
  file: File,
  options: {
    mode: PdfWordMode;
    isCancelled?: () => boolean;
    onProgress?: (progress: number) => void;
    onStatus?: (status: string) => void;
  },
  dependencies: PdfWordDependencies = browserDependencies,
): Promise<PdfWordResult | null> {
  const cancelled = options.isCancelled ?? (() => false);
  const progress = (value: number) => { if (!cancelled()) options.onProgress?.(value); };
  const status = (value: string) => { if (!cancelled()) options.onStatus?.(value); };
  if (cancelled()) return null;
  let renderer: PageRenderer | undefined;
  let worker: OcrWorker | undefined;
  let pages: ExtractedPage[];
  const unrecognizedPages: number[] = [];
  let usedOcr = false;
  try {
    if (options.mode === "ocr") {
      renderer = await dependencies.openRenderer(file);
      pages = Array.from({ length: renderer.pageCount }, (_, index) => ({ pageNumber: index + 1, paragraphs: [], paragraphStyles: [] }));
    } else {
      status("Reading selectable text…");
      pages = await dependencies.extractText(file);
    }
    if (cancelled()) return null;
    if (!pages.length) throw new Error("This PDF has no pages.");
    progress(24);
    const missingPages = pages.filter(page => !page.paragraphs.some(text => text.trim()));
    if (options.mode === "text" && missingPages.length) {
      throw new Error(`No selectable text on page${missingPages.length === 1 ? "" : "s"} ${missingPages.map(page => page.pageNumber).join(", ")}. Choose Auto or Free OCR to avoid missing scanned content.`);
    }
    if (missingPages.length) {
      renderer ??= await dependencies.openRenderer(file);
      if (cancelled()) return null;
      worker = await dependencies.createWorker();
      if (cancelled()) return null;
      usedOcr = true;
      for (const [index, page] of missingPages.entries()) {
        if (cancelled()) return null;
        status(`Recognizing text on page ${page.pageNumber} of ${pages.length}…`);
        const canvas = await renderer.render(page.pageNumber);
        try {
          if (cancelled()) return null;
          const recognized = await worker.recognize(canvas, value => progress(24 + ((index + value / 100) / missingPages.length) * 66));
          if (cancelled()) return null;
          page.paragraphs = recognized.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          page.paragraphStyles = page.paragraphs.map(() => "body");
          if (!page.paragraphs.length) unrecognizedPages.push(page.pageNumber);
        } finally {
          canvas.width = canvas.height = 0;
        }
      }
    }
    if (cancelled()) return null;
    if (!pages.some(page => page.paragraphs.length)) throw new Error("No readable text was found. Try a clearer English scan or a PDF with selectable text.");
    status("Creating editable Word document…");
    const blob = await createWordFromPages(pages);
    if (cancelled()) return null;
    progress(100);
    return { blob, usedOcr, unrecognizedPages };
  } finally {
    try { await worker?.terminate(); }
    finally { await renderer?.destroy(); }
  }
}
