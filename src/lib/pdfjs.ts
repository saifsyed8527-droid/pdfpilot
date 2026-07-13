// pdfjs-dist enforces an exact API-version-to-worker-version match at
// runtime (throws "API version does not match Worker version" otherwise).
// Adding officeparser in Phase 2B pulled in its own pdfjs-dist@6.1.200
// dependency, which npm hoisted to the top-level node_modules — silently
// upgrading the version this file's `import("pdfjs-dist")` resolves to,
// out from under the previously self-hosted worker build (which was
// 6.0.227, and moreover a legacy `.min.js` build — current pdfjs-dist
// versions only ship `.mjs` worker builds at all, so this needed a real
// fix, not just a version bump). public/pdf.worker.min.mjs must always be
// copied fresh from node_modules/pdfjs-dist/build/pdf.worker.min.mjs
// whenever pdfjs-dist's resolved version changes, exactly like
// public/tesseract/*'s self-hosted assets already require after a
// tesseract.js upgrade.
export async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}
