// Faithful copy of src/lib/pdf-text-extraction.ts's extractPdfText logic
// (post-fix), adapted only to load a Buffer instead of a browser File and to
// use pdfjs-dist's Node-compatible legacy build instead of the app's
// browser-worker wrapper (src/lib/pdfjs.ts).
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(bytes) {
  const pdf = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;

  const pageLines = [];
  const allHeights = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const lines = [];
    let currentLine = "";
    let currentY = null;
    let currentHeight = 0;
    let lastItem = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const isStyleDuplicate =
        lastItem !== null &&
        lastItem.str === item.str &&
        item.str.length > 0 &&
        Math.abs(y - lastItem.y) < 1 &&
        Math.abs(x - lastItem.x) < Math.max(lastItem.width, item.width) * 0.5;

      if (currentY === null) currentY = y;
      if (!isStyleDuplicate) {
        currentLine += item.str;
        lastItem = { str: item.str, x, y, width: item.width };
      }
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
        lastItem = null;
      }
    }
    const trailing = currentLine.trim();
    if (trailing) {
      lines.push({ text: trailing, y: currentY ?? 0, height: currentHeight });
      allHeights.push(currentHeight);
    }

    pageLines.push(lines);
  }

  const sortedHeights = [...allHeights].sort((a, b) => a - b);
  const bodyHeight = sortedHeights.length ? sortedHeights[Math.floor(sortedHeights.length / 2)] : 0;
  const classify = (height) => {
    if (bodyHeight <= 0) return "body";
    if (height >= bodyHeight * 1.6) return "heading1";
    if (height >= bodyHeight * 1.25) return "heading2";
    return "body";
  };

  const pages = [];

  for (let i = 0; i < pageLines.length; i++) {
    const lines = pageLines[i];

    const gaps = [];
    for (let j = 1; j < lines.length; j++) {
      gaps.push(Math.abs(lines[j - 1].y - lines[j].y));
    }
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const typicalGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;

    const paragraphs = [];
    const paragraphStyles = [];
    let paragraph = "";
    let firstLineHeight = 0;
    let linesInParagraph = 0;
    let previousY = null;

    const flushParagraph = () => {
      if (!paragraph.trim()) return;
      paragraphs.push(paragraph.trim());
      paragraphStyles.push(linesInParagraph === 1 ? classify(firstLineHeight) : "body");
      paragraph = "";
      firstLineHeight = 0;
      linesInParagraph = 0;
    };

    let previousHeight = null;
    for (const line of lines) {
      const gapFromPrevious = previousY === null ? 0 : Math.abs(previousY - line.y);
      const gapIsBig = previousY !== null && typicalGap > 0 && gapFromPrevious > typicalGap * 1.6;
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

export async function dumpRawItems(bytes) {
  const pdf = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
  const out = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      out.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        hasEOL: item.hasEOL,
      });
    }
  }
  return out;
}
