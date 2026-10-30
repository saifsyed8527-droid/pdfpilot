import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.js";

export interface GifOptions { width: number; height: number; delay: number; repeat: number; fit: "contain" | "cover" | "stretch"; background: string }
export function validateGifOptions(options: GifOptions, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error("Choose between one and 30 images.");
  if (![options.width, options.height].every(n => Number.isInteger(n) && n > 0 && n <= 2048) || options.width * options.height > 4_000_000 || options.width * options.height * count > 40_000_000) throw new Error("GIF size is limited to 2,048px per side, four megapixels per frame and 40 megapixels across all frames.");
  if (!Number.isInteger(options.delay) || options.delay < 20 || options.delay > 60000) throw new Error("Set the frame duration between 20 and 60,000 milliseconds.");
  if (!Number.isInteger(options.repeat) || options.repeat < -1 || options.repeat > 100) throw new Error("Choose a valid GIF repeat count.");
  if (!["contain", "cover", "stretch"].includes(options.fit) || !/^#[0-9a-f]{6}$/i.test(options.background)) throw new Error("Choose a valid GIF fit and background.");
}
export function gifFramePlacement(sourceWidth: number, sourceHeight: number, options: GifOptions) {
  if (![sourceWidth, sourceHeight].every(n => Number.isFinite(n) && n > 0)) throw new Error("Invalid source image dimensions.");
  const scale = options.fit === "cover" ? Math.max(options.width / sourceWidth, options.height / sourceHeight) : Math.min(options.width / sourceWidth, options.height / sourceHeight);
  const width = options.fit === "stretch" ? options.width : sourceWidth * scale;
  const height = options.fit === "stretch" ? options.height : sourceHeight * scale;
  return { x: (options.width - width) / 2, y: (options.height - height) / 2, width, height };
}
export function gifEncoder(options: GifOptions) {
  const encoder = GIFEncoder();
  return {
    add(rgba: Uint8ClampedArray) {
      if (rgba.byteLength !== options.width * options.height * 4) throw new Error("GIF frame dimensions do not match its pixel data.");
      // Own a complete buffer: gifenc reads Uint32Array(rgba.buffer), ignoring byteOffset.
      const pixels = new Uint8ClampedArray(rgba);
      const palette = quantize(pixels, 256, { format: "rgb565" });
      const indices = applyPalette(pixels, palette, "rgb565");
      encoder.writeFrame(indices, options.width, options.height, { palette, delay: options.delay, repeat: options.repeat, dispose: 1 });
      if (encoder.bytesView().byteLength > 100 * 1024 * 1024) throw new Error("The GIF is larger than 100MB. Reduce its dimensions or frame count.");
    },
    finish() { encoder.finish(); return encoder.bytes(); },
  };
}
