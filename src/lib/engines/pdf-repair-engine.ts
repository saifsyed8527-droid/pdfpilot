import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFInvalidObject,
  PDFName,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  type PDFObject,
} from "pdf-lib";
import { loadPdfjs } from "../pdfjs";

export const REPAIR_LIMITS = {
  inputBytes: 100 * 1024 * 1024,
  outputBytes: 200 * 1024 * 1024,
  pages: 200,
  pixels: 16_000_000,
  side: 8192,
};
export type RepairMode = "structure" | "visible";
export interface RepairOptions {
  mode: RepairMode;
  dpi?: 150 | 300;
  skipUnreadable?: boolean;
  signal?: AbortSignal;
  onProgress?: (value: number, message: string) => void;
}
export interface RepairPage {
  sourcePage: number;
  outputPage?: number;
  status: "checked" | "recovered" | "unreadable";
  appearsBlank?: boolean;
  message?: string;
}
export interface PdfRepairResult {
  blob: Blob;
  pageCount: number;
  sourcePages: number;
  mode: RepairMode;
  pages: RepairPage[];
  preview?: string;
}
const n = PDFName.of;
const abortError = () => new DOMException("Repair cancelled.", "AbortError");
const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};
async function checkpoint(signal?: AbortSignal) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  check(signal);
}

export function repairDimensions(width: number, height: number, dpi: number) {
  const w = Math.ceil((width * dpi) / 72),
    h = Math.ceil((height * dpi) / 72);
  if (
    ![width, height, w, h].every((v) => Number.isFinite(v) && v > 0) ||
    w > REPAIR_LIMITS.side ||
    h > REPAIR_LIMITS.side ||
    w * h > REPAIR_LIMITS.pixels
  )
    throw new Error(
      "This page is too large to render safely. Try 150 DPI or a smaller PDF.",
    );
  return { width: w, height: h };
}
function guardDocument(pdf: PDFDocument) {
  if (pdf.isEncrypted)
    throw new Error("This PDF is encrypted. Unlock it before repairing.");
  if (!pdf.catalog) return;
  const form = pdf.catalog.lookupMaybe(n("AcroForm"), PDFDict);
  if (form?.has(n("XFA")))
    throw new Error(
      "XFA forms are not supported. Export a standard PDF first.",
    );
  if (
    pdf.catalog.has(n("Perms")) ||
    pdf.context
      .enumerateIndirectObjects()
      .some(
        ([, object]) =>
          object instanceof PDFDict &&
          (object.get(n("Type")) === n("Sig") ||
            object.get(n("FT")) === n("Sig")),
      )
  )
    throw new Error(
      "Repair would invalidate digital signatures. Use a copy without signature fields or certification.",
    );
}
function recoverInfo(pdf: PDFDocument) {
  if (pdf.context.trailerInfo.Info) return;
  const keys = [
    "Title",
    "Author",
    "Subject",
    "Keywords",
    "Creator",
    "Producer",
    "CreationDate",
    "ModDate",
  ];
  const candidates = pdf.context
    .enumerateIndirectObjects()
    .filter(
      ([, object]) =>
        object instanceof PDFDict &&
        !["Type", "Subtype", "Parent", "Dest", "A", "Rect"].some((key) =>
          object.has(n(key)),
        ) &&
        keys.filter((key) => object.has(n(key))).length >= 2,
    );
  // Missing trailers can orphan Info. Only restore an unambiguous candidate;
  // guessing between historical dictionaries could restore obsolete details.
  if (candidates.length === 1) pdf.context.trailerInfo.Info = candidates[0][0];
}
function checkPageStreams(pdf: PDFDocument, index: number) {
  const page = pdf.getPage(index),
    seen = new Set<PDFObject>();
  let decodedBytes = 0;
  const visit = (raw: PDFObject | undefined, depth: number) => {
    if (!raw) return;
    const object = pdf.context.lookup(raw);
    if (!object) {
      if (raw instanceof PDFRef)
        throw new Error("A referenced page object is missing.");
      return;
    }
    if (seen.has(object)) return;
    if (depth > 40 || seen.size > 20_000)
      throw new Error("The page resource graph is too complex to verify.");
    seen.add(object);
    if (object instanceof PDFInvalidObject)
      throw new Error("The page contains an invalid PDF object.");
    if (object instanceof PDFRawStream) {
      // PDF.js may replace a malformed content stream with an empty stream even
      // with stopAtErrors. Verify non-image streams independently before render.
      // Image codecs are left to the renderer (DCT/JPX/JBIG2 are not pdf-lib codecs).
      if (object.dict.get(n("Subtype")) !== n("Image")) {
        const stream = decodePDFRawStream(object);
        for (;;) {
          const chunk = stream.getBytes(65536);
          decodedBytes += chunk.length;
          if (decodedBytes > 64 * 1024 * 1024)
            throw new Error("Decoded page resources exceed 64MB.");
          if (chunk.length < 65536) break;
        }
      }
      visit(object.dict.get(n("Resources")), depth + 1);
    } else if (object instanceof PDFArray) {
      for (const entry of object.asArray()) visit(entry, depth + 1);
    } else if (object instanceof PDFDict) {
      for (const [key, value] of object.entries())
        if (!["Parent", "P", "Length"].includes(key.decodeText()))
          visit(value, depth + 1);
    }
  };
  visit(page.node.get(n("Contents")), 0);
  visit(page.node.Resources(), 0);
  for (const entry of page.node.Annots()?.asArray() ?? []) {
    const annotation = pdf.context.lookup(entry);
    if (annotation instanceof PDFDict) visit(annotation.get(n("AP")), 0);
  }
}
function pageLimit(count: number) {
  if (!Number.isInteger(count) || count < 1)
    throw new Error("No recoverable pages were found in this PDF.");
  if (count > REPAIR_LIMITS.pages)
    throw new Error("Repair supports up to 200 pages. Choose a smaller PDF.");
}
function limitOutput(bytes: Uint8Array) {
  if (bytes.byteLength > REPAIR_LIMITS.outputBytes)
    throw new Error(
      "The repaired PDF exceeds 200MB. Try 150 DPI or fewer pages.",
    );
}

/** Rebuild cross references without copying pages into a new document: forms,
 * bookmarks, metadata and document attachments remain in the original graph. */
export async function repairPdfStructure(
  bytes: Uint8Array,
  signal?: AbortSignal,
) {
  check(signal);
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    throw new Error(
      "The PDF structure could not be read. Try Recover visible pages, or choose another copy.",
    );
  }
  await checkpoint(signal);
  guardDocument(pdf);
  if (!pdf.catalog)
    throw new Error("The PDF catalog is missing. Try Recover visible pages.");
  recoverInfo(pdf);
  if (
    pdf.context
      .enumerateIndirectObjects()
      .some(([, object]) => object instanceof PDFInvalidObject)
  )
    throw new Error(
      "Some PDF objects are damaged. Try Recover visible pages to salvage what can still be displayed.",
    );
  let count: number;
  try {
    count = pdf.getPageCount();
    pageLimit(count);
    for (const page of pdf.getPages()) {
      const box = page.getCropBox(),
        rotation = page.getRotation().angle;
      if (
        ![box.x, box.y, box.width, box.height, rotation].every(
          Number.isFinite,
        ) ||
        box.width <= 0 ||
        box.height <= 0 ||
        rotation % 90 !== 0
      )
        throw new Error("Invalid page geometry");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("200 pages"))
      throw error;
    throw new Error(
      "The page structure is damaged. Try Recover visible pages.",
    );
  }
  await checkpoint(signal);
  const saved = await pdf.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
  check(signal);
  limitOutput(saved);
  return { bytes: saved, pageCount: count };
}

/** A bounded independent renderer checks every page. The explicit recovery mode
 * creates image-only pages; a failed page is never silently included or omitted. */
export async function repairPdf(
  file: File,
  options: RepairOptions,
): Promise<PdfRepairResult> {
  const { signal } = options;
  check(signal);
  if (!file.size || file.size > REPAIR_LIMITS.inputBytes)
    throw new Error("Choose a non-empty PDF up to 100MB.");
  if (!["structure", "visible"].includes(options.mode))
    throw new Error("Choose a repair method.");
  const dpi = options.dpi ?? 150;
  if (![150, 300].includes(dpi)) throw new Error("Choose 150 or 300 DPI.");
  let input: Uint8Array = new Uint8Array(await file.arrayBuffer());
  check(signal);
  if (
    !new TextDecoder("latin1").decode(input.subarray(0, 1024)).includes("%PDF-")
  )
    throw new Error(
      "This file does not contain a PDF header. Choose a PDF, not a renamed image or document.",
    );
  options.onProgress?.(5, "Reading PDF structure…");
  let expectedPages: number | undefined;
  let structure: PDFDocument | undefined;
  if (options.mode === "structure") {
    const repaired = await repairPdfStructure(input, signal);
    input = repaired.bytes;
    expectedPages = repaired.pageCount;
    structure = await PDFDocument.load(input, { updateMetadata: false });
  } else {
    // Apply preservation guards whenever the damaged structure is readable.
    let source: PDFDocument | undefined;
    try {
      source = await PDFDocument.load(input, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    } catch {
      /* The independent renderer may still recover it. */
    }
    if (source) {
      guardDocument(source);
      if (source.catalog) structure = source;
    }
  }
  check(signal);
  const lib = await loadPdfjs();
  check(signal);
  const loading = lib.getDocument({
    data: input.slice(),
    stopAtErrors: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    cMapUrl: "/pdfjs-assets/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs-assets/standard_fonts/",
    wasmUrl: "/pdfjs-assets/wasm/",
    enableXfa: false,
  });
  let render: import("pdfjs-dist").RenderTask | undefined;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    render?.cancel();
    void loading.destroy().catch(() => {});
  };
  const heartbeat = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, 90_000);
  };
  const active = () => {
    check(signal);
    if (timedOut)
      throw new Error(
        "This page took too long to recover. Try a smaller file or another copy.",
      );
  };
  signal?.addEventListener("abort", stop, { once: true });
  heartbeat();
  const pages: RepairPage[] = [];
  let preview: string | undefined;
  try {
    const source = await loading.promise;
    active();
    pageLimit(source.numPages);
    if (source.isPureXfa)
      throw new Error(
        "XFA forms are not supported. Export a standard PDF first.",
      );
    if (expectedPages !== undefined && expectedPages !== source.numPages)
      throw new Error(
        "The PDF readers disagree about the page count. Try Recover visible pages and check its page report.",
      );
    const fields = await source.getFieldObjects();
    active();
    if (
      fields &&
      Object.values(fields).some((group) =>
        (group as { type?: string }[]).some(
          (field) => field.type === "signature",
        ),
      )
    )
      throw new Error(
        "Repair would invalidate digital signatures. Use a copy without signature fields or certification.",
      );
    const output =
      options.mode === "visible" ? await PDFDocument.create() : undefined;
    let imageBytes = 0;
    for (let index = 1; index <= source.numPages; index++) {
      active();
      heartbeat();
      options.onProgress?.(
        15 + ((index - 1) / source.numPages) * 75,
        `${options.mode === "visible" ? "Recovering" : "Checking"} page ${index} of ${source.numPages}…`,
      );
      let canvas: HTMLCanvasElement | undefined;
      let page: import("pdfjs-dist").PDFPageProxy | undefined;
      try {
        if (structure) checkPageStreams(structure, index - 1);
        page = await source.getPage(index);
        active();
        const natural = page.getViewport({ scale: 1 });
        const renderDpi = output
          ? dpi
          : Math.min(72, (1000 / Math.max(natural.width, natural.height)) * 72);
        const size = repairDimensions(natural.width, natural.height, renderDpi);
        const viewport = page.getViewport({ scale: renderDpi / 72 });
        canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context)
          throw new Error("A page drawing surface could not be created.");
        render = page.render({
          canvas,
          viewport,
          annotationMode: lib.AnnotationMode.ENABLE,
          background: "#ffffff",
        });
        await render.promise;
        active();
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let appearsBlank = true;
        for (let pixel = 0; pixel < pixels.length; pixel += 4) {
          if (
            pixels[pixel] < 250 ||
            pixels[pixel + 1] < 250 ||
            pixels[pixel + 2] < 250
          ) {
            appearsBlank = false;
            break;
          }
        }
        if (!preview) {
          const thumb = document.createElement("canvas"),
            scale = Math.min(1, 600 / Math.max(canvas.width, canvas.height));
          thumb.width = Math.max(1, Math.round(canvas.width * scale));
          thumb.height = Math.max(1, Math.round(canvas.height * scale));
          try {
            thumb
              .getContext("2d")!
              .drawImage(canvas, 0, 0, thumb.width, thumb.height);
            preview = thumb.toDataURL("image/png");
          } finally {
            thumb.width = thumb.height = 0;
          }
        }
        if (output) {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas!.toBlob(resolve, "image/png"),
          );
          active();
          if (!blob) throw new Error("This page could not be encoded.");
          imageBytes += blob.size;
          if (imageBytes > REPAIR_LIMITS.outputBytes)
            throw new Error(
              "Recovered images exceed 200MB. Try 150 DPI or fewer pages.",
            );
          const image = await output.embedPng(await blob.arrayBuffer());
          active();
          const recovered = output.addPage([natural.width, natural.height]);
          recovered.drawImage(image, {
            x: 0,
            y: 0,
            width: natural.width,
            height: natural.height,
          });
        }
        pages.push({
          sourcePage: index,
          outputPage: output ? output.getPageCount() : index,
          status: output ? "recovered" : "checked",
          appearsBlank,
        });
      } catch (error) {
        active();
        const detail = error instanceof Error ? error.message : "";
        const message = /too large|exceed|too complex/.test(detail)
          ? detail
          : "The page content is damaged or incomplete.";
        if (message.includes("200MB")) throw error;
        if (!output)
          throw new Error(
            `Page ${index} could not be verified. Try Recover visible pages. ${message}`,
          );
        if (!options.skipUnreadable)
          throw new Error(
            `Page ${index} could not be recovered. Enable “Skip unreadable pages” only if you accept a partial PDF. ${message}`,
          );
        pages.push({
          sourcePage: index,
          status: "unreadable",
          message: "The page could not be rendered or encoded.",
        });
      } finally {
        render = undefined;
        if (canvas) canvas.width = canvas.height = 0;
        page?.cleanup();
      }
      await checkpoint(signal);
    }
    active();
    options.onProgress?.(92, "Saving the checked PDF…");
    if (output && output.getPageCount() === 0)
      throw new Error("No pages could be recovered. No PDF was created.");
    const bytes = output
      ? await output.save({
          addDefaultPage: false,
          updateFieldAppearances: false,
          objectsPerTick: 50,
        })
      : input;
    active();
    limitOutput(bytes);
    options.onProgress?.(100, "Ready to review");
    return {
      blob: new Blob([bytes as unknown as BlobPart], {
        type: "application/pdf",
      }),
      pageCount: pages.filter((page) => page.outputPage !== undefined).length,
      sourcePages: source.numPages,
      mode: options.mode,
      pages,
      preview,
    };
  } catch (error) {
    active();
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error("This PDF is encrypted. Unlock it before repairing.");
    if (
      error instanceof Error &&
      /InvalidPDFException|UnknownErrorException/.test(error.name)
    )
      throw new Error(
        "Not enough readable PDF data remains. Try another copy of the file.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
    await loading.destroy().catch(() => {});
  }
}
