import { loadPdfjs } from "../pdfjs";
import { ORGANIZE_LIMITS } from "./pdf-organize-types";

export async function loadOrganizePreview(
  file: File,
  signal: AbortSignal,
  remainingPages: number,
  onProgress: (page: number, total: number) => void,
) {
  const check = () => {
    if (signal.aborted)
      throw new DOMException("Loading cancelled.", "AbortError");
  };
  check();
  if (file.size > ORGANIZE_LIMITS.fileBytes)
    throw new Error("Each PDF must be 100MB or smaller.");
  const pdfjs = await loadPdfjs(),
    data = await file.arrayBuffer();
  check();
  const loading = pdfjs.getDocument({ data });
  let render: import("pdfjs-dist").RenderTask | undefined;
  const abort = () => {
    render?.cancel();
    void loading.destroy().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const pdf = await loading.promise;
    check();
    if (pdf.isPureXfa)
      throw new Error("Export XFA forms as standard PDFs before organizing.");
    if (!pdf.numPages || pdf.numPages > remainingPages)
      throw new Error(
        "The workspace supports up to 1,000 pages. Add a smaller PDF.",
      );
    const pages: {
      pageIndex: number;
      thumbnail: string;
      width: number;
      height: number;
    }[] = [];
    for (let index = 0; index < pdf.numPages; index++) {
      check();
      const page = await pdf.getPage(index + 1);
      check();
      const natural = page.getViewport({ scale: 1 });
      if (
        ![natural.width, natural.height].every(
          (n) => Number.isFinite(n) && n > 0,
        )
      )
        throw new Error("This PDF contains an invalid page size.");
      const viewport = page.getViewport({
        scale: Math.min(0.5, 280 / natural.width, 280 / natural.height),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      try {
        render = page.render({ canvas, viewport, background: "white" });
        await render.promise;
        check();
        pages.push({
          pageIndex: index,
          thumbnail: canvas.toDataURL("image/jpeg", 0.76),
          width: natural.width,
          height: natural.height,
        });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        render = undefined;
      }
      onProgress(index + 1, pdf.numPages);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return pages;
  } finally {
    signal.removeEventListener("abort", abort);
    await loading.destroy();
  }
}
