import { loadPdfjs } from "./pdfjs";

export interface ExtractedPage {
  pageNumber: number;
  paragraphs: string[];
}

/**
 * Extracts text from every page of a PDF, grouped into paragraphs. Shared by
 * every "PDF -> editable document" tool (PDF to Word, PDF to PowerPoint) so
 * the extraction/grouping logic exists exactly once.
 *
 * This is a text extraction, not a layout-preserving one: pdf.js's own
 * `hasEOL` flag groups text runs into lines, and a paragraph break is
 * inferred wherever the vertical gap between two lines is meaningfully
 * larger than the page's typical (median) line gap. It's a reasonable,
 * honest heuristic — not OCR, not table/column detection, and it will not
 * perfectly reconstruct complex layouts. Tools using this should disclose
 * that plainly rather than imply pixel-perfect conversion.
 */
export async function extractPdfText(file: File): Promise<ExtractedPage[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const lines: { text: string; y: number }[] = [];
    let currentLine = "";
    let currentY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue; // skip TextMarkedContent entries
      if (currentY === null) currentY = item.transform[5];
      currentLine += item.str;
      if (item.hasEOL) {
        const trimmed = currentLine.trim();
        if (trimmed) lines.push({ text: trimmed, y: currentY ?? 0 });
        currentLine = "";
        currentY = null;
      }
    }
    const trailing = currentLine.trim();
    if (trailing) lines.push({ text: trailing, y: currentY ?? 0 });

    // Median gap between consecutive lines is this page's "typical" line
    // spacing; a gap noticeably larger than that starts a new paragraph.
    const gaps: number[] = [];
    for (let i = 1; i < lines.length; i++) {
      gaps.push(Math.abs(lines[i - 1].y - lines[i].y));
    }
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const typicalGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;

    const paragraphs: string[] = [];
    let paragraph = "";
    let previousY: number | null = null;

    for (const line of lines) {
      const gapFromPrevious = previousY === null ? 0 : Math.abs(previousY - line.y);
      const isNewParagraph = previousY !== null && typicalGap > 0 && gapFromPrevious > typicalGap * 1.6;

      if (isNewParagraph && paragraph) {
        paragraphs.push(paragraph.trim());
        paragraph = "";
      }
      paragraph += (paragraph ? " " : "") + line.text;
      previousY = line.y;
    }
    if (paragraph.trim()) paragraphs.push(paragraph.trim());

    pages.push({ pageNumber, paragraphs });
  }

  return pages;
}

/** True when a PDF has no extractable text at all — almost always means the
 *  PDF is a scanned image with no real text layer (OCR would be required,
 *  which no tool in this project performs). */
export function hasNoExtractableText(pages: ExtractedPage[]): boolean {
  return pages.every((page) => page.paragraphs.length === 0);
}
