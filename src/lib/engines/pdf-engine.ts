/**
 * PDF Engine — the single place PDF tools depend on pdf-lib's PDFDocument
 * API. Every existing tool (merge, split, delete-pages, etc.) inlines its
 * own `await import("pdf-lib"); PDFDocument.load(...)` boilerplate; that
 * pattern is left untouched (it already works, already ships, rewriting 16
 * production tools for no functional gain is not this sprint's job). New
 * Phase 2 PDF tools should depend on this engine instead of repeating that
 * boilerplate a 17th, 18th, ... 300th time — the same "never duplicate
 * business logic" rule the Document Conversion Suite sprint established for
 * shared utilities (see pdf-text-extraction.ts) applied one layer down, to
 * the library itself rather than to one specific conversion's logic.
 *
 * Every export here wraps a pdf-lib capability verified directly against
 * node_modules/pdf-lib/es/api/PDFDocument.d.ts — nothing here is assumed.
 * pdf-lib is still dynamically imported inside each function (not at module
 * top level), preserving the project's established code-splitting pattern.
 */

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

async function loadPdfDocument(file: File) {
  const { PDFDocument } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  return PDFDocument.load(arrayBuffer);
}

async function toBlob(pdf: Awaited<ReturnType<typeof loadPdfDocument>>): Promise<Blob> {
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/** Opens a PDF and returns its page count — the most common "just tell me
 *  how many pages" need every page-manipulating tool has on file select. */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdf = await loadPdfDocument(file);
  return pdf.getPageCount();
}

/** Reads every metadata field pdf-lib exposes (verified real API: getTitle,
 *  getAuthor, getSubject, getKeywords, getCreator, getProducer,
 *  getCreationDate, getModificationDate). */
export async function readPdfMetadata(file: File): Promise<PdfMetadata> {
  const pdf = await loadPdfDocument(file);
  return {
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    keywords: pdf.getKeywords()?.split(",").map((k) => k.trim()).filter(Boolean),
    creator: pdf.getCreator(),
    producer: pdf.getProducer(),
    creationDate: pdf.getCreationDate(),
    modificationDate: pdf.getModificationDate(),
  };
}

/** Writes metadata fields and returns the re-saved PDF as a Blob. Only the
 *  fields present in `updates` are changed; omitted fields are left as-is
 *  (undefined means "don't touch", not "clear the field"). */
export async function writePdfMetadata(file: File, updates: PdfMetadata): Promise<Blob> {
  const pdf = await loadPdfDocument(file);
  if (updates.title !== undefined) pdf.setTitle(updates.title);
  if (updates.author !== undefined) pdf.setAuthor(updates.author);
  if (updates.subject !== undefined) pdf.setSubject(updates.subject);
  if (updates.keywords !== undefined) pdf.setKeywords(updates.keywords);
  if (updates.creator !== undefined) pdf.setCreator(updates.creator);
  if (updates.producer !== undefined) pdf.setProducer(updates.producer);
  if (updates.creationDate !== undefined) pdf.setCreationDate(updates.creationDate);
  if (updates.modificationDate !== undefined) pdf.setModificationDate(updates.modificationDate);
  return toBlob(pdf);
}

/** Duplicates each page index in `pageIndices` (0-based), inserting each
 *  copy immediately after its source page. Uses pdf-lib's verified real
 *  `copyPages`/`insertPage` pair — copying pages from a document into
 *  itself is the same documented pattern pdf-lib uses for cross-document
 *  copies. */
export async function duplicatePdfPages(file: File, pageIndices: number[]): Promise<Blob> {
  const pdf = await loadPdfDocument(file);
  const sorted = [...pageIndices].sort((a, b) => b - a);
  for (const index of sorted) {
    const [copy] = await pdf.copyPages(pdf, [index]);
    pdf.insertPage(index + 1, copy);
  }
  return toBlob(pdf);
}

/** Re-parses and re-saves a PDF through pdf-lib's parser, which is more
 *  lenient than many viewers about certain structural issues (missing or
 *  slightly malformed xref tables, some non-standard object layouts) — this
 *  is a real, narrow, well-documented pdf-lib usage pattern, not a general
 *  PDF repair tool. It cannot fix content-level corruption (missing page
 *  streams, truncated files) — callers must disclose that honestly. */
export async function resavePdf(file: File): Promise<Blob> {
  const pdf = await loadPdfDocument(file);
  return toBlob(pdf);
}
