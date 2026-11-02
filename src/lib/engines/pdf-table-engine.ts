import { loadPdfjs } from "../pdfjs";
import { createOcrWorker, type OcrWorker } from "./ocr-engine";
import { ocrLanguages, ocrPages } from "./ocr-options";
import { detectTableGrids, type TableText } from "./pdf-table-layout";
import { safeBaseName } from "./pdf-split-engine";

export type ExcelSheetLayout = "one-sheet" | "multiple-sheets";
export type PdfTableMode = "auto" | "ocr" | "text";
export interface PdfTableOptions {
  mode?: PdfTableMode;
  languages?: string[];
  pages?: string;
  dpi?: 150 | 300;
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
  onProgress?: (percent: number) => void;
}
export interface ExtractedPdfTablePage {
  pageNumber: number;
  tableNumber: number;
  rows: string[][];
  ocr: boolean;
}
export interface PdfTablePageReport {
  page: number;
  tables: number;
  rows: number;
  ocr: boolean;
  confidence?: number;
  uncertainWords?: number;
}
export interface PdfTableDocument {
  tables: ExtractedPdfTablePage[];
  sourcePages: number;
  pageReports: PdfTablePageReport[];
}
export interface PdfExcelResult extends PdfTableDocument {
  blob: Blob;
  filename: string;
  tablePageCount: number;
  totalRows: number;
}
const abortError = () =>
  new DOMException("Conversion cancelled.", "AbortError");

/** Native text first, then free OCR on pages without an aligned table. All
 * inferred cells remain strings: identifiers, dates and formula-like text are
 * never silently reinterpreted. */
export async function extractPdfTables(
  file: File,
  onProgress?: (page: number, total: number) => void,
  options: PdfTableOptions = {},
): Promise<PdfTableDocument> {
  if (options.signal?.aborted) throw abortError();
  if (!file.size || file.size > 100 * 1024 * 1024)
    throw new Error("Choose a non-empty PDF up to 100MB.");
  const mode = options.mode ?? "auto",
    languages = mode === "text" ? ["eng"] : ocrLanguages(options.languages),
    dpi = options.dpi ?? 150;
  if (!["auto", "ocr", "text"].includes(mode))
    throw new Error("Choose Auto, Free OCR or No OCR.");
  if (![150, 300].includes(dpi)) throw new Error("Choose 150 or 300 DPI.");
  // With English explicitly selected, use it as Tesseract's base model. This
  // improves Latin identifiers and digits in mixed-script tables without
  // silently adding a language the user did not select.
  languages.sort((a, b) => (a === "eng" ? -1 : b === "eng" ? 1 : 0));
  const controller = new AbortController();
  let timedOut = false;
  const check = () => {
    if (timedOut)
      throw new Error(
        "A page took too long to convert. Try fewer pages, fewer languages or 150 DPI.",
      );
    if (controller.signal.aborted || options.signal?.aborted)
      throw abortError();
  };
  const externalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", externalAbort, { once: true });
  let loading: import("pdfjs-dist").PDFDocumentLoadingTask | undefined,
    render: import("pdfjs-dist").RenderTask | undefined,
    worker: OcrWorker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const heartbeat = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 180_000);
  };
  const stop = () => {
    render?.cancel();
    void loading?.destroy().catch(() => {});
  };
  controller.signal.addEventListener("abort", stop, { once: true });
  const tables: ExtractedPdfTablePage[] = [],
    pageReports: PdfTablePageReport[] = [];
  let characters = 0,
    cells = 0,
    totalRows = 0;
  try {
    heartbeat();
    options.onStatus?.("Reading the PDF…");
    const lib = await loadPdfjs(),
      data = await file.arrayBuffer();
    check();
    loading = lib.getDocument({
      data,
      stopAtErrors: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      cMapUrl: "/pdfjs-assets/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs-assets/standard_fonts/",
      wasmUrl: "/pdfjs-assets/wasm/",
    });
    const pdf = await loading.promise;
    check();
    if (pdf.isPureXfa)
      throw new Error("Export this XFA form as a standard PDF first.");
    const selected = ocrPages(options.pages, pdf.numPages);
    for (const [index, zero] of selected.entries()) {
      check();
      heartbeat();
      const number = zero + 1;
      options.onStatus?.(`Reading page ${number} of ${pdf.numPages}…`);
      const page = await pdf.getPage(number);
      let canvas: HTMLCanvasElement | undefined;
      try {
        let grids: string[][][] = [],
          usedOcr = false,
          confidence: number | undefined,
          uncertainWords: number | undefined;
        if (mode !== "ocr") {
          const content = await page.getTextContent();
          check();
          if (content.items.length > 100_000)
            throw new Error(
              "A page contains too many text objects. Choose a simpler PDF.",
            );
          // Native quarter-turn rotation does not alter logical table order.
          // Use the unrotated CropBox coordinates to exclude hidden page text.
          const view = page.getViewport({ scale: 1, rotation: 0 }),
            runs: TableText[] = [];
          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const text = item.str
              .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
              .replace(/\s+/g, " ")
              .trim();
            characters += text.length;
            const [a, b, c, d, x, y] = lib.Util.transform(
                view.transform,
                item.transform,
              ),
              h = Math.hypot(c, d) || Math.abs(item.height * view.scale) || 10,
              w = Math.abs(
                item.width * Math.hypot(view.transform[0], view.transform[1]),
              );
            if (Math.abs(b) > Math.abs(a) * 0.2) continue; // Vertical labels are not horizontal table cells.
            if (x + w < 0 || x > view.width || y < 0 || y - h > view.height)
              continue;
            runs.push({
              text,
              x,
              y: y - h,
              width: w,
              height: h,
              rtl: item.dir === "rtl",
            });
            if (characters > 2_000_000)
              throw new Error(
                "The selected pages exceed two million text characters. Choose fewer pages.",
              );
          }
          grids = detectTableGrids(runs);
        }
        if (mode === "ocr" || (!grids.length && mode === "auto")) {
          options.onStatus?.(`Recognizing tables on page ${number}…`);
          const natural = page.getViewport({ scale: 1 }),
            view = page.getViewport({ scale: dpi / 72 }),
            width = Math.ceil(view.width),
            height = Math.ceil(view.height);
          if (
            ![natural.width, natural.height, width, height].every(
              (v) => Number.isFinite(v) && v > 0,
            ) ||
            width > 8192 ||
            height > 8192 ||
            width * height > 16_000_000
          )
            throw new Error(
              `Page ${number} exceeds the 16-megapixel OCR limit. Try 150 DPI or a smaller page range.`,
            );
          canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          render = page.render({
            canvas,
            viewport: view,
            background: "#ffffff",
            annotationMode: lib.AnnotationMode.ENABLE,
          });
          await render.promise;
          render = undefined;
          check();
          worker ??= await createOcrWorker(controller.signal, { languages });
          check();
          const recognized = await worker.recognize(canvas, (fraction) => {
            if (!controller.signal.aborted)
              options.onProgress?.(
                5 + ((index + (fraction / 100) * 0.9) / selected.length) * 85,
              );
          });
          check();
          if ((recognized.words?.length ?? 0) > 100_000)
            throw new Error(
              "Too many recognized words. Choose a simpler page.",
            );
          characters += recognized.text.length;
          grids = detectTableGrids(
            (recognized.words ?? []).map((word) => ({
              text: word.text,
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0,
              rtl: /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(word.text),
            })),
          );
          usedOcr = true;
          confidence = recognized.confidence;
          uncertainWords = (recognized.words ?? []).filter(
            (word) => word.confidence !== undefined && word.confidence < 60,
          ).length;
        }
        if (characters > 2_000_000)
          throw new Error(
            "The selected pages exceed two million text characters. Choose fewer pages.",
          );
        for (const [tableIndex, rows] of grids.entries()) {
          cells += rows.length * (rows[0]?.length ?? 0);
          totalRows += rows.length;
          tables.push({
            pageNumber: number,
            tableNumber: tableIndex + 1,
            rows,
            ocr: usedOcr,
          });
        }
        if (cells > 1_000_000 || totalRows > 50_000 || tables.length > 200)
          throw new Error(
            "Choose fewer pages: each run supports 200 tables, 50,000 rows and one million cells.",
          );
        pageReports.push({
          page: number,
          tables: grids.length,
          rows: grids.reduce((sum, rows) => sum + rows.length, 0),
          ocr: usedOcr,
          confidence,
          uncertainWords,
        });
        onProgress?.(index + 1, selected.length);
        options.onProgress?.(5 + ((index + 1) / selected.length) * 85);
      } finally {
        if (canvas) canvas.width = canvas.height = 0;
        page.cleanup();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    check();
    return { tables, sourcePages: pdf.numPages, pageReports };
  } catch (error) {
    check();
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error("Unlock this PDF before converting it.");
    if (error instanceof Error && error.name === "InvalidPDFException")
      throw new Error(
        "This PDF could not be read. Choose a readable PDF or try Repair PDF first.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", externalAbort);
    controller.signal.removeEventListener("abort", stop);
    try {
      await worker?.terminate();
    } finally {
      await loading?.destroy().catch(() => {});
    }
  }
}

export async function createExcelFromPdfTables(
  file: File,
  layout: ExcelSheetLayout,
  onProgress?: (page: number, total: number) => void,
  options: PdfTableOptions = {},
): Promise<PdfExcelResult> {
  if (!["one-sheet", "multiple-sheets"].includes(layout))
    throw new Error("Choose one sheet or multiple sheets.");
  const extracted = await extractPdfTables(file, onProgress, options);
  if (!extracted.tables.length)
    throw new Error(
      "No aligned tables were detected. Choose the correct document language, try Free OCR for scans, or use a clearer PDF.",
    );
  if (options.signal?.aborted) throw abortError();
  options.onStatus?.("Creating the Excel workbook…");
  options.onProgress?.(93);
  const XLSX = await import("xlsx"),
    workbook = XLSX.utils.book_new();
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (options.signal?.aborted) throw abortError();
  function append(rows: string[][], name: string) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = Array.from(
      { length: Math.max(...rows.map((row) => row.length)) },
      (_, column) => ({
        wch: Math.min(
          50,
          Math.max(
            12,
            ...rows.slice(0, 500).map((row) => (row[column] ?? "").length + 2),
          ),
        ),
      }),
    );
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  }
  if (layout === "one-sheet") {
    const rows: string[][] = [];
    extracted.tables.forEach((table, index) => {
      if (index) rows.push([]);
      if (extracted.tables.length > 1)
        rows.push([`Page ${table.pageNumber} · Table ${table.tableNumber}`]);
      rows.push(...table.rows);
    });
    append(rows, "PDF tables");
  } else {
    for (const table of extracted.tables) {
      const count = extracted.tables.filter(
        (t) => t.pageNumber === table.pageNumber,
      ).length;
      append(
        table.rows,
        `Page ${table.pageNumber}${count > 1 ? ` Table ${table.tableNumber}` : ""}`,
      );
    }
  }
  const bytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (options.signal?.aborted) throw abortError();
  if (bytes.byteLength > 128 * 1024 * 1024)
    throw new Error("The workbook exceeds 128MB. Choose fewer pages.");
  options.onProgress?.(100);
  return {
    ...extracted,
    blob: new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: `${safeBaseName(file.name)}.xlsx`,
    tablePageCount: new Set(extracted.tables.map((table) => table.pageNumber))
      .size,
    totalRows: extracted.tables.reduce(
      (sum, table) => sum + table.rows.length,
      0,
    ),
  };
}
