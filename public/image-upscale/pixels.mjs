// Pure pixel geometry shared by the inference worker and output-verification tests.
export const TILE = 128, HALO = 16, CORE = TILE - HALO * 2;
export const MAX_PIXELS = 16_000_000, MAX_SIDE = 8192;
export function outputDimensions(width, height, factor) {
  if (![2, 4].includes(factor) || ![width, height].every(v => Number.isInteger(v) && v > 0) || width * height * factor * factor > MAX_PIXELS || Math.max(width, height) * factor > MAX_SIDE) throw new Error('Choose an image whose enlarged result is at most 16 megapixels and 8,192 pixels per side. Try 2× or a smaller image.');
  return { width: width * factor, height: height * factor };
}
export function reflect(value, size) {
  if (size === 1) return 0;
  const period = 2 * (size - 1), position = ((value % period) + period) % period;
  return position < size ? position : period - position;
}
export function tileCount(width, height) { return Math.ceil(width / CORE) * Math.ceil(height / CORE); }
export function makeTile(pixels, width, height, x, y) {
  const count = TILE * TILE, values = new Float32Array(count * 3);
  for (let ty = 0; ty < TILE; ty++) for (let tx = 0; tx < TILE; tx++) {
    const p = (reflect(y + ty - HALO, height) * width + reflect(x + tx - HALO, width)) * 4, a = pixels[p + 3] / 255, i = ty * TILE + tx;
    for (let c = 0; c < 3; c++) values[c * count + i] = pixels[p + c] / 255 * a + 1 - a;
  }
  return values;
}
function alphaAt(pixels, width, height, x, y) {
  const sx = Math.max(0, Math.min(width - 1, (x + .5) / 2 - .5)), sy = Math.max(0, Math.min(height - 1, (y + .5) / 2 - .5));
  const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), dx = sx - x0, dy = sy - y0;
  return (pixels[(y0 * width + x0) * 4 + 3] * (1 - dx) + pixels[(y0 * width + x1) * 4 + 3] * dx) * (1 - dy) + (pixels[(y1 * width + x0) * 4 + 3] * (1 - dx) + pixels[(y1 * width + x1) * 4 + 3] * dx) * dy;
}
export function copyTile(prediction, output, pixels, width, height, x, y) {
  const side = TILE * 2, count = side * side;
  if (!(prediction instanceof Float32Array) || prediction.length !== count * 3) throw new Error('The image model returned an invalid result. Please retry.');
  for (let ty = 0; ty < Math.min(CORE, height - y) * 2; ty++) for (let tx = 0; tx < Math.min(CORE, width - x) * 2; tx++) {
    const ox = x * 2 + tx, oy = y * 2 + ty, to = (oy * width * 2 + ox) * 4, from = (ty + HALO * 2) * side + tx + HALO * 2;
    const alpha = alphaAt(pixels, width, height, ox, oy), a = alpha / 255;
    output[to + 3] = Math.round(alpha);
    for (let c = 0; c < 3; c++) {
      const value = prediction[c * count + from];
      if (!Number.isFinite(value)) throw new Error('The image model returned an invalid result. Please retry.');
      // Recover straight RGB from the white matte supplied to the RGB model.
      output[to + c] = a > 0 ? Math.round((value - (1 - a)) / a * 255) : 0;
    }
  }
}
export async function upscalePixels(pixels, width, height, factor, infer, onProgress = () => {}) {
  outputDimensions(width, height, factor);
  if (!(pixels instanceof Uint8ClampedArray) || pixels.length !== width * height * 4) throw new Error('The source image could not be decoded.');
  const passes = factor === 4 ? 2 : 1, total = tileCount(width, height) + (passes === 2 ? tileCount(width * 2, height * 2) : 0);
  let completed = 0;
  for (let pass = 0; pass < passes; pass++) {
    const output = new Uint8ClampedArray(width * height * 16);
    for (let y = 0; y < height; y += CORE) for (let x = 0; x < width; x += CORE) {
      const prediction = await infer(makeTile(pixels, width, height, x, y));
      copyTile(prediction, output, pixels, width, height, x, y);
      onProgress(++completed, total, pass + 1);
    }
    pixels = output; width *= 2; height *= 2;
  }
  return { pixels, width, height };
}
