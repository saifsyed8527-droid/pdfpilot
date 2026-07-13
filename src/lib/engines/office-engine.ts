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
 * Reuses the Markdown to PDF pipeline (parseMarkdownToBlocks +
 * renderBlocksToPdf) rather than hand-rolling slide/table PDF layout a
 * second and third time — officeparser's `convert(file, 'md')` produces
 * real Markdown (headings, paragraphs, tables-as-Markdown-tables) from any
 * supported office file, so the existing Markdown parser and PDF renderer
 * already know what to do with it.
 */

import { parseMarkdownToBlocks } from "./text-engine";
import { renderBlocksToPdf, type PdfTextBlock } from "./pdf-text-renderer";

/** Converts an office file (.pptx, .xlsx, etc.) to Markdown via
 *  officeparser's one-step convert API, then lays that Markdown out as a
 *  PDF using the same renderer every other "text to PDF" tool uses. */
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

  const blocks: PdfTextBlock[] = await parseMarkdownToBlocks(markdown);
  if (blocks.length === 0) {
    throw new Error(
      "No text content could be extracted from this file. It may be empty, or contain only images or charts."
    );
  }

  return renderBlocksToPdf(blocks, { onProgress });
}
