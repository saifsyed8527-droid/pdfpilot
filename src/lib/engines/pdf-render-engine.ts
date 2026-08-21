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
export interface RenderPdfPagesOptions {
  scale?: number;
  password?: string;
  onProgress?: (pageNumber: number, totalPages: number) => void;
  onPageRendered?: (page: RenderedPage, totalPages: number) => void;
}

export async function renderPdfPages(
  file: Blob,
  options: RenderPdfPagesOptions = {}
): Promise<RenderedPage[]> {
  const { scale = 2, password, onProgress, onPageRendered } = options;
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise;

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

/** Renders only page 1, for row/card thumbnails in a file list (e.g. Merge
 *  PDF's file list) — deliberately NOT `renderPdfPages(file, scale)[0]`,
 *  which would render every page of the document just to throw away all
 *  but the first. A 150-page file's list thumbnail should cost the same
 *  as a 1-page file's. Returns a data URL, ready to drop straight into an
 *  <img src>. `format`/`quality` default to a small PNG (list-thumbnail use
 *  case); callers needing a larger, lower-weight preview (e.g. Watermark
 *  PDF's live overlay preview) pass `"image/jpeg"` + a quality value instead. */
export async function renderFirstPageThumbnail(
  file: Blob,
  scale: number = 0.3,
  format: string = "image/png",
  quality?: number
): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL(format, quality);
}

/** Classifies a `renderPdfPages`/`renderFirstPageThumbnail` failure so
 *  callers can show a real reason instead of a generic "couldn't load"
 *  message. Matches on pdfjs's own exception `.name` (a plain string set
 *  in its constructor, e.g. `"PasswordException"`) rather than
 *  `instanceof` — verified directly against a real password-protected PDF
 *  and a real corrupt file that pdfjs's exception classes work correctly
 *  with `instanceof` here (unlike pdf-lib's compiled `EncryptedPDFError`
 *  elsewhere in this codebase), but matching on `.name` avoids importing
 *  pdfjs's exception classes into every caller just to compare against them. */
export type PdfRenderErrorKind = "password" | "corrupt" | "unknown";

export function classifyPdfRenderError(error: unknown): PdfRenderErrorKind {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") return "password";
  if (name === "InvalidPDFException") return "corrupt";
  return "unknown";
}

/** User-facing text for each `classifyPdfRenderError` outcome - shared so
 *  every caller (PageThumbnailGrid's inline banner, Rearrange Pages' toast)
 *  says the same thing for the same failure instead of drifting apart. */
export const PDF_RENDER_ERROR_MESSAGE: Record<PdfRenderErrorKind, string> = {
  password: "This PDF is password-protected. Remove the password and try again.",
  corrupt: "Couldn't read this PDF. The file may be corrupted or not a valid PDF.",
  unknown: "Couldn't read this PDF. Try a different file.",
};
