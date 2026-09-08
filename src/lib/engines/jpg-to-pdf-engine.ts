export type ImagePageOrientation = "auto" | "portrait" | "landscape";
export type ImagePageSize = "fit" | "a4" | "letter";
export type ImagePageMargin = "none" | "small" | "big";

export interface ImagePdfInput {
  file: File;
  rotation: 0 | 90 | 180 | 270;
}

export interface ImagePdfOptions {
  orientation: ImagePageOrientation;
  pageSize: ImagePageSize;
  margin: ImagePageMargin;
  merge: boolean;
}

export interface ImagePdfResult {
  blob: Blob;
  filename: string;
  outputCount: number;
}

type ProgressCallback = (value: number) => void;
type CancelCallback = () => boolean;

const A4: [number, number] = [595.28, 841.89];
const LETTER: [number, number] = [612, 792];
const MAX_PDF_PAGE_POINTS = 14_400;

function isPng(file: File) {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

function orientPage(
  dimensions: [number, number],
  orientation: ImagePageOrientation
): [number, number] {
  const [width, height] = dimensions;
  if (orientation === "auto") return [width, height];
  if (orientation === "landscape") return [Math.max(width, height), Math.min(width, height)];
  return [Math.min(width, height), Math.max(width, height)];
}

function fitPage(
  width: number,
  height: number,
  rotation: ImagePdfInput["rotation"],
  orientation: ImagePageOrientation
): [number, number] {
  const rotated = rotation === 90 || rotation === 270;
  const sourceWidth = (rotated ? height : width) * 0.75;
  const sourceHeight = (rotated ? width : height) * 0.75;
  const longestSide = Math.max(sourceWidth, sourceHeight);
  const scale = longestSide > MAX_PDF_PAGE_POINTS ? MAX_PDF_PAGE_POINTS / longestSide : 1;
  return orientPage(
    [Math.max(1, sourceWidth * scale), Math.max(1, sourceHeight * scale)],
    orientation
  );
}

function pageDimensions(
  image: { width: number; height: number },
  input: ImagePdfInput,
  options: ImagePdfOptions
): [number, number] {
  const quarterTurn = input.rotation === 90 || input.rotation === 270;
  const renderedWidth = quarterTurn ? image.height : image.width;
  const renderedHeight = quarterTurn ? image.width : image.height;
  const fixedOrientation = options.orientation === "auto"
    ? (renderedWidth > renderedHeight ? "landscape" : "portrait")
    : options.orientation;
  if (options.pageSize === "a4") return orientPage(A4, fixedOrientation);
  if (options.pageSize === "letter") return orientPage(LETTER, fixedOrientation);
  return fitPage(image.width, image.height, input.rotation, options.orientation);
}

function marginPoints(pageWidth: number, pageHeight: number, margin: ImagePageMargin) {
  if (margin === "none") return 0;
  const preferred = margin === "small" ? 28.35 : 56.7;
  return Math.min(preferred, Math.min(pageWidth, pageHeight) * 0.16);
}

function drawPlacement(
  image: { width: number; height: number },
  pageWidth: number,
  pageHeight: number,
  margin: number,
  rotation: ImagePdfInput["rotation"]
) {
  const isQuarterTurn = rotation === 90 || rotation === 270;
  const rotatedWidth = isQuarterTurn ? image.height : image.width;
  const rotatedHeight = isQuarterTurn ? image.width : image.height;
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(availableWidth / rotatedWidth, availableHeight / rotatedHeight);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const boxWidth = isQuarterTurn ? drawHeight : drawWidth;
  const boxHeight = isQuarterTurn ? drawWidth : drawHeight;
  const left = margin + (availableWidth - boxWidth) / 2;
  const bottom = margin + (availableHeight - boxHeight) / 2;

  // CSS rotates clockwise. PDF coordinates rotate counter-clockwise, so the
  // quarter turns below intentionally use the inverse PDF angle.
  if (rotation === 90) {
    return { x: left, y: bottom + drawWidth, width: drawWidth, height: drawHeight, pdfRotation: 270 };
  }
  if (rotation === 180) {
    return {
      x: left + drawWidth,
      y: bottom + drawHeight,
      width: drawWidth,
      height: drawHeight,
      pdfRotation: 180,
    };
  }
  if (rotation === 270) {
    return { x: left + drawHeight, y: bottom, width: drawWidth, height: drawHeight, pdfRotation: 90 };
  }
  return { x: left, y: bottom, width: drawWidth, height: drawHeight, pdfRotation: 0 };
}

function safePdfName(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${base || "image"}.pdf`;
}

export async function createImagePdf(
  inputs: ImagePdfInput[],
  options: ImagePdfOptions,
  setProgress: ProgressCallback,
  isCancelled: CancelCallback
): Promise<ImagePdfResult | null> {
  const { PDFDocument, degrees } = await import("pdf-lib");

  const addImagePage = async (
    pdfDoc: PdfLibDocument,
    input: ImagePdfInput,
    bytes: ArrayBuffer
  ) => {
    const image = isPng(input.file)
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const [pageWidth, pageHeight] = pageDimensions(image, input, options);
    const margin = marginPoints(pageWidth, pageHeight, options.margin);
    const placement = drawPlacement(image, pageWidth, pageHeight, margin, input.rotation);
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotate: degrees(placement.pdfRotation),
    });
  };

  if (options.merge || inputs.length === 1) {
    const pdfDoc = await PDFDocument.create();
    let loaded = 0;
    const buffers = await Promise.all(
      inputs.map(async ({ file }) => {
        const bytes = await file.arrayBuffer();
        loaded += 1;
        setProgress((loaded / inputs.length) * 35);
        return bytes;
      })
    );

    for (let index = 0; index < inputs.length; index += 1) {
      if (isCancelled()) return null;
      await addImagePage(pdfDoc, inputs[index], buffers[index]);
      setProgress(35 + ((index + 1) / inputs.length) * 50);
    }

    if (isCancelled()) return null;
    setProgress(90);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    setProgress(100);
    return {
      blob: new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" }),
      filename: "images-to-pdf.pdf",
      outputCount: 1,
    };
  }

  const files: Record<string, Uint8Array> = {};
  const usedNames = new Map<string, number>();

  for (let index = 0; index < inputs.length; index += 1) {
    if (isCancelled()) return null;
    const input = inputs[index];
    const pdfDoc = await PDFDocument.create();
    const bytes = await input.file.arrayBuffer();
    await addImagePage(pdfDoc, input, bytes);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const preferredName = safePdfName(input.file.name);
    const seen = usedNames.get(preferredName) ?? 0;
    usedNames.set(preferredName, seen + 1);
    const outputName = seen === 0 ? preferredName : preferredName.replace(/\.pdf$/, `-${seen + 1}.pdf`);
    files[outputName] = pdfBytes;
    setProgress(((index + 1) / inputs.length) * 90);
  }

  if (isCancelled()) return null;
  const { zipSync } = await import("fflate");
  const archive = zipSync(files, { level: 0 });
  setProgress(100);
  return {
    blob: new Blob([archive as unknown as BlobPart], { type: "application/zip" }),
    filename: "jpg-to-pdf-files.zip",
    outputCount: inputs.length,
  };
}
import type { PDFDocument as PdfLibDocument } from "pdf-lib";
