import { loadPdfjs } from "../pdfjs";

export type ImageMode = "pages" | "images";
export type ImageFormat = "jpg" | "png";
export type ImageResolution = 150 | 300;
export const MAX_IMAGE_PIXELS = 24_000_000;
export const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
export type ImageErrorCode = "invalid" | "password" | "large" | "empty" | "canvas" | "cancelled";
export class PdfImageError extends Error {
  constructor(public code: ImageErrorCode) { super(code); }
}
export interface ImageOutput { name: string; bytes: Uint8Array; width: number; height: number }

export function imageDimensions(width: number, height: number, dpi: ImageResolution) {
  const w = Math.ceil(width * dpi / 72), h = Math.ceil(height * dpi / 72);
  assertSize(w, h);
  return { width: w, height: h };
}
function assertSize(w: number, h: number) {
  if (!Number.isFinite(w * h) || w < 1 || h < 1 || w > 16384 || h > 16384 || w * h > MAX_IMAGE_PIXELS) throw new PdfImageError("large");
}
function checkCancelled(cancelled: () => boolean) { if (cancelled()) throw new PdfImageError("cancelled"); }
function canvasFor(width: number, height: number) {
  assertSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PdfImageError("canvas");
  return { canvas, context };
}
async function encode(canvas: HTMLCanvasElement, format: ImageFormat, quality: number) {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, quality));
  if (!blob || blob.type !== mime) throw new PdfImageError("canvas");
  return new Uint8Array(await blob.arrayBuffer());
}
async function open(file: File) {
  const lib = await loadPdfjs();
  // No browser PDF plugin or network upload. Disable decoder resizing for extracted assets.
  const task = lib.getDocument({
    data: await file.arrayBuffer(), isOffscreenCanvasSupported: false, isImageDecoderSupported: false,
    cMapUrl: "/pdfjs-assets/cmaps/", cMapPacked: true,
    standardFontDataUrl: "/pdfjs-assets/standard_fonts/", wasmUrl: "/pdfjs-assets/wasm/",
    stopAtErrors: true,
  });
  try { return { lib, task, pdf: await task.promise }; }
  catch (error) {
    await task.destroy();
    throw new PdfImageError(error instanceof Error && error.name === "PasswordException" ? "password" : "invalid");
  }
}

export async function pdfImageThumbnail(file: File) {
  const { pdf, task } = await open(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    const page = await pdf.getPage(1), original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 260 / Math.max(original.width, original.height) });
    const surface = canvasFor(Math.ceil(viewport.width), Math.ceil(viewport.height)); canvas = surface.canvas;
    await page.render({ canvas, viewport, background: "#ffffff" }).promise;
    return { url: canvas.toDataURL("image/png"), pages: pdf.numPages };
  } finally { if (canvas) canvas.width = canvas.height = 1; await task.destroy(); }
}

type DecodedImage = { width: number; height: number; kind?: number; data?: Uint8Array | Uint8ClampedArray; bitmap?: ImageBitmap };
function drawDecoded(image: DecodedImage, kinds: { GRAYSCALE_1BPP: number; RGB_24BPP: number; RGBA_32BPP: number }) {
  const { canvas, context } = canvasFor(image.width, image.height);
  if (image.bitmap) { context.drawImage(image.bitmap, 0, 0); return canvas; }
  if (!image.data) throw new PdfImageError("invalid");
  const rgba = context.createImageData(image.width, image.height), input = image.data;
  if (image.kind === kinds.RGBA_32BPP) rgba.data.set(input);
  else if (image.kind === kinds.RGB_24BPP) {
    for (let i = 0, j = 0; i < input.length; i += 3, j += 4) { rgba.data[j] = input[i]; rgba.data[j + 1] = input[i + 1]; rgba.data[j + 2] = input[i + 2]; rgba.data[j + 3] = 255; }
  } else if (image.kind === kinds.GRAYSCALE_1BPP) {
    const stride = Math.ceil(image.width / 8);
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const v = input[y * stride + (x >> 3)] & (128 >> (x & 7)) ? 255 : 0, i = (y * image.width + x) * 4;
      rgba.data[i] = rgba.data[i + 1] = rgba.data[i + 2] = v; rgba.data[i + 3] = 255;
    }
  } else throw new PdfImageError("invalid");
  context.putImageData(rgba, 0, 0);
  return canvas;
}

/** Pages retain their PDF rotation/aspect ratio; extraction returns decoded source pixels,
 * not page screenshots. Vector drawings and stencil masks are not standalone photos. */
export async function convertPdfImages(file: File, options: {
  mode: ImageMode; format: ImageFormat; dpi: ImageResolution;
  cancelled?: () => boolean; onProgress?: (completed: number, total: number) => void;
  remainingBytes?: number;
}): Promise<ImageOutput[]> {
  const cancelled = options.cancelled ?? (() => false);
  checkCancelled(cancelled);
  const { pdf, task, lib } = await open(file);
  const outputs: ImageOutput[] = [];
  const base = file.name.replace(/\.pdf$/i, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 100) || "pdf";
  let bytes = 0;
  async function save(canvas: HTMLCanvasElement, suffix: string) {
    try {
      checkCancelled(cancelled);
      if (options.format === "jpg") {
        const ctx = canvas.getContext("2d")!;
        ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const data = await encode(canvas, options.format, options.dpi === 300 || options.mode === "images" ? 0.98 : 0.92);
      bytes += data.byteLength;
      if (bytes > (options.remainingBytes ?? MAX_OUTPUT_BYTES)) throw new PdfImageError("large");
      outputs.push({ name: `${base}-${suffix}.${options.format}`, bytes: data, width: canvas.width, height: canvas.height });
    } finally { canvas.width = canvas.height = 1; }
  }
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      checkCancelled(cancelled);
      const page = await pdf.getPage(pageNumber);
      try {
        const prefix = `page-${String(pageNumber).padStart(3, "0")}`;
        if (options.mode === "pages") {
          const original = page.getViewport({ scale: 1 }), size = imageDimensions(original.width, original.height, options.dpi);
          const { canvas } = canvasFor(size.width, size.height);
          try {
            await page.render({ canvas, viewport: page.getViewport({ scale: options.dpi / 72 }), background: "#ffffff" }).promise;
            await save(canvas, prefix);
          } finally { canvas.width = canvas.height = 1; }
        } else {
          const ops = await page.getOperatorList(), seen = new Set<string>();
          let count = 0;
          for (let i = 0; i < ops.fnArray.length; i++) {
            checkCancelled(cancelled);
            const op = ops.fnArray[i], args = ops.argsArray[i];
            let image: DecodedImage | undefined;
            if (op === lib.OPS.paintImageXObject || op === lib.OPS.paintImageXObjectRepeat) {
              const id = args[0] as string;
              if (seen.has(id)) continue;
              seen.add(id);
              const objects = id.startsWith("g_") ? page.commonObjs : page.objs;
              image = await new Promise<DecodedImage>(resolve => objects.get(id, resolve));
            } else if (op === lib.OPS.paintInlineImageXObject) image = args[0] as DecodedImage;
            else if (op === lib.OPS.paintInlineImageXObjectGroup) {
              // Optimized inline images can be packed into an atlas. Export individual crops.
              const atlas = drawDecoded(args[0] as DecodedImage, lib.ImageKind);
              try {
                for (const part of args[1] as { x: number; y: number; w: number; h: number }[]) {
                  const key = `atlas-${i}:${part.x}:${part.y}:${part.w}:${part.h}`;
                  if (seen.has(key)) continue;
                  seen.add(key);
                  const { canvas, context } = canvasFor(part.w, part.h);
                  context.drawImage(atlas, part.x, part.y, part.w, part.h, 0, 0, part.w, part.h);
                  await save(canvas, `${prefix}-image-${++count}`);
                }
              } finally { atlas.width = atlas.height = 1; }
            }
            if (image) await save(drawDecoded(image, lib.ImageKind), `${prefix}-image-${++count}`);
          }
        }
        options.onProgress?.(pageNumber, pdf.numPages);
      } finally { page.cleanup(); }
    }
    checkCancelled(cancelled);
    if (!outputs.length) throw new PdfImageError("empty");
    return outputs;
  } finally { await task.destroy(); }
}

/** Numbered prefixes avoid collisions even for repeated names and Unicode filenames. */
export function imageArchiveEntries(outputs: ImageOutput[]) {
  return Object.fromEntries(outputs.map((output, index) => [`${String(index + 1).padStart(4, "0")}-${output.name}`, output.bytes]));
}
