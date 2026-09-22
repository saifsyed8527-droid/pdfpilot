/**
 * Watermark engine for the Watermark PDF tool.
 *
 * Font support is deliberately limited to pdf-lib's built-in standard PDF
 * fonts (Helvetica/Times/Courier, each with bold/italic/bold-italic
 * variants) for the same reason documented in pdf-page-numbers-engine.ts:
 * they embed with zero risk and no extra network fetches. Fonts like
 * Impact, Verdana, Comic Sans, Arial Unicode MS, or the Lohit Indic
 * families visible on iLovePDF are not standard PDF fonts and would need
 * bundled TTF/OTF assets this project doesn't ship — see the migration
 * report for that constraint rather than a silently-broken font picker.
 *
 * "Layer: below the PDF content" is a genuine content-stream reordering,
 * not a fake opacity trick — see `drawBelowOriginalContent` below.
 */

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
async function drawBelowOriginalContent(pdf: import("pdf-lib").PDFDocument, page: import("pdf-lib").PDFPage, draw: () => void) {
  const { PDFName, PDFArray } = await import("pdf-lib");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf-lib's PDFPageLeaf dict accessors aren't part of the narrow public PDFPage type, but are documented, stable methods on the page's own node
  const node = page.node as any;
  const originalContents = node.get(PDFName.of("Contents"));
  node.set(PDFName.of("Contents"), pdf.context.obj([]));

  draw();

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
  onProgress?: (percent: number) => void
): Promise<AddWatermarkResult> {
  const { PDFDocument, degrees, rgb } = await import("pdf-lib");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  const totalPages = pages.length;

  const fromPage = Math.max(1, Math.min(settings.fromPage, totalPages));
  const toPage = Math.max(fromPage, Math.min(settings.toPage, totalPages));
  const opacity = settings.transparency / 100;
  const margin = 36;

  let fonts: WatermarkFontSet | null = null;
  let embeddedImage: import("pdf-lib").PDFImage | null = null;

  if (settings.mode === "text") {
    if (!settings.text.trim()) throw new Error("Enter watermark text before continuing.");
    fonts = await embedWatermarkFonts(pdf, settings.fontFamily);
  } else {
    if (!watermarkImageFile) throw new Error("Choose a watermark image before continuing.");
    const imgBytes = await watermarkImageFile.arrayBuffer();
    embeddedImage = watermarkImageFile.type === "image/png" ? await pdf.embedPng(imgBytes) : await pdf.embedJpg(imgBytes);
  }

  const { r, g, b } = hexToRgb01(settings.color);

  for (let index = 0; index < pages.length; index++) {
    const pageNumber1 = index + 1;
    if (pageNumber1 >= fromPage && pageNumber1 <= toPage) {
      const page = pages[index];
      const { width, height } = page.getSize();

      const drawOnce = (cx: number, cy: number) => {
        if (settings.mode === "text" && fonts) {
          const font = pickWatermarkFont(fonts, settings.bold, settings.italic);
          const textWidth = font.widthOfTextAtSize(settings.text, settings.fontSize);
          const textHeight = font.heightAtSize(settings.fontSize);
          const { x, y } = anchorForCenteredRotation(cx, cy, textWidth, textHeight, settings.rotation);
          page.drawText(settings.text, { x, y, size: settings.fontSize, font, color: rgb(r, g, b), opacity, rotate: degrees(settings.rotation) });
          if (settings.underline) {
            drawUnderline(page, x, y, textWidth, settings.fontSize, settings.rotation, rgb(r, g, b), opacity);
          }
        } else if (embeddedImage) {
          const imgWidth = embeddedImage.width * 0.3;
          const imgHeight = embeddedImage.height * 0.3;
          const { x, y } = anchorForCenteredRotation(cx, cy, imgWidth, imgHeight, settings.rotation);
          page.drawImage(embeddedImage, { x, y, width: imgWidth, height: imgHeight, opacity, rotate: degrees(settings.rotation) });
        }
      };

      const draw = () => {
        if (settings.mosaic) {
          for (const { cx, cy } of mosaicCenters(width, height)) drawOnce(cx, cy);
        } else {
          const { cx, cy } = positionCenter(settings.position, width, height, margin);
          drawOnce(cx, cy);
        }
      };

      if (settings.layer === "below") {
        await drawBelowOriginalContent(pdf, page, draw);
      } else {
        draw();
      }
    }
    onProgress?.(((index + 1) / totalPages) * 100);
  }

  const pdfBytes = await pdf.save();
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
