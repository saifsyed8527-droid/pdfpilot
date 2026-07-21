/**
 * PDF Render Engine — wraps pdfjs-dist's page-to-canvas rendering. The
 * pattern here (getViewport -> render onto a canvas) already exists inlined
 * inside pdf-to-jpg-client.tsx; that working, shipped tool is left
 * untouched (see the note in pdf-engine.ts about not rewriting existing
 * tools for no functional gain). This module exists so the *next* consumer
 * of "render a PDF page as a canvas" — OCR PDF, the first one — doesn't
 * duplicate that logic a second time, the same "extract once two real
 * consumers exist" rule pdf-text-extraction.ts followed in the Document
 * Conversion Suite sprint.
 */

import { loadPdfjs } from "../pdfjs";

export interface RenderedPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
}

/** Renders every page of a PDF to its own canvas at the given scale
 *  (2 = roughly 144 DPI from a standard 72-DPI PDF page, the same scale
 *  pdf-to-jpg already uses for quality output; callers previewing a
 *  freshly-produced output Blob — not a user-uploaded File — pass a
 *  smaller scale and rely on `Blob` being the wider type here, since a
 *  `File` already is one).
 *
 *  `onPageRendered` fires immediately after each individual page finishes,
 *  before the rest of the document has rendered — real, measured need:
 *  a 150-page document benchmarked at 2+ minutes total, all-or-nothing,
 *  with the UI showing nothing until every page was done. Callers that
 *  display pages incrementally (PageThumbnailGrid) use this to show page 1
 *  the moment it's ready instead of making the user wait for page 150. The
 *  final returned array is unchanged for callers (OCR PDF) that only need
 *  the complete set. */
export async function renderPdfPages(
  file: Blob,
  scale: number = 2,
  onProgress?: (pageNumber: number, totalPages: number) => void,
  onPageRendered?: (page: RenderedPage, totalPages: number) => void
): Promise<RenderedPage[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: RenderedPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, viewport }).promise;
    const rendered = { pageNumber, canvas };
    pages.push(rendered);
    onProgress?.(pageNumber, pdf.numPages);
    onPageRendered?.(rendered, pdf.numPages);
  }

  return pages;
}
