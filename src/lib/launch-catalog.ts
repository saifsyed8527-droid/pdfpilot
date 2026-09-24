/** Owner-approved launch order, 25 September 2026. Home is the 27th page. */
export const LAUNCH_TOOL_SLUGS: readonly string[] = [
  "pdf-to-jpg", "jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf",
  "excel-to-pdf", "html-to-pdf", "pdf-to-word", "pdf-to-powerpoint",
  "pdf-to-excel", "pdf-to-pdfa", "delete-pages", "merge-pdf",
  "compress-pdf", "split-pdf", "extract-pages", "organize-pdf",
  "scan-pdf", "repair-pdf", "ocr-pdf", "rotate-pdf", "add-page-numbers",
  "watermark-pdf", "crop-pdf", "edit-pdf", "fill-pdf", "excel-to-xml",
];

const launchSlugs = new Set(LAUNCH_TOOL_SLUGS);
export const isLaunchTool = (slug: string): boolean => launchSlugs.has(slug);

/** Fail closed for a typo/missing tool, and never depend on old registry order. */
export function selectLaunchTools<T extends { slug: string; order: number }>(tools: readonly T[]): T[] {
  return LAUNCH_TOOL_SLUGS.map((slug, index) => {
    const tool = tools.find((item) => item.slug === slug);
    if (!tool) throw new Error(`Launch tool is missing from the registry: ${slug}`);
    return { ...tool, order: index + 1 };
  });
}
