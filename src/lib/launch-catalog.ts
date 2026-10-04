/** Existing translated cohort. Keep its order aligned with the reviewed dictionaries. */
export const LOCALIZED_LAUNCH_TOOL_SLUGS: readonly string[] = [
  "pdf-to-jpg", "jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf",
  "excel-to-pdf", "html-to-pdf", "pdf-to-word", "pdf-to-powerpoint",
  "pdf-to-excel", "pdf-to-pdfa", "delete-pages", "merge-pdf",
  "compress-pdf", "split-pdf", "extract-pages", "organize-pdf",
  "scan-pdf", "repair-pdf", "ocr-pdf", "rotate-pdf", "add-page-numbers",
  "watermark-pdf", "crop-pdf", "edit-pdf", "fill-pdf", "excel-to-xml",
];

/** Individually verified product releases; translations require their own review. */
export const ENGLISH_ONLY_TOOL_SLUGS: readonly string[] = ["flatten-pdf"];
export const LAUNCH_TOOL_SLUGS: readonly string[] = [
  ...LOCALIZED_LAUNCH_TOOL_SLUGS,
  ...ENGLISH_ONLY_TOOL_SLUGS,
];

const launchSlugs = new Set(LAUNCH_TOOL_SLUGS);
export const isLaunchTool = (slug: string): boolean => launchSlugs.has(slug);
const localizedSlugs = new Set(LOCALIZED_LAUNCH_TOOL_SLUGS);
export const isLocalizedLaunchTool = (slug: string): boolean => localizedSlugs.has(slug);

/** Fail closed for a typo/missing tool, and never depend on old registry order. */
export function selectLaunchTools<T extends { slug: string; order: number }>(tools: readonly T[]): T[] {
  return LAUNCH_TOOL_SLUGS.map((slug, index) => {
    const tool = tools.find((item) => item.slug === slug);
    if (!tool) throw new Error(`Launch tool is missing from the registry: ${slug}`);
    return { ...tool, order: index + 1 };
  });
}
