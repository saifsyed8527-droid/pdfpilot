import { createEditorTextWriter } from "../editor/text-replacement";
import { assertNotCancelled, drawInVisualSpace, validatePageRange } from "./pdf-visual-page";

export type WatermarkMode = "text" | "image";
export type WatermarkFontFamily = "helvetica" | "times" | "courier";
export type WatermarkTransparency = 100 | 75 | 50 | 25;
export type WatermarkRotation = 0 | 45 | 90 | 180 | 270;
export type WatermarkLayer = "over" | "below";

/** Row-major 3x3 grid index: 0=top-left … 4=middle-center … 8=bottom-right. */
export type WatermarkPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface WatermarkSettings {
  mode: WatermarkMode;
  text: string;
  fontFamily: WatermarkFontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  position: WatermarkPosition;
  mosaic: boolean;
  transparency: WatermarkTransparency;
  rotation: WatermarkRotation;
  fromPage: number;
  toPage: number;
  layer: WatermarkLayer;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return { r: Number.isFinite(r) ? r : 0, g: Number.isFinite(g) ? g : 0, b: Number.isFinite(b) ? b : 0 };
}

/** Centered anchor point for one grid cell (0-8) within a page, inset by `margin`. */
export function positionCenter(position: WatermarkPosition, pageWidth: number, pageHeight: number, margin: number) {
  const row = Math.floor(position / 3);
  const col = position % 3;
  const cx = col === 0 ? margin : col === 2 ? pageWidth - margin : pageWidth / 2;
  const cy = row === 0 ? pageHeight - margin : row === 2 ? margin : pageHeight / 2;
  return { cx, cy };
}

/** pdf-lib rotates drawText/drawImage around the (x,y) placement point (the
 *  shape's own local origin), not its visual center. Solving for the (x,y)
 *  that keeps a given center fixed under rotation keeps the watermark
 *  anchored where the user picked it, at any rotation angle. */
export function anchorForCenteredRotation(cx: number, cy: number, w: number, h: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const offsetX = (w / 2) * cos - (h / 2) * sin;
  const offsetY = (w / 2) * sin + (h / 2) * cos;
  return { x: cx - offsetX, y: cy - offsetY };
}

/** Evenly spaced mosaic tile centers across the page (3 columns, matching
 *  the verified reference's repeating pattern, with rows spaced the same
 *  as columns so tiles read as a even grid regardless of page shape). */
export function mosaicCenters(pageWidth: number, pageHeight: number): { cx: number; cy: number }[] {
  const cols = 3;
  const colSpacing = pageWidth / cols;
  const rows = Math.max(2, Math.round(pageHeight / colSpacing));
  const rowSpacing = pageHeight / rows;
  const centers: { cx: number; cy: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      centers.push({ cx: colSpacing * (col + 0.5), cy: rowSpacing * (row + 0.5) });
    }
  }
  return centers;
}

export interface WatermarkFontSet {
  regular: import("pdf-lib").PDFFont;
  bold: import("pdf-lib").PDFFont;
  italic: import("pdf-lib").PDFFont;
  boldItalic: import("pdf-lib").PDFFont;
}

export async function embedWatermarkFonts(pdf: import("pdf-lib").PDFDocument, family: WatermarkFontFamily): Promise<WatermarkFontSet> {
  const { StandardFonts } = await import("pdf-lib");
  const map: Record<WatermarkFontFamily, [keyof typeof StandardFonts, keyof typeof StandardFonts, keyof typeof StandardFonts, keyof typeof StandardFonts]> = {
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

export function pickWatermarkFont(fonts: WatermarkFontSet, bold: boolean, italic: boolean) {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

/** Runs `draw` with the page's existing content temporarily detached, so
 *  anything `draw` renders via the normal high-level drawText/drawImage
 *  APIs (fonts, images, graphics state all handled correctly by pdf-lib
 *  itself) lands in a brand-new content stream — then re-attaches the
 *  original content stream(s) *after* it, so the original page content
 *  paints on top of (visually above) the watermark. This is a genuine
 *  content-stream reordering, not a transparency trick. */
async function drawBelowOriginalContent(pdf: import("pdf-lib").PDFDocument, page: import("pdf-lib").PDFPage, draw: () => Promise<void>) {
  const { PDFName, PDFArray } = await import("pdf-lib");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf-lib's PDFPageLeaf dict accessors aren't part of the narrow public PDFPage type, but are documented, stable methods on the page's own node
  const node = page.node as any;
  const originalContents = node.get(PDFName.of("Contents"));
  node.set(PDFName.of("Contents"), pdf.context.obj([]));

  await draw();

  const watermarkContents = node.get(PDFName.of("Contents"));
  if (watermarkContents instanceof PDFArray) {
    if (originalContents instanceof PDFArray) {
      for (let i = 0; i < originalContents.size(); i++) watermarkContents.push(originalContents.get(i));
    } else if (originalContents) {
      watermarkContents.push(originalContents);
    }
  }
}

export interface AddWatermarkResult {
  blob: Blob;
  pageCount: number;
}

export async function addWatermarkToPdf(
  file: File,
  settings: WatermarkSettings,
  watermarkImageFile: File | null,
  onProgress?: (percent: number) => void,
  isCancelled?: () => boolean
): Promise<AddWatermarkResult> {
  assertNotCancelled(isCancelled);
  if (!Number.isFinite(settings.fontSize) || settings.fontSize < 4 || settings.fontSize > 300) throw new Error("Choose a font size between 4 and 300.");
  const { PDFDocument, degrees, rgb } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const totalPages = pages.length;

  const { fromPage, toPage } = settings;
  validatePageRange(fromPage, toPage, totalPages);
  const opacity = settings.transparency / 100;
  let writer: Awaited<ReturnType<typeof createEditorTextWriter>> | null = null;
  const text = settings.text.replace(/[\r\n\t]/g, " ");
  let embeddedImage: import("pdf-lib").PDFImage | null = null;

  if (settings.mode === "text") {
    if (!settings.text.trim()) throw new Error("Enter watermark text before continuing.");
    const fonts = await embedWatermarkFonts(pdf, settings.fontFamily);
    writer = await createEditorTextWriter(pdf, { normal: fonts.regular, ...fonts }, text);
  } else {
    if (!watermarkImageFile) throw new Error("Choose a watermark image before continuing.");
    const imgBytes = await watermarkImageFile.arrayBuffer();
    const signature = new Uint8Array(imgBytes);
    embeddedImage = signature[0] === 137 && signature[1] === 80 ? await pdf.embedPng(imgBytes) : await pdf.embedJpg(imgBytes);
  }

  const { r, g, b } = hexToRgb01(settings.color);

  for (let index = 0; index < pages.length; index++) {
    assertNotCancelled(isCancelled);
    if (index + 1 >= fromPage && index + 1 <= toPage) {
      const page = pages[index];
      const draw = () => drawInVisualSpace(page, async (width, height) => {
        const naturalWidth = writer ? writer.width(text, settings.fontSize, settings.bold, settings.italic) : width * 0.3;
        const naturalHeight = writer ? settings.fontSize : naturalWidth * embeddedImage!.height / embeddedImage!.width;
        const layout = watermarkLayout(settings, width, height, naturalWidth, naturalHeight);
        for (const { cx, cy } of layout.centers) {
          const { x, y } = anchorForCenteredRotation(cx, cy, layout.width, layout.height, settings.rotation);
          if (writer) {
            const size = settings.fontSize * layout.scale;
            await writer.drawLine(page, text, x, y, size, settings.rotation, settings.color, settings.bold, settings.italic, opacity);
            if (settings.underline) drawUnderline(page, x, y, layout.width, size, settings.rotation, rgb(r, g, b), opacity);
          } else if (embeddedImage) {
            page.drawImage(embeddedImage, { x, y, width: layout.width, height: layout.height, opacity, rotate: degrees(settings.rotation) });
          }
        }
      });
      if (settings.layer === "below") await drawBelowOriginalContent(pdf, page, draw);
      else await draw();
    }
    onProgress?.(((index + 1) / totalPages) * 95);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  assertNotCancelled(isCancelled);
  writer?.finish();
  const pdfBytes = await pdf.save();
  assertNotCancelled(isCancelled);
  onProgress?.(100);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  return { blob, pageCount: totalPages };
}

function drawUnderline(
  page: import("pdf-lib").PDFPage,
  x: number,
  y: number,
  textWidth: number,
  fontSize: number,
  rotationDeg: number,
  color: import("pdf-lib").Color,
  opacity: number
) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const offset = -fontSize * 0.12;
  const startX = x + offset * -sin;
  const startY = y + offset * cos;
  const endX = startX + textWidth * cos;
  const endY = startY + textWidth * sin;
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness: Math.max(0.5, fontSize / 16),
    color,
    opacity,
  });
}

/** Fit the entire rotated mark within the visible page (or one mosaic cell). */
export function watermarkLayout(settings: Pick<WatermarkSettings, "rotation" | "mosaic" | "position">, pageWidth: number, pageHeight: number, naturalWidth: number, naturalHeight: number) {
  const angle = settings.rotation * Math.PI / 180, cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const boundWidth = naturalWidth * cos + naturalHeight * sin;
  const boundHeight = naturalWidth * sin + naturalHeight * cos;
  const margin = Math.min(36, pageWidth / 10, pageHeight / 10);
  const centers = settings.mosaic ? mosaicCenters(pageWidth, pageHeight) : [positionCenter(settings.position, pageWidth, pageHeight, margin)];
  const rows = settings.mosaic ? centers.length / 3 : 1;
  const availableWidth = settings.mosaic ? pageWidth / 3 * 0.85 : pageWidth - 2 * margin;
  const availableHeight = settings.mosaic ? pageHeight / rows * 0.85 : pageHeight - 2 * margin;
  const scale = Math.min(1, availableWidth / Math.max(1, boundWidth), availableHeight / Math.max(1, boundHeight));
  if (!settings.mosaic) {
    const halfWidth = boundWidth * scale / 2, halfHeight = boundHeight * scale / 2;
    centers[0].cx = Math.max(margin + halfWidth, Math.min(pageWidth - margin - halfWidth, centers[0].cx));
    centers[0].cy = Math.max(margin + halfHeight, Math.min(pageHeight - margin - halfHeight, centers[0].cy));
  }
  return { centers, width: naturalWidth * scale, height: naturalHeight * scale, scale };
}
