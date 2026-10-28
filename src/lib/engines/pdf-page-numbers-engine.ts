import { createEditorTextWriter } from "../editor/text-replacement";
import { assertNotCancelled, drawInVisualSpace, validatePageRange } from "./pdf-visual-page";

export type PageMode = "single" | "facing";
export type PageNumberMargin = "small" | "recommended" | "big";
export type TextFormatPreset = "number" | "page-n" | "page-n-of-p" | "custom";
export type PageNumberFontFamily = "helvetica" | "times" | "courier";

/** Row-major 3x3 grid index: 0=top-left … 4=middle-center … 8=bottom-right. */
export type PagePosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface PageNumberSettings {
  pageMode: PageMode;
  firstPageCover: boolean;
  position: PagePosition;
  margin: PageNumberMargin;
  firstNumber: number;
  fromPage: number;
  toPage: number;
  textFormat: TextFormatPreset;
  customText: string;
  fontFamily: PageNumberFontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

export const MARGIN_POINTS: Record<PageNumberMargin, number> = {
  small: 16,
  recommended: 28,
  big: 44,
};

export function formatPageLabel(settings: PageNumberSettings, n: number, totalPages: number): string {
  switch (settings.textFormat) {
    case "number":
      return `${n}`;
    case "page-n":
      return `Page ${n}`;
    case "page-n-of-p":
      return `Page ${n} of ${totalPages}`;
    case "custom":
      return (settings.customText || "{n}").replace(/\{n\}/g, `${n}`).replace(/\{p\}/g, `${totalPages}`);
  }
}

/** Whether `pageIndex0` (0-based) is the "left" (verso) side of a facing-page
 *  spread — used to mirror the chosen position so the number always sits at
 *  the spread's outer edge, matching standard book-layout numbering. */
export function isLeftPageOfSpread(pageIndex0: number, firstPageCover: boolean): boolean {
  const offset = firstPageCover ? pageIndex0 - 1 : pageIndex0;
  if (offset < 0) return false; // the cover page itself: not mirrored
  return offset % 2 === 0;
}

/** Mirrors a position's column (left<->right) for the left page of a facing
 *  spread, so the number lands on the spread's outer edge. */
export function mirroredPosition(position: PagePosition, mirror: boolean): PagePosition {
  if (!mirror) return position;
  const row = Math.floor(position / 3);
  const col = position % 3;
  const mirroredCol = col === 0 ? 2 : col === 2 ? 0 : 1;
  return (row * 3 + mirroredCol) as PagePosition;
}

function positionToXY(position: PagePosition, pageWidth: number, pageHeight: number, margin: number, textWidth: number, textHeight: number) {
  const row = Math.floor(position / 3);
  const col = position % 3;
  const x = col === 0 ? margin : col === 2 ? pageWidth - margin - textWidth : (pageWidth - textWidth) / 2;
  const y = row === 0 ? pageHeight - margin - textHeight : row === 2 ? margin : (pageHeight - textHeight) / 2;
  return { x, y };
}

export interface PageNumberFontSet {
  regular: import("pdf-lib").PDFFont;
  bold: import("pdf-lib").PDFFont;
  italic: import("pdf-lib").PDFFont;
  boldItalic: import("pdf-lib").PDFFont;
}

export async function embedPageNumberFonts(
  pdf: import("pdf-lib").PDFDocument,
  family: PageNumberFontFamily
): Promise<PageNumberFontSet> {
  const { StandardFonts } = await import("pdf-lib");
  const map: Record<PageNumberFontFamily, [keyof typeof StandardFonts, keyof typeof StandardFonts, keyof typeof StandardFonts, keyof typeof StandardFonts]> = {
    helvetica: ["Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique"],
    times: ["TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic"],
    courier: ["Courier", "CourierBold", "CourierOblique", "CourierBoldOblique"],
  };
  const [regularName, boldName, italicName, boldItalicName] = map[family];
  const [regular, bold, italic, boldItalic] = await Promise.all([
    pdf.embedFont(StandardFonts[regularName]),
    pdf.embedFont(StandardFonts[boldName]),
    pdf.embedFont(StandardFonts[italicName]),
    pdf.embedFont(StandardFonts[boldItalicName]),
  ]);
  return { regular, bold, italic, boldItalic };
}

export function pickFont(fonts: PageNumberFontSet, bold: boolean, italic: boolean) {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return { r: Number.isFinite(r) ? r : 0, g: Number.isFinite(g) ? g : 0, b: Number.isFinite(b) ? b : 0 };
}

export interface AddPageNumbersResult {
  blob: Blob;
  pageCount: number;
}

export async function addPageNumbersToPdf(
  file: File,
  settings: PageNumberSettings,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean
): Promise<AddPageNumbersResult> {
  assertNotCancelled(isCancelled);
  if (!Number.isFinite(settings.fontSize) || settings.fontSize < 4 || settings.fontSize > 144) throw new Error("Choose a font size between 4 and 144.");
  if (!Number.isInteger(settings.firstNumber)) throw new Error("Enter a whole starting number.");
  const { PDFDocument, rgb } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const totalPages = pages.length;

  const { fromPage, toPage } = settings;
  validatePageRange(fromPage, toPage, totalPages);

  const fonts = await embedPageNumberFonts(pdf, settings.fontFamily);
  const writer = await createEditorTextWriter(pdf, { normal: fonts.regular, ...fonts }, formatPageLabel(settings, settings.firstNumber, totalPages));
  const { r, g, b } = hexToRgb01(settings.color);
  const margin = MARGIN_POINTS[settings.margin];

  let running = settings.firstNumber;
  for (let index = 0; index < pages.length; index++) {
    assertNotCancelled(isCancelled);
    if (index + 1 >= fromPage && index + 1 <= toPage) {
      const page = pages[index];
      const label = formatPageLabel(settings, running, totalPages).replace(/[\r\n\t]/g, " ");
      await drawInVisualSpace(page, async (width, height) => {
        const textWidth = writer.width(label, settings.fontSize, settings.bold, settings.italic);
        if (textWidth > width - margin * 2 || settings.fontSize > height - margin * 2) {
          throw new Error("The page label does not fit. Use a shorter label, smaller font or smaller margin.");
        }
        const mirror = settings.pageMode === "facing" && isLeftPageOfSpread(index, settings.firstPageCover);
        const position = mirroredPosition(settings.position, mirror);
        const { x, y } = positionToXY(position, width, height, margin, textWidth, settings.fontSize);
        await writer.drawLine(page, label, x, y, settings.fontSize, 0, settings.color, settings.bold, settings.italic);
        if (settings.underline) page.drawLine({ start: { x, y: y - 1.5 }, end: { x: x + textWidth, y: y - 1.5 }, thickness: Math.max(0.5, settings.fontSize / 16), color: rgb(r, g, b) });
      });
      running++;
    }
    onProgress?.(((index + 1) / totalPages) * 95);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  assertNotCancelled(isCancelled);
  writer.finish();
  const pdfBytes = await pdf.save();
  assertNotCancelled(isCancelled);
  onProgress?.(100);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: totalPages };
}
