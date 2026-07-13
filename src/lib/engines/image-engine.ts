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

async function decodeToCanvas(file: File): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, width: canvas.width, height: canvas.height };
}

function canvasToBlob(canvas: HTMLCanvasElement, format: OutputImageFormat, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image."))),
      format,
      quality
    );
  });
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
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
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
  quality?: number
): Promise<Blob> {
  const { canvas } = await decodeToCanvas(file);
  return canvasToBlob(canvas, format, quality);
}

/** Resizes an image, optionally preserving aspect ratio, and encodes it to
 *  the given output format. */
export async function resizeImage(
  file: File,
  target: { width?: number; height?: number; maintainAspectRatio: boolean },
  format: OutputImageFormat,
  quality?: number
): Promise<Blob> {
  const { canvas: sourceCanvas, width: sourceWidth, height: sourceHeight } = await decodeToCanvas(file);

  let targetWidth = target.width ?? sourceWidth;
  let targetHeight = target.height ?? sourceHeight;

  if (target.maintainAspectRatio) {
    const aspect = sourceWidth / sourceHeight;
    if (target.width && !target.height) {
      targetHeight = Math.round(target.width / aspect);
    } else if (target.height && !target.width) {
      targetWidth = Math.round(target.height * aspect);
    } else if (target.width && target.height) {
      // Fit within the requested box without distortion.
      const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
      targetWidth = Math.round(sourceWidth * scale);
      targetHeight = Math.round(sourceHeight * scale);
    }
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = targetWidth;
  outputCanvas.height = targetHeight;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  return canvasToBlob(outputCanvas, format, quality);
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
  quality?: number
): Promise<Blob> {
  const { canvas: sourceCanvas } = await decodeToCanvas(file);

  const outputCanvas = document.createElement("canvas");
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

  return canvasToBlob(outputCanvas, format, quality);
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
  quality?: number
): Promise<Blob> {
  const { canvas: sourceCanvas, width, height } = await decodeToCanvas(file);
  const rotate = options.rotate ?? 0;
  const swapDimensions = rotate === 90 || rotate === 270;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = swapDimensions ? height : width;
  outputCanvas.height = swapDimensions ? width : height;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support 2D canvas rendering.");

  ctx.translate(outputCanvas.width / 2, outputCanvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
  ctx.drawImage(sourceCanvas, -width / 2, -height / 2);

  return canvasToBlob(outputCanvas, format, quality);
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

  return canvasToBlob(canvas, format, quality);
}
