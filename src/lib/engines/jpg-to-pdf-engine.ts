import type { PDFDocument as PdfLibDocument } from "pdf-lib";

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
export interface ImagePdfInfo {
  format: "jpeg" | "png";
  width: number;
  height: number;
  orientation: number;
  displayWidth: number;
  displayHeight: number;
}
export const IMAGE_PDF_LIMITS = {
  files: 30,
  fileBytes: 100 * 1024 * 1024,
  totalBytes: 200 * 1024 * 1024,
  pixels: 40_000_000,
  totalPixels: 100_000_000,
  side: 16_384,
  outputBytes: 200 * 1024 * 1024,
};
const A4: [number, number] = [595.28, 841.89],
  LETTER: [number, number] = [612, 792];

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function pngChecksum(bytes: Uint8Array, start: number, end: number) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++)
    crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Read only the bounded TIFF IFD0 orientation field, never GPS or other metadata.
function exifOrientation(data: Uint8Array) {
  if (data.length < 8)
    throw new Error("The image has a damaged orientation header.");
  const little = data[0] === 73 && data[1] === 73;
  if (!little && !(data[0] === 77 && data[1] === 77))
    throw new Error("The image has an invalid orientation header.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint16(2, little) !== 42)
    throw new Error("The image has an invalid orientation header.");
  const offset = view.getUint32(4, little);
  if (offset < 8 || offset + 2 > data.length)
    throw new Error("The image has a damaged orientation header.");
  const count = view.getUint16(offset, little);
  if (count > 4096 || offset + 2 + count * 12 > data.length)
    throw new Error("The image has a damaged orientation header.");
  for (let i = 0; i < count; i++) {
    const at = offset + 2 + i * 12;
    if (view.getUint16(at, little) !== 0x112) continue;
    if (
      view.getUint16(at + 2, little) !== 3 ||
      view.getUint32(at + 4, little) !== 1
    )
      throw new Error("The image has an invalid orientation value.");
    const value = view.getUint16(at + 8, little);
    if (value < 1 || value > 8)
      throw new Error("The image has an invalid orientation value.");
    return value;
  }
  return 1;
}

export function inspectImagePdfBytes(bytes: Uint8Array): ImagePdfInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: ImagePdfInfo["format"],
    width = 0,
    height = 0,
    orientation = 1;
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  ) {
    format = "png";
    let at = 8,
      chunks = 0,
      ended = false,
      pixels = false;
    while (at + 12 <= bytes.length) {
      if (++chunks > 10000)
        throw new Error("This PNG has too many data chunks.");
      const length = view.getUint32(at),
        type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (at + 12 + length > bytes.length)
        throw new Error("The PNG file is truncated.");
      if (
        pngChecksum(bytes, at + 4, at + 8 + length) !==
        view.getUint32(at + 8 + length)
      )
        throw new Error("The PNG has damaged data (checksum mismatch).");
      if (at === 8 && (type !== "IHDR" || length !== 13))
        throw new Error("The PNG header is invalid.");
      if (type === "IHDR") {
        if (at !== 8) throw new Error("The PNG has conflicting headers.");
        width = view.getUint32(at + 8);
        height = view.getUint32(at + 12);
      }
      if (type === "eXIf")
        orientation = exifOrientation(bytes.subarray(at + 8, at + 8 + length));
      if (type === "acTL")
        throw new Error(
          "Animated PNG is not supported. Save a still JPG or PNG first.",
        );
      if (type === "IDAT") pixels = true;
      if (type === "IEND") {
        ended = length === 0;
        break;
      }
      at += length + 12;
    }
    if (!ended || !pixels) throw new Error("The PNG is incomplete or damaged.");
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    format = "jpeg";
    let at = 2,
      scanned = false,
      segments = 0;
    while (at + 1 < bytes.length) {
      if (++segments > 10000)
        throw new Error("This JPEG has too many header segments.");
      if (bytes[at++] !== 255) throw new Error("The JPEG header is damaged.");
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xda) {
        scanned = true;
        break;
      }
      if (marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (at + 2 > bytes.length) throw new Error("The JPEG is truncated.");
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length)
        throw new Error("The JPEG is truncated.");
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || view.getUint8(at + 2) !== 8)
          throw new Error("Use an 8-bit JPG or PNG image.");
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
      }
      if (
        marker === 0xe1 &&
        length >= 8 &&
        [69, 120, 105, 102, 0, 0].every((n, i) => bytes[at + 2 + i] === n)
      )
        orientation = exifOrientation(bytes.subarray(at + 8, at + length));
      at += length;
    }
    let end = bytes.length - 1;
    while (end > 1 && bytes[end] === 0) end--;
    if (!scanned || bytes[end - 1] !== 255 || bytes[end] !== 217)
      throw new Error("The JPEG is incomplete or damaged.");
  } else
    throw new Error(
      "Choose a real JPG or PNG image; renaming another file does not convert it.",
    );
  if (!width || !height)
    throw new Error("The image dimensions could not be read.");
  if (
    width > IMAGE_PDF_LIMITS.side ||
    height > IMAGE_PDF_LIMITS.side ||
    width * height > IMAGE_PDF_LIMITS.pixels
  )
    throw new Error(
      "Use images up to 40 megapixels and 16,384 pixels per side.",
    );
  return {
    format,
    width,
    height,
    orientation,
    displayWidth: orientation >= 5 ? height : width,
    displayHeight: orientation >= 5 ? width : height,
  };
}

export async function inspectImagePdfFile(file: File) {
  if (!file.size || file.size > IMAGE_PDF_LIMITS.fileBytes)
    throw new Error("Choose a nonempty image up to 100MB.");
  return inspectImagePdfBytes(new Uint8Array(await file.arrayBuffer()));
}

export function imagePdfLayout(
  width: number,
  height: number,
  rotation: ImagePdfInput["rotation"],
  options: ImagePdfOptions,
) {
  const [rw, rh] =
    rotation === 90 || rotation === 270 ? [height, width] : [width, height];
  const orientation =
    options.orientation === "auto"
      ? rw > rh
        ? "landscape"
        : "portrait"
      : options.orientation;
  let [pw, ph] =
    options.pageSize === "a4"
      ? A4
      : options.pageSize === "letter"
        ? LETTER
        : [rw * 0.75, rh * 0.75];
  if (orientation === "portrait")
    [pw, ph] = [Math.min(pw, ph), Math.max(pw, ph)];
  else [pw, ph] = [Math.max(pw, ph), Math.min(pw, ph)];
  pw = Math.max(1, pw);
  ph = Math.max(1, ph);
  const margin =
    options.margin === "none"
      ? 0
      : Math.min(
          options.margin === "small" ? 28.35 : 56.7,
          Math.min(pw, ph) * 0.16,
        );
  const scale = Math.min((pw - margin * 2) / rw, (ph - margin * 2) / rh);
  return {
    pageWidth: pw,
    pageHeight: ph,
    width: rw * scale,
    height: rh * scale,
    left: (pw - rw * scale) / 2,
    bottom: (ph - rh * scale) / 2,
    margin,
  };
}

function mappedPoint(x: number, y: number, exif: number, rotation: number) {
  // Input/output PDF coordinates are bottom-left; EXIF is defined top-left.
  let a = x,
    b = 1 - y;
  switch (exif) {
    case 2:
      a = 1 - x;
      break;
    case 3:
      a = 1 - x;
      b = y;
      break;
    case 4:
      b = y;
      break;
    case 5:
      a = 1 - y;
      b = x;
      break;
    case 6:
      a = y;
      b = x;
      break;
    case 7:
      a = y;
      b = 1 - x;
      break;
    case 8:
      a = 1 - y;
      b = 1 - x;
      break;
  }
  if (rotation === 90) [a, b] = [1 - b, a];
  else if (rotation === 180) [a, b] = [1 - a, 1 - b];
  else if (rotation === 270) [a, b] = [b, 1 - a];
  return [a, 1 - b];
}
function safePdfName(filename: string) {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return `${base || "image"}.pdf`;
}
export async function createImagePdf(
  inputs: ImagePdfInput[],
  options: ImagePdfOptions,
  setProgress: (value: number) => void,
  isCancelled: () => boolean,
): Promise<ImagePdfResult | null> {
  if (isCancelled()) return null;
  if (!inputs.length || inputs.length > IMAGE_PDF_LIMITS.files)
    throw new Error("Choose between 1 and 30 images.");
  if (
    !["auto", "portrait", "landscape"].includes(options.orientation) ||
    !["fit", "a4", "letter"].includes(options.pageSize) ||
    !["none", "small", "big"].includes(options.margin) ||
    typeof options.merge !== "boolean" ||
    inputs.some((i) => ![0, 90, 180, 270].includes(i.rotation))
  )
    throw new Error("Choose valid page options and rotation.");
  if (inputs.reduce((s, i) => s + i.file.size, 0) > IMAGE_PDF_LIMITS.totalBytes)
    throw new Error("Choose images with a combined size up to 200MB.");
  const {
    PDFDocument,
    pushGraphicsState,
    popGraphicsState,
    concatTransformationMatrix,
  } = await import("pdf-lib");
  if (isCancelled()) return null;
  const combined = options.merge || inputs.length === 1;
  let pdf = await PDFDocument.create(),
    totalPixels = 0,
    outputBytes = 0;
  const files: Record<string, Uint8Array> = Object.create(null),
    usedNames = new Set<string>();
  const yieldTask = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));
  const addPage = async (doc: PdfLibDocument, input: ImagePdfInput) => {
    if (!input.file.size || input.file.size > IMAGE_PDF_LIMITS.fileBytes)
      throw new Error("Choose a nonempty image up to 100MB.");
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    if (isCancelled()) return;
    const info = inspectImagePdfBytes(bytes);
    totalPixels += info.width * info.height;
    if (totalPixels > IMAGE_PDF_LIMITS.totalPixels)
      throw new Error("Choose images with up to 100 megapixels combined.");
    // A header alone cannot establish that a JPEG's compressed pixels decode.
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(
        new Blob([bytes as BlobPart], {
          type: info.format === "png" ? "image/png" : "image/jpeg",
        }),
      );
      bitmap.close();
    }
    if (isCancelled()) return;
    const image =
      info.format === "png"
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    if (isCancelled()) return;
    const box = imagePdfLayout(
        info.displayWidth,
        info.displayHeight,
        input.rotation,
        options,
      ),
      p0 = mappedPoint(0, 0, info.orientation, input.rotation),
      px = mappedPoint(1, 0, info.orientation, input.rotation),
      py = mappedPoint(0, 1, info.orientation, input.rotation);
    const page = doc.addPage([box.pageWidth, box.pageHeight]);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(
        (px[0] - p0[0]) * box.width,
        (px[1] - p0[1]) * box.height,
        (py[0] - p0[0]) * box.width,
        (py[1] - p0[1]) * box.height,
        box.left + p0[0] * box.width,
        box.bottom + p0[1] * box.height,
      ),
    );
    page.drawImage(image, { x: 0, y: 0, width: 1, height: 1 });
    page.pushOperators(popGraphicsState());
    await image.embed(); // Release decoded PNG pixels before the next image.
  };
  for (let index = 0; index < inputs.length; index++) {
    await yieldTask();
    if (isCancelled()) return null;
    try {
      await addPage(pdf, inputs[index]);
    } catch (error) {
      throw new Error(
        `${inputs[index].file.name.slice(0, 100)}: ${error instanceof Error ? error.message : "The image could not be read."}`,
      );
    }
    if (isCancelled()) return null;
    if (!combined) {
      const bytes = await pdf.save({ useObjectStreams: true });
      if (isCancelled()) return null;
      outputBytes += bytes.byteLength;
      if (outputBytes > IMAGE_PDF_LIMITS.outputBytes)
        throw new Error(
          "The PDFs exceed 200MB. Convert fewer images at a time.",
        );
      const preferred = safePdfName(inputs[index].file.name);
      let name = preferred,
        suffix = 2;
      while (usedNames.has(name.toLocaleLowerCase()))
        name = preferred.replace(/\.pdf$/, `-${suffix++}.pdf`);
      usedNames.add(name.toLocaleLowerCase());
      files[name] = bytes;
      pdf = await PDFDocument.create();
    }
    setProgress(((index + 1) / inputs.length) * 90);
  }
  await yieldTask();
  if (isCancelled()) return null;
  let bytes: Uint8Array;
  if (combined) bytes = await pdf.save({ useObjectStreams: true });
  else {
    const { zipSync } = await import("fflate");
    if (isCancelled()) return null;
    bytes = zipSync(files, { level: 0 });
  }
  if (isCancelled()) return null;
  if (bytes.byteLength > IMAGE_PDF_LIMITS.outputBytes)
    throw new Error(
      "The download exceeds 200MB. Convert fewer images at a time.",
    );
  setProgress(100);
  if (isCancelled()) return null;
  return {
    blob: new Blob([bytes as BlobPart], {
      type: combined ? "application/pdf" : "application/zip",
    }),
    filename: combined ? "images-to-pdf.pdf" : "jpg-to-pdf-files.zip",
    outputCount: combined ? 1 : inputs.length,
  };
}
