export type Palette = number[][];
export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean }): Palette;
export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: "rgb565" | "rgb444" | "rgba4444"): Uint8Array;
export function GIFEncoder(): {
  writeFrame(index: Uint8Array, width: number, height: number, options: { palette: Palette; delay?: number; repeat?: number; dispose?: number; transparent?: boolean; transparentIndex?: number }): void;
  finish(): void;
  bytes(): Uint8Array;
  bytesView(): Uint8Array;
};
