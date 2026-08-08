import { loadPdfjs } from "./pdfjs";

export type ParagraphStyle = "heading1" | "heading2" | "body";

export interface ExtractedPage {
  pageNumber: number;
  paragraphs: string[];
  /** Same length/order as `paragraphs` - kept as a parallel array rather
   *  than changing `paragraphs`' own element type, so existing consumers
   *  that only read `paragraphs` (Compare PDF's comparePdfText below)
   *  are unaffected by this addition. */
  paragraphStyles: ParagraphStyle[];
}

/**
 * Extracts text from every page of a PDF, grouped into paragraphs, with a
 * heading/body classification per paragraph. Shared by every "PDF ->
 * editable document" tool (PDF to Word, Compare PDF) so the extraction/
 * grouping logic exists exactly once.
 *
 * This is a text extraction, not a layout-preserving one: pdf.js's own
 * `hasEOL` flag groups text runs into lines, and a paragraph break is
 * inferred wherever the vertical gap between two lines is meaningfully
 * larger than the page's typical (median) line gap. Heading detection uses
 * each line's real rendered glyph height (`item.height`, pdf.js's own
 * computed value, not a guess) relative to the whole document's median
 * line height - a line meaningfully taller than normal body text becomes a
 * heading. It's a reasonable, honest heuristic - not OCR, not table/column
 * detection, and it will not perfectly reconstruct complex layouts. Tools
 * using this should disclose that plainly rather than imply pixel-perfect
 * conversion.
 */
export async function extractPdfText(file: File): Promise<ExtractedPage[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  interface RawLine {
    text: string;
    y: number;
    height: number;
  }
  const pageLines: RawLine[][] = [];
  const allHeights: number[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const lines: RawLine[] = [];
    let currentLine = "";
    let currentY: number | null = null;
    let currentHeight = 0;

    for (const item of content.items) {
      if (!("str" in item)) continue; // skip TextMarkedContent entries
      if (currentY === null) currentY = item.transform[5];
      currentLine += item.str;
      currentHeight = Math.max(currentHeight, item.height || 0);
      if (item.hasEOL) {
        const trimmed = currentLine.trim();
        if (trimmed) {
          lines.push({ text: trimmed, y: currentY ?? 0, height: currentHeight });
          allHeights.push(currentHeight);
        }
        currentLine = "";
        currentY = null;
        currentHeight = 0;
      }
    }
    const trailing = currentLine.trim();
    if (trailing) {
      lines.push({ text: trailing, y: currentY ?? 0, height: currentHeight });
      allHeights.push(currentHeight);
    }

    pageLines.push(lines);
  }

  // Document-wide median line height is the "body text" baseline - one
  // consistent reference across all pages rather than per-page, since a
  // page with only a title (one tall line) would otherwise have no real
  // "body" to compare against.
  const sortedHeights = [...allHeights].sort((a, b) => a - b);
  const bodyHeight = sortedHeights.length ? sortedHeights[Math.floor(sortedHeights.length / 2)] : 0;
  const classify = (height: number): ParagraphStyle => {
    if (bodyHeight <= 0) return "body";
    if (height >= bodyHeight * 1.6) return "heading1";
    if (height >= bodyHeight * 1.25) return "heading2";
    return "body";
  };

  const pages: ExtractedPage[] = [];

  for (let i = 0; i < pageLines.length; i++) {
    const lines = pageLines[i];

    // Median gap between consecutive lines is this page's "typical" line
    // spacing; a gap noticeably larger than that starts a new paragraph.
    const gaps: number[] = [];
    for (let j = 1; j < lines.length; j++) {
      gaps.push(Math.abs(lines[j - 1].y - lines[j].y));
    }
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const typicalGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;

    const paragraphs: string[] = [];
    const paragraphStyles: ParagraphStyle[] = [];
    let paragraph = "";
    let firstLineHeight = 0;
    let linesInParagraph = 0;
    let previousY: number | null = null;

    const flushParagraph = () => {
      if (!paragraph.trim()) return;
      paragraphs.push(paragraph.trim());
      // A heading is normally one short line, not several - a paragraph
      // spanning more than one line is always body text even if its first
      // line measured tall, so real multi-line body text is never
      // misclassified as a heading.
      paragraphStyles.push(linesInParagraph === 1 ? classify(firstLineHeight) : "body");
      paragraph = "";
      firstLineHeight = 0;
      linesInParagraph = 0;
    };

    let previousHeight: number | null = null;
    for (const line of lines) {
      const gapFromPrevious = previousY === null ? 0 : Math.abs(previousY - line.y);
      const gapIsBig = previousY !== null && typicalGap > 0 && gapFromPrevious > typicalGap * 1.6;
      // A meaningful font-size change between consecutive lines is at least
      // as strong a structural signal as a big vertical gap - real
      // documents routinely put a heading right up against its following
      // body text with normal line spacing, relying on the heading's own
      // size/weight to read as a break rather than extra whitespace.
      // Verified live: a test PDF with a 16pt heading followed by 11pt
      // body only ~30pt below (not 1.6x the page's own median gap) merged
      // into one giant paragraph and lost the heading entirely until this
      // check was added.
      const sizeChanged =
        previousHeight !== null && previousHeight > 0 && line.height > 0
          ? Math.max(line.height / previousHeight, previousHeight / line.height) > 1.25
          : false;

      if ((gapIsBig || sizeChanged) && paragraph) {
        flushParagraph();
      }
      if (linesInParagraph === 0) firstLineHeight = line.height;
      paragraph += (paragraph ? " " : "") + line.text;
      linesInParagraph++;
      previousY = line.y;
      previousHeight = line.height;
    }
    flushParagraph();

    pages.push({ pageNumber: i + 1, paragraphs, paragraphStyles });
  }

  return pages;
}

/** True when a PDF has no extractable text at all — almost always means the
 *  PDF is a scanned image with no real text layer (OCR would be required,
 *  which no tool in this project performs). */
export function hasNoExtractableText(pages: ExtractedPage[]): boolean {
  return pages.every((page) => page.paragraphs.length === 0);
}

export interface PdfTextDiffSegment {
  value: string;
  added: boolean;
  removed: boolean;
}

/** Extracts text from both PDFs (via extractPdfText) and word-diffs them —
 *  a text-content comparison, not a visual/pixel comparison. Two PDFs that
 *  look identical but have different underlying text extraction (e.g. one
 *  is a scanned image) will show as "entirely different" rather than
 *  "visually the same"; that's an honest limitation of comparing extracted
 *  text, not a bug, and callers should disclose it. Uses the `diff` package
 *  (verified real: v9.0.0, actively maintained, the standard JS diff lib)
 *  rather than hand-rolling an edit-distance algorithm. */
export async function comparePdfText(fileA: File, fileB: File): Promise<PdfTextDiffSegment[]> {
  const [pagesA, pagesB] = await Promise.all([extractPdfText(fileA), extractPdfText(fileB)]);
  const textA = pagesA.flatMap((p) => p.paragraphs).join("\n\n");
  const textB = pagesB.flatMap((p) => p.paragraphs).join("\n\n");

  const { diffWords } = await import("diff");
  return diffWords(textA, textB).map(({ value, added, removed }) => ({
    value,
    added: added ?? false,
    removed: removed ?? false,
  }));
}
