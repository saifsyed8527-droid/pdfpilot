/**
 * Real PDF compression for Split PDF's Size mode "Allow compression" option
 * — the same page-rasterize-to-JPEG technique compress-pdf-client.tsx
 * already uses (getPage -> render onto canvas -> re-encode as JPEG ->
 * embed into a fresh PDFDocument), not a decorative checkbox. Kept as its
 * own module rather than folded into compress-pdf-client.tsx itself: that
 * component owns its own state/UI and isn't a shared engine today, and
 * duplicating ~15 lines of a well-understood technique here is safer than
 * refactoring an unrelated, already-shipped tool's internals to share it.
 */

import { loadPdfjs } from "../pdfjs";

/** Matches compress-pdf's "medium" preset — a reasonable default when
 *  Split PDF needs to shrink a page to fit under a user-specified size
 *  limit without a dedicated quality selector of its own. */
const SCALE = 1.5;
const JPEG_QUALITY = 0.7;

/** Re-encodes every page of `pdfBytes` as a rasterized JPEG page, returning
 *  a new, typically much smaller PDF. Used by Size mode as a pre-pass
 *  before byte-size grouping when compression is enabled. */
export async function compressPdfForSizeSplit(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const [pdfjsLib, { PDFDocument }] = await Promise.all([loadPdfjs(), import("pdf-lib")]);
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await loadingTask.promise;

  try {
    const numPages = pdf.numPages;
    const out = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvas, viewport }).promise;

      const jpegBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert canvas to blob"));
        }, "image/jpeg", JPEG_QUALITY)
      );
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const jpegImage = await out.embedJpg(jpegBytes);

      const newPage = out.addPage([viewport.width, viewport.height]);
      newPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }

    return await out.save({ useObjectStreams: true, addDefaultPage: false });
  } finally {
    loadingTask.destroy();
  }
}
