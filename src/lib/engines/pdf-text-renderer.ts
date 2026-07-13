/**
 * PDF Text Renderer — lays out heading/paragraph blocks onto a new PDF
 * using pdf-lib. Extracted from word-to-pdf-client.tsx now that Markdown to
 * PDF needs the identical layout logic — the same "extract once two real
 * consumers exist" rule already applied to word-engine.ts and
 * pdf-render-engine.ts.
 *
 * This is a text-flow renderer, not a layout-preserving one: fixed
 * US Letter page size, fixed margins, fixed heading sizes, word-wrapped
 * paragraphs. Every tool using this should disclose that plainly (as
 * Word to PDF already does) rather than imply pixel-perfect output.
 */

export type PdfTextBlockType = "heading1" | "heading2" | "heading3" | "paragraph";

export interface PdfTextBlock {
  type: PdfTextBlockType;
  text: string;
}

const PAGE_WIDTH = 612; // US Letter, in points
const PAGE_HEIGHT = 792;
const MARGIN = 56;

// pdf-lib's standard 14 fonts only support WinAnsi encoding, which can't
// represent common characters like bullets (U+25AA/U+2022), smart quotes,
// or em-dashes — drawing such text throws instead of degrading. Map the
// common cases to a visually equivalent ASCII form and fall back to "?" for
// anything else WinAnsi genuinely can't encode (verified against the same
// encoder pdf-lib uses internally, @pdf-lib/standard-fonts).
const TYPOGRAPHIC_REPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "--", "…": "...",
  "•": "-", "▪": "-", "●": "-", "‣": "-",
  " ": " ",
};

async function loadWinAnsiEncoding() {
  const { Encodings } = await import("@pdf-lib/standard-fonts");
  return Encodings.WinAnsi;
}

function sanitizeForWinAnsi(text: string, winAnsi: Awaited<ReturnType<typeof loadWinAnsiEncoding>>): string {
  let result = "";
  for (const char of text) {
    const mapped = TYPOGRAPHIC_REPLACEMENTS[char];
    if (mapped !== undefined) {
      result += mapped;
      continue;
    }
    const codePoint = char.codePointAt(0) ?? 63;
    result += winAnsi.canEncodeUnicodeCodePoint(codePoint) ? char : "?";
  }
  return result;
}

/** Renders typed blocks onto a new US Letter PDF, one page at a time as
 *  content overflows. `startNewPageBeforeIndices` optionally forces a page
 *  break before specific block indices — used by slide-per-page renderers
 *  (PowerPoint to PDF) without duplicating this layout function. */
export async function renderBlocksToPdf(
  blocks: PdfTextBlock[],
  options: { onProgress?: (percent: number) => void; startNewPageBeforeIndices?: Set<number> } = {}
): Promise<Blob> {
  const [{ PDFDocument, StandardFonts, rgb }, winAnsi] = await Promise.all([
    import("pdf-lib"),
    loadWinAnsiEncoding(),
  ]);
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maxLineWidth = PAGE_WIDTH - MARGIN * 2;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const wrapText = (text: string, font: typeof regularFont, fontSize: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };

  blocks.forEach((block, index) => {
    if (options.startNewPageBeforeIndices?.has(index) && y !== PAGE_HEIGHT - MARGIN) {
      newPage();
    }

    const isHeading = block.type !== "paragraph";
    const font = isHeading ? boldFont : regularFont;
    const fontSize =
      block.type === "heading1" ? 20 : block.type === "heading2" ? 16 : block.type === "heading3" ? 14 : 11;
    const lineHeight = fontSize * 1.4;

    const lines = wrapText(sanitizeForWinAnsi(block.text, winAnsi), font, fontSize);

    if (isHeading) ensureSpace(lineHeight + 8);
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      page.drawText(line, { x: MARGIN, y: y - fontSize, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    });
    y -= isHeading ? 10 : 8;

    options.onProgress?.(((index + 1) / blocks.length) * 100);
  });

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

/** Renders a 2D array of cell strings as a simple ruled table — used by
 *  CSV to PDF. Column widths are equal (the honest choice for arbitrary
 *  CSV data with no column-width hints), and rows split across pages when
 *  a page fills up, redrawing the header row so a split table still reads
 *  correctly on the next page. */
export async function renderTableToPdf(
  rows: string[][],
  options: { onProgress?: (percent: number) => void } = {}
): Promise<Blob> {
  if (rows.length === 0) {
    throw new Error("There are no rows to render.");
  }

  const [{ PDFDocument, StandardFonts, rgb }, winAnsi] = await Promise.all([
    import("pdf-lib"),
    loadWinAnsiEncoding(),
  ]);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 9;
  const rowHeight = fontSize * 2;
  const columnCount = Math.max(...rows.map((row) => row.length));
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const columnWidth = tableWidth / columnCount;
  const [headerRow, ...bodyRows] = rows;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawRow = (cells: string[], isHeader: boolean) => {
    const rowFont = isHeader ? boldFont : font;
    for (let col = 0; col < columnCount; col++) {
      const raw = sanitizeForWinAnsi(cells[col] ?? "", winAnsi);
      // Truncate rather than wrap: a fixed equal-width grid has no honest
      // way to grow a single cell without breaking every other column's
      // alignment, so an overflowing cell is trimmed with an ellipsis.
      let text = raw;
      while (text.length > 0 && rowFont.widthOfTextAtSize(text + "…", fontSize) > columnWidth - 6) {
        text = text.slice(0, -1);
      }
      if (text !== raw) text += "…";
      page.drawText(text, {
        x: MARGIN + col * columnWidth + 3,
        y: y - fontSize,
        size: fontSize,
        font: rowFont,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
    page.drawLine({
      start: { x: MARGIN, y: y - rowHeight + fontSize * 0.3 },
      end: { x: MARGIN + tableWidth, y: y - rowHeight + fontSize * 0.3 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= rowHeight;
  };

  const newPageWithHeader = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawRow(headerRow, true);
  };

  drawRow(headerRow, true);
  bodyRows.forEach((row, index) => {
    if (y - rowHeight < MARGIN) newPageWithHeader();
    drawRow(row, false);
    options.onProgress?.(((index + 1) / bodyRows.length) * 100);
  });

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}
