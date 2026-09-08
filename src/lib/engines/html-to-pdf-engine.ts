"use client";

import type { PDFPage } from "pdf-lib";

export type HtmlPdfScreenSize = "current" | "1920" | "1440" | "768" | "320";
export type HtmlPdfPageSize = "a3" | "a4" | "a5" | "letter";
export type HtmlPdfOrientation = "portrait" | "landscape";
export type HtmlPdfMargin = "none" | "small" | "big";

export interface HtmlPdfSettings {
  screenSize: HtmlPdfScreenSize;
  pageSize: HtmlPdfPageSize;
  orientation: HtmlPdfOrientation;
  oneLongPage: boolean;
  margin: HtmlPdfMargin;
  blockAds: boolean;
  removeOverlays: boolean;
}

type BlockType = "heading1" | "heading2" | "heading3" | "paragraph" | "list" | "code";

interface HtmlBlock {
  type: BlockType;
  text: string;
}

const PAGE_SIZES: Record<HtmlPdfPageSize, [number, number]> = {
  a3: [842, 1191],
  a4: [595, 842],
  a5: [420, 595],
  letter: [612, 792],
};

const MARGINS: Record<HtmlPdfMargin, number> = {
  none: 24,
  small: 40,
  big: 64,
};

const TYPOGRAPHIC_REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "--",
  "…": "...",
  "•": "-",
  "▪": "-",
  "●": "-",
  "‣": "-",
  "\u00a0": " ",
};

async function loadWinAnsiEncoding() {
  const { Encodings } = await import("@pdf-lib/standard-fonts");
  return Encodings.WinAnsi;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

function removeNoisyNodes(doc: Document, settings: HtmlPdfSettings) {
  doc.querySelectorAll("script, style, noscript, template, svg, canvas, video, audio").forEach((node) => node.remove());

  if (settings.blockAds) {
    doc
      .querySelectorAll(
        [
          "iframe",
          "[id*='ad' i]",
          "[class*='ad-' i]",
          "[class*='ads' i]",
          "[class*='advert' i]",
          "[aria-label*='advert' i]",
          "[data-ad]",
        ].join(",")
      )
      .forEach((node) => node.remove());
  }

  if (settings.removeOverlays) {
    doc
      .querySelectorAll(
        [
          "[class*='modal' i]",
          "[class*='popup' i]",
          "[class*='overlay' i]",
          "[class*='cookie' i]",
          "[id*='modal' i]",
          "[id*='popup' i]",
          "[id*='overlay' i]",
          "[role='dialog']",
        ].join(",")
      )
      .forEach((node) => node.remove());
  }
}

function pushBlock(blocks: HtmlBlock[], type: BlockType, text: string) {
  const value = cleanText(text);
  if (!value) return;
  const previous = blocks.at(-1);
  if (previous?.type === type && previous.text === value) return;
  blocks.push({ type, text: value });
}

function parseElement(element: Element, blocks: HtmlBlock[]) {
  const tag = element.tagName.toLowerCase();
  if (["nav", "footer", "aside", "button", "form", "input", "select", "textarea"].includes(tag)) return;

  if (tag === "h1") return pushBlock(blocks, "heading1", element.textContent ?? "");
  if (tag === "h2") return pushBlock(blocks, "heading2", element.textContent ?? "");
  if (/^h[3-6]$/.test(tag)) return pushBlock(blocks, "heading3", element.textContent ?? "");
  if (tag === "p" || tag === "blockquote") return pushBlock(blocks, "paragraph", element.textContent ?? "");
  if (tag === "pre" || tag === "code") return pushBlock(blocks, "code", element.textContent ?? "");
  if (tag === "li") return pushBlock(blocks, "list", `- ${element.textContent ?? ""}`);
  if (tag === "tr") {
    const cells = Array.from(element.querySelectorAll("th,td")).map((cell) => cleanText(cell.textContent ?? ""));
    if (cells.length) pushBlock(blocks, "paragraph", cells.join(" | "));
    return;
  }

  const children = Array.from(element.children);
  if (children.length === 0) {
    if (["article", "section", "main", "div"].includes(tag)) pushBlock(blocks, "paragraph", element.textContent ?? "");
    return;
  }

  children.forEach((child) => parseElement(child, blocks));
}

function htmlToBlocks(html: string, settings: HtmlPdfSettings): HtmlBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  removeNoisyNodes(doc, settings);

  const blocks: HtmlBlock[] = [];
  const title = cleanText(doc.querySelector("title")?.textContent ?? "");
  if (title) pushBlock(blocks, "heading1", title);

  const root = doc.body || doc.documentElement;
  Array.from(root.children).forEach((child) => parseElement(child, blocks));

  if (blocks.length === 0) {
    const fallback = cleanText(root.textContent ?? "");
    if (fallback) pushBlock(blocks, "paragraph", fallback);
  }

  return blocks.slice(0, 900);
}

function getPageSize(settings: HtmlPdfSettings): [number, number] {
  const [rawWidth, rawHeight] = PAGE_SIZES[settings.pageSize];
  if (settings.orientation === "landscape") return [Math.max(rawWidth, rawHeight), Math.min(rawWidth, rawHeight)];
  return [Math.min(rawWidth, rawHeight), Math.max(rawWidth, rawHeight)];
}

export async function convertHtmlToPdfBlob(
  html: string,
  settings: HtmlPdfSettings,
  options: { sourceLabel?: string; onProgress?: (percent: number) => void } = {}
): Promise<Blob> {
  const [{ PDFDocument, StandardFonts, rgb }, winAnsi] = await Promise.all([
    import("pdf-lib"),
    loadWinAnsiEncoding(),
  ]);

  const blocks = htmlToBlocks(html, settings);
  if (blocks.length === 0) throw new Error("This HTML doesn't contain readable text to convert.");

  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdf.embedFont(StandardFonts.Courier);
  const [pageWidth, basePageHeight] = getPageSize(settings);
  const margin = MARGINS[settings.margin];
  const maxLineWidth = Math.max(120, pageWidth - margin * 2);
  const longPageHeight = settings.oneLongPage
    ? Math.min(14400, Math.max(basePageHeight, 160 + blocks.reduce((sum, block) => sum + Math.ceil(block.text.length / 70) * 20 + 20, 0)))
    : basePageHeight;

  let page: PDFPage = pdf.addPage([pageWidth, longPageHeight]);
  let y = longPageHeight - margin;

  const wrapText = (text: string, font: typeof regularFont, fontSize: number): string[] => {
    const words = sanitizeForWinAnsi(text, winAnsi).split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxLineWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const addPage = () => {
    page = pdf.addPage([pageWidth, basePageHeight]);
    y = basePageHeight - margin;
  };

  const ensureSpace = (needed: number) => {
    if (!settings.oneLongPage && y - needed < margin) addPage();
  };

  if (options.sourceLabel) {
    page.drawText(sanitizeForWinAnsi(options.sourceLabel, winAnsi), {
      x: margin,
      y: y - 9,
      size: 9,
      font: regularFont,
      color: rgb(0.45, 0.45, 0.5),
    });
    y -= 28;
  }

  blocks.forEach((block, index) => {
    const font = block.type === "code" ? monoFont : block.type === "paragraph" || block.type === "list" ? regularFont : boldFont;
    const fontSize =
      block.type === "heading1" ? 22 : block.type === "heading2" ? 17 : block.type === "heading3" ? 14 : block.type === "code" ? 9 : 11;
    const lineHeight = fontSize * (block.type === "code" ? 1.55 : 1.42);
    const lines = wrapText(block.text, font, fontSize);

    ensureSpace(lineHeight + 10);
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      if (settings.oneLongPage && y - lineHeight < margin) return;
      page.drawText(line, {
        x: margin,
        y: y - fontSize,
        size: fontSize,
        font,
        color: block.type === "code" ? rgb(0.18, 0.22, 0.28) : rgb(0.1, 0.1, 0.12),
      });
      y -= lineHeight;
    });
    y -= block.type === "paragraph" || block.type === "list" ? 8 : 12;
    options.onProgress?.(((index + 1) / blocks.length) * 100);
  });

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
