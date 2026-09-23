/**
 * Crop engine for the Crop PDF tool.
 *
 * A crop selection is captured as fractions (0-1) of the page's own
 * rendered viewport — not screen pixels and not PDF points — specifically
 * so it survives zoom changes untouched: the live viewer converts a drag
 * gesture to fractions using the *currently rendered* element's size, and
 * CSS percentage positioning renders the same fractions back correctly at
 * any zoom level. No coordinate ever needs "unzooming."
 *
 * Turning a fraction-space rectangle into a real PDF CropBox uses pdfjs's
 * own `PageViewport.convertToPdfPoint`, rather than a hand-rolled rotation
 * matrix, so page rotation (0/90/180/270) is handled by the same tested
 * code pdfjs itself uses to place rendered content — this is the part the
 * task explicitly warned is easy to get quietly wrong.
 */

export interface CropRegion {
  /** 0-based index of the page this rectangle was drawn on. */
  pageIndex: number;
  /** Fractions of the page's rendered viewport, top-left origin (DOM/CSS convention). */
  xFrac: number;
  yFrac: number;
  widthFrac: number;
  heightFrac: number;
}

export type CropScope = "all" | "current";

export const MIN_CROP_FRACTION = 0.04;

export interface CropPdfResult {
  blob: Blob;
  pageCount: number;
}

export async function cropPdfDocument(
  file: File,
  region: CropRegion,
  scope: CropScope,
  onProgress?: (percent: number) => void
): Promise<CropPdfResult> {
  const { PDFDocument } = await import("pdf-lib");
  const { loadPdfjs } = await import("../pdfjs");

  const pdfLibBytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(pdfLibBytes);
  const pages = pdf.getPages();
  const totalPages = pages.length;

  const pdfjsLib = await loadPdfjs();
  const pdfjsBytes = await file.arrayBuffer();
  const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfjsBytes }).promise;

  const targetIndices = scope === "all" ? pages.map((_, i) => i) : [region.pageIndex];

  for (let step = 0; step < targetIndices.length; step++) {
    const pageIndex = targetIndices[step];
    const pdfPage = pages[pageIndex];
    const pdfjsPage = await pdfjsDoc.getPage(pageIndex + 1);
    const viewport = pdfjsPage.getViewport({ scale: 1 });

    const vx1 = region.xFrac * viewport.width;
    const vy1 = region.yFrac * viewport.height;
    const vx2 = (region.xFrac + region.widthFrac) * viewport.width;
    const vy2 = (region.yFrac + region.heightFrac) * viewport.height;

    const [px1, py1] = viewport.convertToPdfPoint(vx1, vy1);
    const [px2, py2] = viewport.convertToPdfPoint(vx2, vy2);

    const x = Math.min(px1, px2);
    const y = Math.min(py1, py2);
    const width = Math.abs(px2 - px1);
    const height = Math.abs(py2 - py1);

    pdfPage.setCropBox(x, y, width, height);
    onProgress?.(((step + 1) / targetIndices.length) * 100);
  }

  const pdfBytes = await pdf.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: totalPages };
}
