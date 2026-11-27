// Bound RGBA canvas allocations before assigning width/height.
export function checkRenderBudget(width: number, height: number, usedPixels = 0) {
  const pixels = Math.ceil(width) * Math.ceil(height);
  if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 16384) ||
      !Number.isSafeInteger(pixels) || pixels > 16_000_000 || usedPixels + pixels > 64_000_000) {
    throw new Error("This PDF is too large to preview safely. Use fewer pages or a smaller page size.");
  }
  return usedPixels + pixels;
}
