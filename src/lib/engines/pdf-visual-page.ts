import type { PDFPage } from "pdf-lib";

/** Visible page coordinates: bottom-left origin after CropBox and /Rotate. */
export function visualPageGeometry(page: PDFPage) {
  const crop = page.getCropBox(), media = page.getMediaBox();
  const x = Math.max(crop.x, media.x), y = Math.max(crop.y, media.y);
  const w = Math.min(crop.x + crop.width, media.x + media.width) - x;
  const h = Math.min(crop.y + crop.height, media.y + media.height) - y;
  if (!(w > 0 && h > 0)) throw new Error("This PDF has an invalid visible page area.");
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  let matrix: [number, number, number, number, number, number];
  switch (rotation) {
    case 0: matrix = [1, 0, 0, 1, x, y]; break;
    case 90: matrix = [0, 1, -1, 0, x + w, y]; break;
    case 180: matrix = [-1, 0, 0, -1, x + w, y + h]; break;
    case 270: matrix = [0, -1, 1, 0, x, y + h]; break;
    default: throw new Error("This PDF has an unsupported page rotation.");
  }
  return { width: rotation % 180 ? h : w, height: rotation % 180 ? w : h, matrix };
}

export async function drawInVisualSpace(page: PDFPage, draw: (width: number, height: number) => Promise<void> | void) {
  const { pushGraphicsState, concatTransformationMatrix, popGraphicsState } = await import("pdf-lib");
  const { width, height, matrix } = visualPageGeometry(page);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrix));
  try { await draw(width, height); }
  finally { page.pushOperators(popGraphicsState()); }
}

export function assertNotCancelled(isCancelled?: () => boolean) {
  if (isCancelled?.()) throw new Error("Processing cancelled.");
}

export function validatePageRange(from: number, to: number, count: number) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > count) {
    throw new Error(`Choose a page range between 1 and ${count}.`);
  }
}
