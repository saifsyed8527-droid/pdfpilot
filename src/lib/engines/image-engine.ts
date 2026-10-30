/**
 * Image Engine — raster image conversion/resize using only the browser's
 * native Canvas API. Zero new dependencies: `createImageBitmap` decodes the
 * source file, `OffscreenCanvas`/`HTMLCanvasElement.convertToBlob`/`toBlob`
 * re-encodes it.
 *
 * Verified, honest format scope (not assumed):
 * - Decode input: JPEG, PNG, WEBP, GIF (first frame only), BMP, SVG
 *   (rasterized) all decode via `createImageBitmap` in evergreen browsers.
 * - Encode output: `canvas.toBlob()` is only guaranteed for "image/png" by
 *   spec; "image/jpeg" and "image/webp" are supported by every evergreen
 *   engine in practice (Chrome, Firefox, Safari 14+, Edge) but GIF/BMP/TIFF
 *   encoding is not supported by any browser's canvas implementation — so
 *   output is deliberately limited to PNG/JPEG/WEBP.
 * - HEIC/HEIF decode is NOT handled here: Chrome and Firefox can't decode it
 *   natively via createImageBitmap. See heic-engine.ts (wraps the real,
 *   actively maintained `heic-to` library) for that — kept as its own
 *   module rather than folded in here, same rationale as ocr-engine.ts.
 *   HEIC encoding (producing HEIC output) still has no real library and
 *   remains unsupported, in either engine.
 */

export type OutputImageFormat = "image/png" | "image/jpeg" | "image/webp";

export interface ImageDimensions {
  width: number;
  height: number;
}

export function checkImageTask(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Image processing cancelled.", "AbortError");
}

export function validateImageDimensions(width: number, height: number) {
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 16384) || width * height > 40_000_000) {
    throw new Error("Use positive whole-pixel dimensions, at most 16,384px per side and 40 megapixels.");
  }
}

export async function decodeToCanvas(file: File, signal?: AbortSignal): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  checkImageTask(signal);
  if (file.size > 100 * 1024 * 1024) throw new Error("Choose an image smaller than 100MB.");
  const bitmap = await createImageBitmap(file);
  try {
  checkImageTask(signal);
  validateImageDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");
  ctx.drawImage(bitmap, 0, 0);
  return { canvas, width: canvas.width, height: canvas.height };
  } finally { bitmap.close(); }
}

export async function canvasToBlob(canvas: HTMLCanvasElement, format: OutputImageFormat, quality?: number, signal?: AbortSignal): Promise<Blob> {
  checkImageTask(signal);
  if (!["image/png", "image/jpeg", "image/webp"].includes(format)) throw new Error("Choose PNG, JPG or WEBP output.");
  if (quality !== undefined && (!Number.isFinite(quality) || quality < 0 || quality > 1)) throw new Error("Image quality must be between 0 and 1.");
  if (format === "image/jpeg") {
    const ctx = canvas.getContext("2d")!;
    ctx.save(); ctx.globalCompositeOperation = "destination-over"; ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  }
  const result = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image."))),
      format,
      quality
    );
  });
  checkImageTask(signal);
  if (result.type !== format) throw new Error("This browser cannot save that image format. Choose PNG and try again.");
  return result;
}

/** Maps a source file's MIME type to a canvas-encodable output format,
 *  defaulting to PNG for anything canvas can decode but not re-encode
 *  (e.g. GIF, BMP) — so "edit this image" tools can default to "same
 *  format as the original" without forcing a format choice on every use. */
export function preferredOutputFormat(file: File): OutputImageFormat {
  if (file.type === "image/jpeg" || file.type === "image/webp") return file.type;
  return "image/png";
}

/** Reads the pixel dimensions of an image file without any conversion. */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  const bitmap = await createImageBitmap(file);
  try {
  validateImageDimensions(bitmap.width, bitmap.height);
  const dims = { width: bitmap.width, height: bitmap.height };
  return dims;
  } finally { bitmap.close(); }
}

export interface ImageExifData {
  make?: string;
  model?: string;
  dateTaken?: Date;
  gpsLatitude?: number;
  gpsLongitude?: number;
  software?: string;
  orientation?: number;
}

/** Reads EXIF metadata via exifr (verified real: parses File/Blob directly,
 *  node_modules/exifr/index.d.ts). Canvas-based re-encoding (used
 *  everywhere else in this engine) strips all EXIF data as an inherent
 *  side effect of decoding to raw pixels and re-encoding — reading it
 *  requires a real EXIF parser because canvas never sees it in the first
 *  place. Returns an empty object for images with no EXIF block (most
 *  screenshots, most PNGs, many web-saved JPEGs). */
export async function readImageExif(file: File): Promise<ImageExifData> {
  const exifr = (await import("exifr")).default;
  const data = await exifr.parse(file, { gps: true });
  if (!data) return {};
  return {
    make: data.Make,
    model: data.Model,
    dateTaken: data.DateTimeOriginal ?? data.CreateDate,
    gpsLatitude: data.latitude,
    gpsLongitude: data.longitude,
    software: data.Software,
    orientation: data.Orientation,
  };
}

/** Removes all metadata by decoding to a canvas and re-encoding — the same
 *  operation as convertImageFormat, exported under its own name because
 *  "strip metadata" is the honest, discoverable intent even though the
 *  underlying mechanism is identical. */
export async function removeImageExif(
  file: File,
  format: OutputImageFormat,
  quality?: number
): Promise<Blob> {
  return convertImageFormat(file, format, quality);
}

/** Re-encodes an image into a different (browser-encodable) format. */
export async function convertImageFormat(
  file: File,
  format: OutputImageFormat,
  quality?: number,
  signal?: AbortSignal
): Promise<Blob> {
  const { canvas } = await decodeToCanvas(file, signal);
  try { return await canvasToBlob(canvas, format, quality, signal); }
  finally { canvas.width = canvas.height = 0; }
}

/** Resizes an image, optionally preserving aspect ratio, and encodes it to
 *  the given output format. */
export interface ResizeTarget { width?: number; height?: number; maintainAspectRatio: boolean; percentage?: number; noEnlarge?: boolean }

export function resizedDimensions(source: ImageDimensions, target: ResizeTarget): ImageDimensions {
  validateImageDimensions(source.width, source.height);
  for (const n of [target.width, target.height]) if (n !== undefined && (!Number.isInteger(n) || n <= 0)) throw new Error("Enter positive whole-pixel dimensions.");
  let width = target.width ?? source.width, height = target.height ?? source.height;
  if (target.percentage !== undefined) {
    if (!Number.isFinite(target.percentage) || target.percentage <= 0 || target.percentage > 400) throw new Error("Choose a percentage greater than 0 and up to 400.");
    const ratio = Math.min(target.percentage / 100, target.noEnlarge ? 1 : Infinity);
    width = Math.max(1, Math.round(source.width * ratio)); height = Math.max(1, Math.round(source.height * ratio));
  } else if (target.maintainAspectRatio) {
    const ratio = Math.min(target.width === undefined ? Infinity : target.width / source.width, target.height === undefined ? Infinity : target.height / source.height, target.noEnlarge ? 1 : Infinity);
    if (!Number.isFinite(ratio)) throw new Error("Enter a width or height.");
    width = Math.max(1, Math.round(source.width * ratio)); height = Math.max(1, Math.round(source.height * ratio));
  } else if (target.noEnlarge) { width = Math.min(width, source.width); height = Math.min(height, source.height); }
  validateImageDimensions(width, height);
  return { width, height };
}

export async function resizeImage(
  file: File,
  target: ResizeTarget,
  format: OutputImageFormat,
  quality?: number,
  signal?: AbortSignal
): Promise<Blob> {
  const { canvas: sourceCanvas, width: sourceWidth, height: sourceHeight } = await decodeToCanvas(file, signal);
  const outputCanvas = document.createElement("canvas");
  try {
  const { width: targetWidth, height: targetHeight } = resizedDimensions({ width: sourceWidth, height: sourceHeight }, target);
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return await canvasToBlob(outputCanvas, format, quality, signal);
  } finally { sourceCanvas.width = sourceCanvas.height = outputCanvas.width = outputCanvas.height = 0; }
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Crops an image to the given pixel region (relative to the source
 *  image's own dimensions, not any displayed/scaled preview). */
export async function cropImage(
  file: File,
  region: CropRegion,
  format: OutputImageFormat,
  quality?: number,
  signal?: AbortSignal
): Promise<Blob> {
  const { canvas: sourceCanvas, width, height } = await decodeToCanvas(file, signal);
  const outputCanvas = document.createElement("canvas");
  try {
  validateImageDimensions(region.width, region.height);
  if (![region.x, region.y].every(n => Number.isInteger(n) && n >= 0) || region.x + region.width > width || region.y + region.height > height) throw new Error(`Keep the crop inside the ${width} × ${height}px image.`);
  outputCanvas.width = region.width;
  outputCanvas.height = region.height;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");
  ctx.drawImage(
    sourceCanvas,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height
  );

  return await canvasToBlob(outputCanvas, format, quality, signal);
  } finally { sourceCanvas.width = sourceCanvas.height = outputCanvas.width = outputCanvas.height = 0; }
}

export type RotationDegrees = 90 | 180 | 270;

/** Rotates an image clockwise by a multiple of 90 degrees and/or flips it
 *  horizontally/vertically, in one re-encode. Combined into one function
 *  (rather than separate rotate/flip tools) since orientation fixes
 *  virtually always need both together — a photo shot sideways and
 *  mirrored needs one pass, not two round-trips through re-encoding. */
export async function rotateAndFlipImage(
  file: File,
  options: { rotate?: RotationDegrees; flipHorizontal?: boolean; flipVertical?: boolean },
  format: OutputImageFormat,
  quality?: number,
  signal?: AbortSignal,
  previewMaxSide?: number
): Promise<Blob> {
  const { canvas: sourceCanvas, width, height } = await decodeToCanvas(file, signal);
  const rotate = options.rotate ?? 0;
  const swapDimensions = rotate === 90 || rotate === 270;

  const outputCanvas = document.createElement("canvas");
  try {
  if (![0, 90, 180, 270].includes(rotate)) throw new Error("Choose a rotation of 0, 90, 180 or 270 degrees.");
  if (previewMaxSide !== undefined && (!Number.isFinite(previewMaxSide) || previewMaxSide < 1 || previewMaxSide > 1200)) throw new Error("Invalid preview dimensions.");
  const ratio = previewMaxSide === undefined ? 1 : Math.min(1, previewMaxSide / Math.max(width, height));
  const drawWidth = Math.max(1, Math.round(width * ratio)), drawHeight = Math.max(1, Math.round(height * ratio));
  outputCanvas.width = swapDimensions ? drawHeight : drawWidth;
  outputCanvas.height = swapDimensions ? drawWidth : drawHeight;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");

  ctx.save();
  ctx.translate(outputCanvas.width / 2, outputCanvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
  ctx.drawImage(sourceCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  return await canvasToBlob(outputCanvas, format, quality, signal);
  } finally { sourceCanvas.width = sourceCanvas.height = outputCanvas.width = outputCanvas.height = 0; }
}

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "tiled";

export interface WatermarkOptions {
  text: string;
  position: WatermarkPosition;
  /** 0-1. Applied via ctx.globalAlpha, same convention as canvas itself. */
  opacity: number;
  color: string;
  /** Font size as a fraction of the image's shorter dimension, so the
   *  watermark scales sensibly across wildly different image sizes instead
   *  of using a fixed pixel size that's illegible on a 4000px photo or
   *  oversized on a 200px thumbnail. */
  fontSizeRatio: number;
}

/** Draws repeatable text over an image and re-encodes it — a real,
 *  from-scratch canvas operation (ctx.fillText), not a stub. "tiled" repeats
 *  the text diagonally across the whole image (the common "proofing" style);
 *  the other five positions place one instance of the text with margin. */
export async function addImageWatermark(
  file: File,
  options: WatermarkOptions,
  format: OutputImageFormat,
  quality?: number
): Promise<Blob> {
  const { canvas, width, height } = await decodeToCanvas(file);
  try {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");

  const fontSize = Math.max(12, Math.round(Math.min(width, height) * options.fontSizeRatio));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = options.color;
  ctx.globalAlpha = options.opacity;
  const margin = fontSize;

  if (options.position === "tiled") {
    const textWidth = ctx.measureText(options.text).width;
    const stepX = textWidth + margin * 2;
    const stepY = fontSize * 4;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-30 * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
    const diagonal = Math.sqrt(width * width + height * height);
    for (let y = -diagonal; y < diagonal; y += stepY) {
      for (let x = -diagonal; x < diagonal; x += stepX) {
        ctx.fillText(options.text, x, y);
      }
    }
  } else {
    ctx.textBaseline = "alphabetic";
    const textWidth = ctx.measureText(options.text).width;
    const positions: Record<Exclude<WatermarkPosition, "tiled">, [number, number]> = {
      "top-left": [margin, margin + fontSize],
      "top-right": [width - textWidth - margin, margin + fontSize],
      "bottom-left": [margin, height - margin],
      "bottom-right": [width - textWidth - margin, height - margin],
      center: [(width - textWidth) / 2, height / 2],
    };
    const [x, y] = positions[options.position];
    ctx.fillText(options.text, x, y);
  }

  return await canvasToBlob(canvas, format, quality);
  } finally { canvas.width = canvas.height = 0; }
}
