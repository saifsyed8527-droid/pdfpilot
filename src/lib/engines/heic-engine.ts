/**
 * HEIC Engine — wraps `heic-to` (verified real: v1.5.2, 327 GitHub stars,
 * actively maintained, libheif-based WASM decoder, zero runtime deps).
 * Decode-only: HEIC/HEIF has no browser-native or real-library encode path,
 * so this engine never produces HEIC output — see image-engine.ts's own
 * documented gap for why encoding HEIC is still not offered.
 *
 * Imports from "heic-to/csp" specifically (not the package's default entry)
 * because the default build evaluates its WASM loader via a string passed to
 * eval(), which this site's production CSP (no 'unsafe-eval') blocks — the
 * csp build avoids that entirely, confirmed via the package's own README.
 */

export type HeicOutputFormat = "image/jpeg" | "image/png";

// Dynamically imported (not a top-level import): heic-to's WASM decoder is
// heavy enough that bundling it eagerly bloated these tool pages' first-load
// JS to ~880kB, versus ~150-180kB for every other tool page — confirmed via
// `npm run build`'s route size output. Loading it only when a conversion
// actually runs keeps the page itself light.
export async function isHeic(file: File): Promise<boolean> {
  const { isHeic } = await import("heic-to/csp");
  return isHeic(file);
}

export async function convertHeicTo(file: File, type: HeicOutputFormat, quality?: number): Promise<Blob> {
  const { heicTo, isHeic } = await import("heic-to/csp");
  if (!(await isHeic(file))) {
    throw new Error("This file doesn't look like a HEIC/HEIF image.");
  }
  return heicTo({ blob: file, type, quality });
}
