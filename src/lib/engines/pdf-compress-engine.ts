/**
 * Shared PDF compression engine — the page-rasterize-to-JPEG technique
 * (getPage -> render onto canvas -> re-encode as JPEG -> embed into a fresh
 * PDFDocument) used by both Compress PDF and Split PDF's Size mode "Allow
 * compression" option. Extracted here (rather than duplicated) once a
 * second real consumer needed it, following this codebase's "extract once
 * two real consumers exist" convention.
 *
 * IMPORTANT, measured tradeoff (see compressPdfPagesWithGuard's doc comment):
 * this technique flattens every page to a raster image, which is a real win
 * for image-heavy PDFs but can make text-heavy PDFs *larger* than the
 * original, since flattening throws away the original's efficient text/
 * vector encoding. Measured on a real 11KB, 10-page text-only PDF: the
 * rasterized output was 480KB — 42x larger. `compressPdfPagesWithGuard`
 * exists specifically to make that failure mode impossible for the caller.
 */

import { loadPdfjs } from "../pdfjs";

/** Matches Split PDF's Size-mode "Allow compression" default — a
 *  reasonable one-size-fits-all preset when a caller needs to shrink a
 *  page to fit under a byte limit without exposing its own quality
 *  selector. */
export const SIZE_SPLIT_SCALE = 1.5;
export const SIZE_SPLIT_JPEG_QUALITY = 0.7;

/** Re-encodes every page of `pdfBytes` as a rasterized JPEG page at the
 *  given scale/quality, returning a new PDF. This is the raw technique —
 *  no size comparison against the original, since some callers (Split
 *  PDF's Size mode, which is already deliberately shrinking pages to fit a
 *  byte budget) want the rasterized result unconditionally. Callers that
 *  want "never hand back something worse than the input" should use
 *  `compressPdfPagesWithGuard` instead. */
export async function compressPdfPages(
  pdfBytes: ArrayBuffer,
  scale: number,
  jpegQuality: number,
  onPageProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const [pdfjsLib, { PDFDocument }] = await Promise.all([loadPdfjs(), import("pdf-lib")]);
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdf = await loadingTask.promise;

  try {
    const numPages = pdf.numPages;
    const out = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

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
        }, "image/jpeg", jpegQuality)
      );
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const jpegImage = await out.embedJpg(jpegBytes);

      const newPage = out.addPage([viewport.width, viewport.height]);
      newPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      onPageProgress?.(i, numPages);
    }

    return await out.save({ useObjectStreams: true, addDefaultPage: false });
  } finally {
    loadingTask.destroy();
  }
}

/** Used by Split PDF's Size mode as a pre-pass before byte-size grouping. */
export async function compressPdfForSizeSplit(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  return compressPdfPages(pdfBytes, SIZE_SPLIT_SCALE, SIZE_SPLIT_JPEG_QUALITY);
}

export interface GuardedCompressResult {
  bytes: Uint8Array;
  /** True when rasterizing didn't actually help (the candidate came back
   *  the same size or larger than the source) and the original bytes were
   *  returned unchanged instead of a bigger "compressed" file. */
  keptOriginal: boolean;
}

/**
 * Compress PDF's actual entry point: rasterizes at the given scale/quality,
 * then compares the result against the original byte size. If rasterizing
 * didn't help — the real, measured failure mode for text-heavy PDFs, where
 * flattening replaces efficient text encoding with a raster image and can
 * make the file dramatically *larger* — the original bytes are returned
 * unchanged rather than handing the user a "compressed" file that is
 * actually bigger than what they uploaded.
 */
export async function compressPdfPagesWithGuard(
  originalBytes: ArrayBuffer,
  scale: number,
  jpegQuality: number,
  onPageProgress?: (done: number, total: number) => void
): Promise<GuardedCompressResult> {
  const compressed = await compressPdfPages(originalBytes, scale, jpegQuality, onPageProgress);
  if (compressed.byteLength >= originalBytes.byteLength) {
    return { bytes: new Uint8Array(originalBytes), keptOriginal: true };
  }
  return { bytes: compressed, keptOriginal: false };
}
