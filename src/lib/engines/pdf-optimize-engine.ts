import { runQpdfWorker } from "./qpdf-worker";
import { loadPdfjs } from "../pdfjs";
import type { RenderTask } from "pdfjs-dist";

export interface OptimizeOptions {
  quality: "low" | "medium" | "high";
  mode: "native" | "flatten";
  lossless?: boolean;
  rotation?: 0 | 90 | 180 | 270;
  signal?: AbortSignal;
  onProgress?: (percent: number, message: string) => void;
}
export interface OptimizeResult {
  blob: Blob;
  pageCount: number;
  fieldCount: number;
  unchanged: boolean;
  flattened: boolean;
}
const aborted = () => new DOMException("Processing cancelled", "AbortError");
const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw aborted();
};
const pdfSettings = {
  cMapUrl: "/pdfjs-assets/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs-assets/standard_fonts/",
  wasmUrl: "/pdfjs-assets/wasm/",
  useSystemFonts: false,
  stopAtErrors: true,
};

export async function optimizePdf(
  file: File,
  options: OptimizeOptions,
): Promise<OptimizeResult> {
  if (
    !["low", "medium", "high"].includes(options.quality) ||
    !["native", "flatten"].includes(options.mode) ||
    ![0, 90, 180, 270].includes(options.rotation || 0)
  )
    throw new Error(
      "Choose a supported compression level, method and rotation.",
    );
  check(options.signal);
  const native = await runQpdfWorker<
    Omit<OptimizeResult, "blob" | "flattened">
  >(
    file,
    {
      operation: "compress",
      quality:
        options.mode === "flatten" || options.lossless
          ? "lossless"
          : options.quality,
      rotation: options.mode === "flatten" ? 0 : options.rotation || 0,
      signal: options.signal,
      onProgress: (pct, message) =>
        options.onProgress?.(
          pct * (options.mode === "flatten" ? 0.1 : 1),
          message,
        ),
    },
    100 * 1024 * 1024,
  );
  if (options.mode === "native") return { ...native, flattened: false };
  if (native.pageCount > 200)
    throw new Error(
      "Image-only compression supports up to 200 pages. Use Keep text and forms for larger PDFs.",
    );
  const [pdfjs, { PDFDocument }] = await Promise.all([
    loadPdfjs(),
    import("pdf-lib"),
  ]);
  check(options.signal);
  const task = pdfjs.getDocument({
    data: await native.blob.arrayBuffer(),
    ...pdfSettings,
  });
  let render: RenderTask | undefined;
  const onAbort = () => {
    render?.cancel();
    void task.destroy();
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    onAbort();
  }, 180000);
  try {
    check(options.signal);
    const pdf = await task.promise,
      output = await PDFDocument.create();
    const [dpi, quality] = (
      { low: [96, 0.5], medium: [150, 0.7], high: [200, 0.92] } as const
    )[options.quality];
    let totalBytes = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      check(options.signal);
      const page = await pdf.getPage(i),
        rotation = (page.rotate + (options.rotation || 0)) % 360;
      const physical = page.getViewport({ scale: 1, rotation });
      const view = page.getViewport({ scale: dpi / 72, rotation });
      if (
        !Number.isFinite(view.width * view.height) ||
        view.width < 1 ||
        view.height < 1 ||
        view.width > 8192 ||
        view.height > 8192 ||
        Math.ceil(view.width) * Math.ceil(view.height) > 16000000
      )
        throw new Error(
          "A page exceeds the 16-megapixel image limit. Choose a lower compression quality or Keep text and forms.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(view.width);
      canvas.height = Math.ceil(view.height);
      try {
        render = page.render({
          canvas,
          viewport: view,
          background: "rgb(255,255,255)",
        });
        await render.promise;
        render = undefined;
        check(options.signal);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b
                ? resolve(b)
                : reject(
                    new Error(
                      "This page could not be encoded. No partial PDF was created.",
                    ),
                  ),
            "image/jpeg",
            quality,
          ),
        );
        totalBytes += blob.size;
        if (totalBytes > 200 * 1024 * 1024)
          throw new Error(
            "The image-only result exceeds 200MB. Use a smaller PDF or lower quality.",
          );
        check(options.signal);
        const img = await output.embedJpg(await blob.arrayBuffer());
        output
          .addPage([physical.width, physical.height])
          .drawImage(img, {
            x: 0,
            y: 0,
            width: physical.width,
            height: physical.height,
          });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
      options.onProgress?.(
        10 + (i / pdf.numPages) * 85,
        `Compressing page ${i} of ${pdf.numPages}…`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    check(options.signal);
    const bytes = await output.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    check(options.signal);
    if (bytes.length > 200 * 1024 * 1024)
      throw new Error("The result exceeds 200MB. Choose a smaller PDF.");
    const unchanged = !options.rotation && bytes.length >= file.size;
    options.onProgress?.(100, "PDF ready");
    return {
      blob: unchanged
        ? file
        : new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }),
      pageCount: pdf.numPages,
      fieldCount: unchanged ? native.fieldCount : 0,
      unchanged,
      flattened: !unchanged,
    };
  } catch (error) {
    if (options.signal?.aborted) throw aborted();
    if (timedOut)
      throw new Error(
        "This PDF took too long. Choose a smaller document and retry.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    render?.cancel();
    await task.destroy();
  }
}

/** Bounded preview; it does not allocate a canvas at the document's native size. */
export async function optimizationPreview(file: File, signal: AbortSignal) {
  check(signal);
  const pdfjs = await loadPdfjs();
  check(signal);
  const task = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    ...pdfSettings,
  });
  let render: RenderTask | undefined;
  const abort = () => {
    render?.cancel();
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 30000);
  try {
    check(signal);
    const pdf = await task.promise,
      page = await pdf.getPage(1),
      base = page.getViewport({ scale: 1 });
    if (
      !Number.isFinite(base.width * base.height) ||
      base.width <= 0 ||
      base.height <= 0
    )
      throw new Error("This page has invalid dimensions.");
    const viewport = page.getViewport({
      scale: Math.min(230 / base.width, 280 / base.height),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    try {
      render = page.render({ canvas, viewport });
      await render.promise;
      check(signal);
      return {
        thumbnail: canvas.toDataURL("image/png"),
        pageCount: pdf.numPages,
      };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    render?.cancel();
    await task.destroy();
  }
}
