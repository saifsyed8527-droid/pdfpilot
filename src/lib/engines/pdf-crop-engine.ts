import { assertNotCancelled, visualPageGeometry } from "./pdf-visual-page";

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
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean
): Promise<CropPdfResult> {
  assertNotCancelled(isCancelled);
  const { xFrac, yFrac, widthFrac, heightFrac } = region;
  if (![xFrac, yFrac, widthFrac, heightFrac].every(Number.isFinite) || xFrac < 0 || yFrac < 0 || widthFrac < MIN_CROP_FRACTION || heightFrac < MIN_CROP_FRACTION || xFrac + widthFrac > 1.000001 || yFrac + heightFrac > 1.000001) {
    throw new Error("Draw a crop rectangle inside the page before continuing.");
  }
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pages = pdf.getPages(), totalPages = pages.length;
  if (!Number.isInteger(region.pageIndex) || region.pageIndex < 0 || region.pageIndex >= totalPages) throw new Error("Choose an existing page to crop.");
  if (scope !== "all" && scope !== "current") throw new Error("Choose whether to crop this page or every page.");
  const targets = scope === "all" ? pages.map((_, index) => index) : [region.pageIndex];
  for (let step = 0; step < targets.length; step++) {
    assertNotCancelled(isCancelled);
    const page = pages[targets[step]], { width, height, matrix: [a, b, c, d, e, f] } = visualPageGeometry(page);
    // UI selection has a top-left origin; visual PDF coordinates have a bottom-left origin.
    const x1 = xFrac * width, y1 = (1 - yFrac) * height;
    const x2 = Math.min(1, xFrac + widthFrac) * width, y2 = (1 - Math.min(1, yFrac + heightFrac)) * height;
    const px1 = a * x1 + c * y1 + e, py1 = b * x1 + d * y1 + f;
    const px2 = a * x2 + c * y2 + e, py2 = b * x2 + d * y2 + f;
    page.setCropBox(Math.min(px1, px2), Math.min(py1, py2), Math.abs(px2 - px1), Math.abs(py2 - py1));
    onProgress?.(((step + 1) / targets.length) * 95);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  assertNotCancelled(isCancelled);
  const pdfBytes = await pdf.save();
  assertNotCancelled(isCancelled);
  onProgress?.(100);
  return { blob: new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" }), pageCount: totalPages };
}
