// Limits apply before DOCX decompression and before allocating page canvases.
export const WORD_PDF_LIMITS = {
  inputBytes: 100 * 1024 * 1024,
  expandedBytes: 256 * 1024 * 1024,
  partBytes: 64 * 1024 * 1024,
  xmlBytes: 12 * 1024 * 1024,
  entries: 4096,
  pages: 200,
  pagePixels: 12_000_000,
} as const;

export function wordPdfFilename(name: string): string {
  const base = name.replace(/\.docx$/i, "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim();
  return `${base || "document"}.pdf`;
}

export function safeWordLink(href: string): string | null {
  const value = href.trim();
  if (/^#[^\s]+$/.test(value)) return value;
  // No relative URLs, credentials, scripts, file URLs, or document data URIs.
  if (!/^(https?:\/\/|mailto:)/i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function checkWordArchiveEntry(name: string, bytes: number, count: number, total: number): void {
  if (count > WORD_PDF_LIMITS.entries || bytes > WORD_PDF_LIMITS.partBytes || total > WORD_PDF_LIMITS.expandedBytes ||
      !Number.isSafeInteger(bytes) || bytes < 0 || name.startsWith("/") || name.split("/").includes("..")) {
    throw new Error("This document is too large or has an unsafe archive structure for browser conversion.");
  }
  if (/\.(xml|rels)$/i.test(name) && bytes > WORD_PDF_LIMITS.xmlBytes) {
    throw new Error("This document contains an oversized XML part. Please export a smaller DOCX file.");
  }
}
