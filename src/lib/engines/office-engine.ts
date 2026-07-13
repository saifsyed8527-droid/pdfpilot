/**
 * Office Engine — reads .pptx/.xlsx (and other office formats) via
 * officeparser (verified real: v7.2.3, actively maintained — pushed the
 * day before this was written — 497 GitHub stars, zero vulnerable
 * dependencies confirmed via `npm audit`, genuine browser build at
 * `officeparser.browser.mjs`). This is what makes PowerPoint to PDF and
 * Excel to PDF possible at all: no other real, maintained, browser-
 * compatible library for reading these formats was found (see the git
 * history / sprint report for the full verification record, including the
 * rejected candidates: pptx-parser, node-pptx, pptx2json).
 *
 * Reuses the Markdown to PDF pipeline (parseMarkdownToSegments +
 * renderBlocksToPdf/renderTableToPdf) rather than hand-rolling slide/table
 * PDF layout a second and third time — officeparser's `convert(file, 'md')`
 * produces real Markdown from any supported office file. Spreadsheets in
 * particular convert to almost nothing but Markdown tables, so this reuses
 * the same table renderer CSV to PDF already established rather than the
 * plain block renderer, which can't represent a table at all.
 */

import { parseMarkdownToSegments } from "./text-engine";
import { renderBlocksToPdf, renderTableToPdf } from "./pdf-text-renderer";

/** Converts an office file (.pptx, .xlsx, etc.) to Markdown via
 *  officeparser's one-step convert API, splits that Markdown into ordered
 *  text/table segments, renders each with the matching existing renderer,
 *  and stitches the resulting pages into one PDF — reusing pdf-lib's
 *  `copyPages`, the same page-combining primitive `insertPdfPages` in
 *  pdf-engine.ts already uses, rather than a new merge implementation. */
export async function convertOfficeFileToPdf(
  file: File,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const { convert } = await import("officeparser");
  const arrayBuffer = await file.arrayBuffer();

  let markdown: string;
  try {
    // officeparser can't infer the source file type from a bare ArrayBuffer
    // (no extension to read), so its generic return type widens to the
    // full result union instead of narrowing to "md" -> string. Runtime
    // guard rather than an unsafe cast, since a truly unexpected return
    // shape should surface as a real, honest error, not be assumed away.
    const result = await convert(arrayBuffer, "md");
    if (typeof result.value !== "string") {
      throw new Error("Unexpected non-text result from the office file parser.");
    }
    markdown = result.value;
  } catch (error) {
    throw new Error(
      `"${file.name}" couldn't be read. It may be corrupted, password-protected, or use a feature this converter doesn't support.`,
      { cause: error }
    );
  }

  const segments = await parseMarkdownToSegments(markdown);
  if (segments.length === 0) {
    throw new Error(
      "No text content could be extracted from this file. It may be empty, or contain only images or charts."
    );
  }

  // The common case (a document with no tables) needs no page-merging at
  // all — skip it rather than pay for a second PDFDocument load/copy.
  if (segments.length === 1 && segments[0].kind === "blocks") {
    return renderBlocksToPdf(segments[0].blocks, { onProgress });
  }

  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create();

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentBlob =
      segment.kind === "table" ? await renderTableToPdf(segment.rows) : await renderBlocksToPdf(segment.blocks);
    const segmentPdf = await PDFDocument.load(new Uint8Array(await segmentBlob.arrayBuffer()));
    const copiedPages = await output.copyPages(segmentPdf, segmentPdf.getPageIndices());
    copiedPages.forEach((page) => output.addPage(page));
    onProgress?.(((i + 1) / segments.length) * 100);
  }

  const pdfBytes = await output.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

/**
 * Extracts the first table (first sheet with data, for a spreadsheet) from
 * an office file as raw rows — the same officeparser markdown pipeline
 * `convertOfficeFileToPdf` uses, stopping one step earlier instead of
 * rendering a PDF. Feeds Excel to XML.
 *
 * Deliberately returns only the *first* table: a multi-sheet workbook
 * would need a real per-sheet output shape (not just concatenated rows,
 * which would corrupt data if sheets have different columns), and no tool
 * on this site has asked for that yet. Documented as a real scope limit
 * on the Excel to XML tool page, not silently dropped.
 */
export async function extractFirstTableFromOfficeFile(file: File): Promise<string[][]> {
  const { convert } = await import("officeparser");
  const arrayBuffer = await file.arrayBuffer();

  let markdown: string;
  try {
    const result = await convert(arrayBuffer, "md");
    if (typeof result.value !== "string") {
      throw new Error("Unexpected non-text result from the office file parser.");
    }
    markdown = result.value;
  } catch (error) {
    throw new Error(
      `"${file.name}" couldn't be read. It may be corrupted, password-protected, or use a feature this converter doesn't support.`,
      { cause: error }
    );
  }

  const segments = await parseMarkdownToSegments(markdown);
  const firstTable = segments.find((segment) => segment.kind === "table");
  if (!firstTable) {
    throw new Error(
      "No table data was found in this file. This tool expects spreadsheet data — a document with only text or images has nothing to convert."
    );
  }

  return firstTable.rows;
}
